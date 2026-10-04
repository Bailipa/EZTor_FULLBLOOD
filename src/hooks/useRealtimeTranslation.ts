'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { WordResult } from '@/types/api'
import { triggerHapticFeedback } from '@/lib/hapticFeedback'
import { scheduleSavedFeedback } from '@/lib/savedFeedbackScheduler'

export interface WordEntry {
  id: string
  word: string
  translation: string
  phonetic?: string
  pos?: string
  example?: string
  exampleTranslation?: string
  status: 'idle' | 'loading' | 'found' | 'not-found' | 'error' | 'ai-loading'
  isPublic: boolean
  saveStatus: 'idle' | 'in-vocabulary' | 'not-saved' | 'pending' | 'saving' | 'saved' | 'error'
  saveTargetGroupId?: string
  aiTranslated?: boolean
  batchTranslation?: boolean
  batchQueued?: boolean
  errorStage?: 'lookup' | 'ai'
}

interface UseRealtimeTranslationOptions {
  showPos: boolean
  showExample: boolean
  targetGroupId: string
  isGuest?: boolean
  autoSaveWords?: boolean
  soundEffectsEnabled?: boolean
}

type DebouncedFunction = {
  (word: string, version: number): void
  cancel: () => void
}

function createDebouncedFetch(fn: (word: string, version: number) => void, delay: number): DebouncedFunction {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debouncedFn = (word: string, version: number) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(word, version)
      timeoutId = null
    }, delay)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return Object.assign(debouncedFn, { cancel })
}

let nextId = 1
function createEmptyEntry(): WordEntry {
  return {
    id: `entry-${nextId++}`,
    word: '',
    translation: '',
    status: 'idle',
    isPublic: false,
    saveStatus: 'idle',
  }
}

function isInvalidForLibrary(item: {
  pos?: string | null
  translation?: string | null
}): boolean {
  if (
    item.pos === '错误' ||
    item.pos === '风控' ||
    item.pos === '中断' ||
    item.pos === '非英语' ||
    item.pos === '句子'
  ) {
    return true
  }
  const t = typeof item.translation === 'string' ? item.translation : ''
  return (
    t.includes('拼写错误或不存在') ||
    t.includes('粗俗或敏感') ||
    t.includes('⚠️')
  )
}

const AI_BATCH_SIZE = 10

function parseTranslationResults(streamText: string): WordResult[] {
  const results: WordResult[] = []
  for (const block of streamText.split('\n\n')) {
    const start = block.indexOf('{')
    const end = block.lastIndexOf('}')
    if (start < 0 || end < start) continue
    try {
      const parsed = JSON.parse(block.slice(start, end + 1)) as { results?: WordResult[] }
      if (Array.isArray(parsed.results)) results.push(...parsed.results)
    } catch {
      // A block can be a partial model stream; only complete JSON result blocks are used.
    }
  }
  return results
}

export function useRealtimeTranslation({ showPos, showExample, targetGroupId, isGuest, autoSaveWords = true, soundEffectsEnabled = true }: UseRealtimeTranslationOptions) {
  const [entries, setEntries] = useState<WordEntry[]>([createEmptyEntry()])
  const debounceMapRef = useRef<Map<string, DebouncedFunction>>(new Map())
  const abortControllerRef = useRef<Map<string, AbortController>>(new Map())
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const saveControllersRef = useRef<Map<string, AbortController>>(new Map())
  const aiInFlightRef = useRef<Set<string>>(new Set())
  const aiAbortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const aiCancelledMapRef = useRef<Map<string, { current: boolean }>>(new Map())
  const queryVersionRef = useRef<Map<string, number>>(new Map())
  const batchRunRef = useRef(0)
  const activeBatchControllerRef = useRef<AbortController | null>(null)
  const batchEntryIdsRef = useRef<Set<string>>(new Set())
  const [batchProgress, setBatchProgress] = useState<{
    completed: number
    total: number
    status: 'running' | 'stopped' | 'done'
  } | null>(null)

  useEffect(() => {
    return () => {
      batchRunRef.current += 1
      activeBatchControllerRef.current?.abort()
      debounceMapRef.current.forEach((fn) => fn.cancel())
      abortControllerRef.current.forEach((controller) => controller.abort())
      saveTimersRef.current.forEach((timer) => clearTimeout(timer))
      saveControllersRef.current.forEach((controller) => controller.abort())
      aiAbortControllersRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  const updateEntry = useCallback((entryId: string, updates: Partial<WordEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    )
  }, [])

  const stopBatchRun = useCallback(() => {
    if (batchEntryIdsRef.current.size === 0) return
    batchRunRef.current += 1
    activeBatchControllerRef.current?.abort()
    for (const id of batchEntryIdsRef.current) {
      updateEntry(id, { status: 'not-found', batchTranslation: false, batchQueued: false })
    }
    batchEntryIdsRef.current.clear()
    setBatchProgress((current) => current ? { ...current, status: 'stopped' } : current)
  }, [updateEntry])

  const cancelSaveTimer = useCallback((entryId: string) => {
    const timer = saveTimersRef.current.get(entryId)
    if (timer) {
      clearTimeout(timer)
      saveTimersRef.current.delete(entryId)
    }
  }, [])

  const saveEntry = useCallback(async (entryId: string, word: string, groupId?: string, version?: number) => {
    const normalizedWord = word.trim()
    if (!normalizedWord) return
    const requestVersion = version ?? queryVersionRef.current.get(entryId)
    if (requestVersion !== undefined && queryVersionRef.current.get(entryId) !== requestVersion) return

    saveControllersRef.current.get(entryId)?.abort()
    const controller = new AbortController()
    saveControllersRef.current.set(entryId, controller)
    updateEntry(entryId, { saveStatus: 'saving', saveTargetGroupId: groupId })

    try {
      const res = await fetch('/api/vocabulary/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: normalizedWord, targetGroupId: groupId || undefined }),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || '保存失败')
      if (requestVersion === undefined || queryVersionRef.current.get(entryId) === requestVersion) {
        updateEntry(entryId, { saveStatus: 'saved', saveTargetGroupId: groupId })
        scheduleSavedFeedback(soundEffectsEnabled)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      if (requestVersion === undefined || queryVersionRef.current.get(entryId) === requestVersion) {
        updateEntry(entryId, { saveStatus: 'error', saveTargetGroupId: groupId })
        triggerHapticFeedback('error')
      }
    } finally {
      if (saveControllersRef.current.get(entryId) === controller) {
        saveControllersRef.current.delete(entryId)
      }
    }
  }, [updateEntry, soundEffectsEnabled])

  const startSaveTimer = useCallback(
    (entryId: string, word: string, translation: string, pos?: string, groupId?: string, version?: number) => {
      cancelSaveTimer(entryId)

      const timer = setTimeout(async () => {
        saveTimersRef.current.delete(entryId)
        if (version !== undefined && queryVersionRef.current.get(entryId) !== version) return
        if (isInvalidForLibrary({ translation, pos })) {
          updateEntry(entryId, { saveStatus: 'idle' })
          return
        }
        await saveEntry(entryId, word, groupId, version)
      }, 3000)

      saveTimersRef.current.set(entryId, timer)
    },
    [cancelSaveTimer, updateEntry, saveEntry],
  )

  const fetchPublicTranslation = useCallback(
    async (entryId: string, word: string, version: number) => {
      if (queryVersionRef.current.get(entryId) !== version) return
      const existingController = abortControllerRef.current.get(entryId)
      if (existingController) {
        existingController.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current.set(entryId, controller)

      cancelSaveTimer(entryId)
      saveControllersRef.current.get(entryId)?.abort()
      updateEntry(entryId, { status: 'loading', saveStatus: 'idle' })

      try {
        const response = await fetch('/api/public-translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words: [word.trim()] }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Translation request failed')
        }

        const data = await response.json()
        if (queryVersionRef.current.get(entryId) !== version) return

        if (data.success && data.data.results && data.data.results.length > 0) {
          const result = data.data.results[0]
          const groupId = targetGroupId === 'none' ? undefined : targetGroupId
          updateEntry(entryId, {
            translation: result.translation,
            phonetic: result.phonetic,
            pos: result.pos,
            example: result.example,
            exampleTranslation: result.exampleTranslation,
            status: 'found',
            isPublic: true,
            saveStatus: 'idle',
            saveTargetGroupId: groupId,
            errorStage: undefined,
          })

          if (isInvalidForLibrary(result)) {
            updateEntry(entryId, { saveStatus: 'idle' })
          } else if (!isGuest) {
            try {
              const params = new URLSearchParams({ word: word.trim() })
              if (groupId) params.set('targetGroupId', groupId)
              const checkRes = await fetch(`/api/vocabulary/check?${params}`)
              const checkData = await checkRes.json()
              if (queryVersionRef.current.get(entryId) !== version) return

              if (checkData.success && checkData.inTargetGroup) {
                updateEntry(entryId, { saveStatus: 'in-vocabulary' })
              } else if (!autoSaveWords) {
                updateEntry(entryId, { saveStatus: 'not-saved' })
              } else {
                updateEntry(entryId, { saveStatus: 'pending' })
                startSaveTimer(entryId, word, result.translation, result.pos, groupId, version)
              }
            } catch {
              if (queryVersionRef.current.get(entryId) !== version) return
              if (!autoSaveWords) {
                updateEntry(entryId, { saveStatus: 'not-saved' })
                return
              }
              updateEntry(entryId, { saveStatus: 'pending' })
              startSaveTimer(entryId, word, result.translation, result.pos, groupId, version)
            }
          }
        } else {
          updateEntry(entryId, {
            translation: '',
            phonetic: undefined,
            pos: undefined,
            example: undefined,
            exampleTranslation: undefined,
            status: 'not-found',
            isPublic: false,
            saveStatus: 'idle',
            errorStage: undefined,
          })
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        if (queryVersionRef.current.get(entryId) !== version) return
        updateEntry(entryId, { status: 'error', saveStatus: 'idle', errorStage: 'lookup' })
      } finally {
        if (abortControllerRef.current.get(entryId) === controller) {
          abortControllerRef.current.delete(entryId)
        }
      }
    },
    [updateEntry, cancelSaveTimer, startSaveTimer, isGuest, autoSaveWords, targetGroupId],
  )

  const fetchPublicTranslationBatch = useCallback(async (batch: WordEntry[]) => {
    const items = batch.map((entry) => ({
      id: entry.id,
      word: entry.word.trim(),
      version: queryVersionRef.current.get(entry.id) || 0,
    }))
    const controller = new AbortController()
    const groupId = targetGroupId === 'none' ? undefined : targetGroupId
    for (const item of items) {
      abortControllerRef.current.get(item.id)?.abort()
      abortControllerRef.current.set(item.id, controller)
      updateEntry(item.id, { status: 'loading', saveStatus: 'idle', errorStage: undefined })
    }

    try {
      const response = await fetch('/api/public-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: items.map((item) => item.word) }),
        signal: controller.signal,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        const retryAfter = Number(response.headers.get('Retry-After'))
        const wait = response.status === 429 && retryAfter ? `，请 ${retryAfter} 秒后重试` : ''
        throw new Error(`${data.error || '词库查询失败'}${wait}`)
      }

      const results = Array.isArray(data.data?.results) ? data.data.results as WordResult[] : []
      const resultByWord = new Map(results.map((result) => [result.word.trim().toLocaleLowerCase(), result]))
      for (const item of items) {
        if (abortControllerRef.current.get(item.id) === controller) abortControllerRef.current.delete(item.id)
      }
      const foundToCheck: Array<{ item: typeof items[number]; result: WordResult }> = []
      for (const item of items) {
        if (queryVersionRef.current.get(item.id) !== item.version) continue
        const result = resultByWord.get(item.word.toLocaleLowerCase())
        if (!result) {
          updateEntry(item.id, {
            status: 'not-found',
            isPublic: false,
            saveStatus: 'idle',
            errorStage: undefined,
          })
          continue
        }

        updateEntry(item.id, {
          translation: result.translation,
          phonetic: result.phonetic,
          pos: result.pos,
          example: result.example,
          exampleTranslation: result.exampleTranslation,
          status: 'found',
          isPublic: true,
          saveStatus: 'idle',
          saveTargetGroupId: groupId,
          errorStage: undefined,
        })
        if (!isInvalidForLibrary(result) && !isGuest) foundToCheck.push({ item, result })
      }

      await Promise.all(foundToCheck.map(async ({ item, result }) => {
        if (queryVersionRef.current.get(item.id) !== item.version) return
        try {
          const params = new URLSearchParams({ word: item.word })
          if (groupId) params.set('targetGroupId', groupId)
          const checkRes = await fetch(`/api/vocabulary/check?${params}`)
          const checkData = await checkRes.json()
          if (queryVersionRef.current.get(item.id) !== item.version) return
          if (checkRes.ok && checkData.success && checkData.inTargetGroup) {
            updateEntry(item.id, { saveStatus: 'in-vocabulary' })
          } else if (!autoSaveWords) {
            updateEntry(item.id, { saveStatus: 'not-saved' })
          } else {
            updateEntry(item.id, { saveStatus: 'pending' })
            startSaveTimer(item.id, item.word, result.translation || '', result.pos, groupId, item.version)
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
          if (queryVersionRef.current.get(item.id) !== item.version) return
          if (!autoSaveWords) {
            updateEntry(item.id, { saveStatus: 'not-saved' })
            return
          }
          updateEntry(item.id, { saveStatus: 'pending' })
          startSaveTimer(item.id, item.word, result.translation || '', result.pos, groupId, item.version)
        }
      }))
    } catch (error) {
      if (controller.signal.aborted) {
        for (const item of items) {
          if (queryVersionRef.current.get(item.id) === item.version) {
            updateEntry(item.id, { status: 'idle', errorStage: undefined })
          }
        }
        return
      }
      const message = error instanceof Error ? error.message : '词库查询失败'
      toast.error(message)
      for (const item of items) {
        if (queryVersionRef.current.get(item.id) === item.version) {
          updateEntry(item.id, { status: 'error', saveStatus: 'idle', errorStage: 'lookup' })
        }
      }
    } finally {
      for (const item of items) {
        if (abortControllerRef.current.get(item.id) === controller) abortControllerRef.current.delete(item.id)
      }
    }
  }, [targetGroupId, isGuest, autoSaveWords, updateEntry, startSaveTimer])

  const getDebouncedFetch = useCallback(
    (entryId: string) => {
      if (!debounceMapRef.current.has(entryId)) {
        const debouncedFn = createDebouncedFetch((word: string, version: number) => {
          if (queryVersionRef.current.get(entryId) !== version) return
          if (word.trim().length === 0) {
            cancelSaveTimer(entryId)
            updateEntry(entryId, {
              translation: '',
              phonetic: undefined,
              pos: undefined,
              example: undefined,
              exampleTranslation: undefined,
              status: 'idle',
              isPublic: false,
              saveStatus: 'idle',
            })
            return
          }
          fetchPublicTranslation(entryId, word, version)
        }, 300)

        debounceMapRef.current.set(entryId, debouncedFn)
      }

      return debounceMapRef.current.get(entryId)!
    },
    [fetchPublicTranslation, updateEntry, cancelSaveTimer],
  )

  const updateWord = useCallback(
    (entryId: string, newWord: string, deferLookup = false) => {
      if (batchEntryIdsRef.current.has(entryId)) stopBatchRun()
      const version = (queryVersionRef.current.get(entryId) || 0) + 1
      queryVersionRef.current.set(entryId, version)
      cancelSaveTimer(entryId)
      saveControllersRef.current.get(entryId)?.abort()
      abortControllerRef.current.get(entryId)?.abort()
      const aiFlag = aiCancelledMapRef.current.get(entryId)
      if (aiFlag) aiFlag.current = true
      aiAbortControllersRef.current.get(entryId)?.abort()
      updateEntry(entryId, {
        word: newWord,
        translation: '',
        phonetic: undefined,
        pos: undefined,
        example: undefined,
        exampleTranslation: undefined,
        status: 'idle',
        isPublic: false,
        aiTranslated: false,
        saveStatus: 'idle',
        errorStage: undefined,
      })
      const debouncedFetch = getDebouncedFetch(entryId)
      debouncedFetch.cancel()
      if (!deferLookup) debouncedFetch(newWord, version)
    },
    [getDebouncedFetch, updateEntry, cancelSaveTimer, stopBatchRun],
  )

  const retryPublicTranslation = useCallback((entryId: string) => {
    const entry = entries.find((item) => item.id === entryId)
    if (entry) updateWord(entryId, entry.word)
  }, [entries, updateWord])

  const cancelSave = useCallback((entryId: string) => {
    cancelSaveTimer(entryId)
    saveControllersRef.current.get(entryId)?.abort()
    updateEntry(entryId, { saveStatus: 'not-saved' })
  }, [cancelSaveTimer, updateEntry])

  const importWords = useCallback((words: string[]) => {
    const imported = words.map((word) => ({ ...createEmptyEntry(), word }))
    setEntries((prev) => [...prev.filter((entry) => entry.word.trim()), ...imported])
    imported.forEach((entry) => {
      queryVersionRef.current.set(entry.id, 1)
    })
    void fetchPublicTranslationBatch(imported)
  }, [fetchPublicTranslationBatch])

  const addEntry = useCallback(() => {
    const lastEntry = entries[entries.length - 1]
    if (lastEntry && lastEntry.word.trim() === '') return null

    const entry = createEmptyEntry()
    setEntries((prev) => [...prev, entry])
    return entry.id
  }, [entries])

  const removeEntry = useCallback((entryId: string) => {
    if (batchEntryIdsRef.current.has(entryId)) stopBatchRun()
    // 先取消该 entry 上可能存在的 AI 翻译（标记为取消避免 catch 弹错）
    const aiFlag = aiCancelledMapRef.current.get(entryId)
    if (aiFlag) aiFlag.current = true
    const aiController = aiAbortControllersRef.current.get(entryId)
    if (aiController) {
      aiController.abort()
      aiAbortControllersRef.current.delete(entryId)
      aiCancelledMapRef.current.delete(entryId)
    }

    cancelSaveTimer(entryId)
    saveControllersRef.current.get(entryId)?.abort()
    saveControllersRef.current.delete(entryId)
    queryVersionRef.current.delete(entryId)
    aiInFlightRef.current.delete(entryId)

    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== entryId)
      if (filtered.length === 0) {
        return [createEmptyEntry()]
      }
      return filtered
    })

    const debouncedFn = debounceMapRef.current.get(entryId)
    if (debouncedFn) {
      debouncedFn.cancel()
      debounceMapRef.current.delete(entryId)
    }

    const controller = abortControllerRef.current.get(entryId)
      if (controller) {
      controller.abort()
      abortControllerRef.current.delete(entryId)
    }
  }, [cancelSaveTimer, stopBatchRun])

  const clearAll = useCallback(() => {
    stopBatchRun()
    setBatchProgress(null)
    debounceMapRef.current.forEach((fn) => fn.cancel())
    debounceMapRef.current.clear()

    abortControllerRef.current.forEach((controller) => controller.abort())
    abortControllerRef.current.clear()

    saveTimersRef.current.forEach((timer) => clearTimeout(timer))
    saveTimersRef.current.clear()
    saveControllersRef.current.forEach((controller) => controller.abort())
    saveControllersRef.current.clear()
    queryVersionRef.current.clear()

    // 取消所有 AI 翻译
    aiCancelledMapRef.current.forEach((flag) => {
      flag.current = true
    })
    aiAbortControllersRef.current.forEach((controller) => {
      controller.abort()
    })
    aiAbortControllersRef.current.clear()
    aiCancelledMapRef.current.clear()

    aiInFlightRef.current.clear()

    setEntries([createEmptyEntry()])
  }, [stopBatchRun])

  const translateSingle = useCallback(
    async (entryId: string) => {
      if (batchEntryIdsRef.current.size > 0) {
        toast.info('当前批量翻译结束后再处理新词条')
        return
      }
      const entry = entries.find((e) => e.id === entryId)
      if (!entry || !entry.word.trim()) return

      // 如果该 entry 已有在飞 AI 翻译，把它当作"被新一次顶掉"
      const existingFlag = aiCancelledMapRef.current.get(entryId)
      if (existingFlag) existingFlag.current = true
      const existingController = aiAbortControllersRef.current.get(entryId)
      if (existingController) existingController.abort()

      const cancelledByUser = { current: false }
      const version = queryVersionRef.current.get(entryId) || 0
      const controller = new AbortController()
      aiAbortControllersRef.current.set(entryId, controller)
      aiCancelledMapRef.current.set(entryId, cancelledByUser)

      cancelSaveTimer(entryId)
        updateEntry(entryId, { status: 'ai-loading', saveStatus: 'idle', batchTranslation: false, batchQueued: false, errorStage: undefined })

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            words: [entry.word.trim()],
            options: { showPos, showExample },
            targetGroupId: targetGroupId === 'none' ? null : targetGroupId,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Translation failed')
        }

        if (!response.body) throw new Error('ReadableStream not supported')

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let done = false
        let accumulatedText = ''
        let lastValidResult: WordResult | null = null

        while (!done) {
          const { value, done: doneReading } = await reader.read()
          done = doneReading
          if (value) {
            accumulatedText += decoder.decode(value, { stream: true })

            try {
              const jsonBlocks = accumulatedText.split('\n\n').filter((b) => b.trim())
              const lastBlock = jsonBlocks[jsonBlocks.length - 1] || ''
              let cleanText = lastBlock.trim()

              if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7)
              if (cleanText.startsWith('```')) cleanText = cleanText.substring(3)
              if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3)
              cleanText = cleanText.trim()

              const parsedData = JSON.parse(cleanText)
              if (parsedData?.results?.length > 0) {
                lastValidResult = parsedData.results[0]
              }
            } catch {
              // Continue parsing
            }
          }
        }

        if (queryVersionRef.current.get(entryId) !== version) return

      if (lastValidResult) {
          const validForLibrary = !isInvalidForLibrary(lastValidResult)
          updateEntry(entryId, {
            translation: lastValidResult.translation,
            phonetic: lastValidResult.phonetic,
            pos: lastValidResult.pos,
            example: lastValidResult.example,
            exampleTranslation: lastValidResult.exampleTranslation,
            status: 'found',
            isPublic: false,
            aiTranslated: true,
            errorStage: undefined,
            saveStatus: validForLibrary ? (autoSaveWords ? 'saving' : 'not-saved') : 'idle',
            saveTargetGroupId: targetGroupId === 'none' ? undefined : targetGroupId,
          })
          if (validForLibrary && autoSaveWords) {
            const params = new URLSearchParams({ word: entry.word.trim() })
            if (targetGroupId !== 'none') params.set('targetGroupId', targetGroupId)
            try {
              const checkRes = await fetch(`/api/vocabulary/check?${params}`)
              const checkData = await checkRes.json()
              if (queryVersionRef.current.get(entryId) === version) {
                updateEntry(entryId, {
                  saveStatus: checkData.success && checkData.inTargetGroup ? 'saved' : 'error',
                })
                if (checkData.success && checkData.inTargetGroup) {
                  scheduleSavedFeedback(soundEffectsEnabled)
                }
              }
            } catch {
              if (queryVersionRef.current.get(entryId) === version) {
                updateEntry(entryId, { saveStatus: 'error' })
              }
            }
          }
        } else {
          updateEntry(entryId, { status: 'error', errorStage: 'ai' })
          toast.error('翻译失败，请重试')
        }
      } catch (error: unknown) {
        const isStillActive = aiAbortControllersRef.current.get(entryId) === controller

        // 如果被新一次启动顶掉了，状态由新一次管理，这里啥也不做
        if (!isStillActive) return

        if (error instanceof Error && error.name === 'AbortError') {
          if (cancelledByUser.current) {
            // 用户主动取消 → 静默退出、状态回到 not-found
            updateEntry(entryId, { status: 'not-found', saveStatus: 'idle' })
            return
          }
          toast.error('请求超时')
        } else {
          const err = error as Error
          toast.error(err.message || '翻译失败')
        }
        updateEntry(entryId, { status: 'error', errorStage: 'ai' })
      } finally {
        // 只在"我还是当前那次"时清理
        if (aiAbortControllersRef.current.get(entryId) === controller) {
          aiAbortControllersRef.current.delete(entryId)
        }
        if (aiCancelledMapRef.current.get(entryId) === cancelledByUser) {
          aiCancelledMapRef.current.delete(entryId)
        }
      }
    },
    [entries, showPos, showExample, targetGroupId, autoSaveWords, soundEffectsEnabled, updateEntry, cancelSaveTimer],
  )

  const translateBatchEntries = useCallback(async (batch: WordEntry[], runId: number): Promise<'success' | 'failed' | 'cancelled'> => {
    const items = batch.map((entry) => ({
      id: entry.id,
      word: entry.word.trim(),
      version: queryVersionRef.current.get(entry.id) || 0,
    }))
    const controller = new AbortController()
    const cancelledByUser = { current: false }
    activeBatchControllerRef.current = controller
    for (const item of items) {
      aiInFlightRef.current.add(item.id)
      aiAbortControllersRef.current.set(item.id, controller)
      aiCancelledMapRef.current.set(item.id, cancelledByUser)
      updateEntry(item.id, { status: 'ai-loading', batchTranslation: true, batchQueued: false, saveStatus: 'idle', errorStage: undefined })
    }

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          words: items.map((item) => item.word),
          options: { showPos, showExample },
          targetGroupId: targetGroupId === 'none' ? null : targetGroupId,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After')) || 60
          throw new Error(`请求过于频繁，请等待约 ${retryAfter} 秒后再重试`)
        }
        throw new Error(errorData.error || '批量 AI 翻译失败')
      }
      if (!response.body) throw new Error('当前浏览器无法读取翻译结果流')

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let streamText = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        streamText += decoder.decode(value, { stream: true })
      }
      streamText += decoder.decode()

      if (runId !== batchRunRef.current) return 'cancelled'
      const resultByWord = new Map(
        parseTranslationResults(streamText).map((result) => [result.word.trim().toLocaleLowerCase(), result]),
      )
      const saveChecks: Promise<void>[] = []

      for (const item of items) {
        if (queryVersionRef.current.get(item.id) !== item.version) continue
        const result = resultByWord.get(item.word.toLocaleLowerCase())
        if (!result) {
          updateEntry(item.id, { status: 'error', saveStatus: 'idle', batchTranslation: false, errorStage: 'ai' })
          continue
        }

        const validForLibrary = !isInvalidForLibrary(result)
        updateEntry(item.id, {
          translation: result.translation || '',
          phonetic: result.phonetic || undefined,
          pos: result.pos || undefined,
          example: result.example || undefined,
          exampleTranslation: result.exampleTranslation || undefined,
          status: 'found',
          isPublic: false,
          aiTranslated: true,
          errorStage: undefined,
          batchTranslation: false,
          saveStatus: !validForLibrary ? 'idle' : autoSaveWords ? 'saving' : 'not-saved',
          saveTargetGroupId: targetGroupId === 'none' ? undefined : targetGroupId,
        })

        if (validForLibrary && autoSaveWords) {
          const params = new URLSearchParams({ word: item.word })
          if (targetGroupId !== 'none') params.set('targetGroupId', targetGroupId)
          saveChecks.push((async () => {
            try {
              const checkRes = await fetch(`/api/vocabulary/check?${params}`)
              const checkData = await checkRes.json()
              if (runId === batchRunRef.current && queryVersionRef.current.get(item.id) === item.version) {
                updateEntry(item.id, { saveStatus: checkRes.ok && checkData.success && checkData.inTargetGroup ? 'saved' : 'error' })
                if (checkRes.ok && checkData.success && checkData.inTargetGroup) {
                  scheduleSavedFeedback(soundEffectsEnabled)
                } else {
                  triggerHapticFeedback('error')
                }
              }
            } catch {
              if (runId === batchRunRef.current && queryVersionRef.current.get(item.id) === item.version) {
                updateEntry(item.id, { saveStatus: 'error' })
                triggerHapticFeedback('error')
              }
            }
          })())
        }
      }
      await Promise.all(saveChecks)
      return 'success'
    } catch (error) {
      if (controller.signal.aborted || runId !== batchRunRef.current) return 'cancelled'
      const message = error instanceof Error ? error.message : '批量 AI 翻译失败'
      toast.error(message)
      for (const item of items) {
        if (queryVersionRef.current.get(item.id) === item.version) {
          updateEntry(item.id, { status: 'error', saveStatus: 'idle', batchTranslation: false, errorStage: 'ai' })
        }
      }
      return 'failed'
    } finally {
      if (activeBatchControllerRef.current === controller) activeBatchControllerRef.current = null
      for (const item of items) {
        aiInFlightRef.current.delete(item.id)
        if (aiAbortControllersRef.current.get(item.id) === controller) aiAbortControllersRef.current.delete(item.id)
        if (aiCancelledMapRef.current.get(item.id) === cancelledByUser) aiCancelledMapRef.current.delete(item.id)
        batchEntryIdsRef.current.delete(item.id)
      }
    }
  }, [showPos, showExample, targetGroupId, autoSaveWords, soundEffectsEnabled, updateEntry])

  const translateAll = useCallback(async () => {
    const pendingEntries = entries.filter((entry) =>
      entry.word.trim() && entry.status === 'not-found' && !entry.aiTranslated && !aiInFlightRef.current.has(entry.id),
    )
    if (pendingEntries.length === 0 || activeBatchControllerRef.current) return

    const runId = ++batchRunRef.current
    batchEntryIdsRef.current = new Set(pendingEntries.map((entry) => entry.id))
    for (const entry of pendingEntries) {
      updateEntry(entry.id, { status: 'ai-loading', batchTranslation: true, batchQueued: true, saveStatus: 'idle' })
    }
    setBatchProgress({ completed: 0, total: pendingEntries.length, status: 'running' })
    toast.info(`开始批量 AI 翻译 ${pendingEntries.length} 个单词，每批最多 ${AI_BATCH_SIZE} 个`)

    let completed = 0
    let stopped = false
    for (let index = 0; index < pendingEntries.length; index += AI_BATCH_SIZE) {
      if (runId !== batchRunRef.current) {
        stopped = true
        break
      }
      const batch = pendingEntries.slice(index, index + AI_BATCH_SIZE)
      const result = await translateBatchEntries(batch, runId)
      if (result === 'success') completed += batch.length
      if (runId === batchRunRef.current) {
        setBatchProgress({ completed, total: pendingEntries.length, status: 'running' })
      }
      if (result !== 'success') {
        stopped = true
        break
      }
    }

    if (runId === batchRunRef.current) {
      for (const entry of pendingEntries) {
        if (batchEntryIdsRef.current.has(entry.id)) {
          updateEntry(entry.id, { status: 'not-found', batchTranslation: false, batchQueued: false })
          batchEntryIdsRef.current.delete(entry.id)
        }
      }
      setBatchProgress({ completed, total: pendingEntries.length, status: stopped ? 'stopped' : 'done' })
      if (stopped) toast.info('本批已停止；未处理词条仍保留，失败项可单独重试。')
    }
  }, [entries, translateBatchEntries, updateEntry])

  const cancelAllTranslate = useCallback(() => {
    if (batchEntryIdsRef.current.size > 0) stopBatchRun()
    aiCancelledMapRef.current.forEach((flag) => {
      flag.current = true
    })
    aiAbortControllersRef.current.forEach((controller) => {
      controller.abort()
    })
  }, [stopBatchRun])

  const cancelTranslate = useCallback((entryId: string) => {
    if (batchEntryIdsRef.current.has(entryId)) {
      stopBatchRun()
      return
    }
    const flag = aiCancelledMapRef.current.get(entryId)
    if (flag) flag.current = true
    const controller = aiAbortControllersRef.current.get(entryId)
    if (controller) controller.abort()
  }, [stopBatchRun])

  const notFoundCount = entries.filter(
    (e) => e.word.trim() && e.status === 'not-found' && !e.aiTranslated,
  ).length
  const hasWords = entries.some((e) => e.word.trim())
  const hasAiWorkInProgress = entries.some((e) => e.status === 'ai-loading')

  return {
    entries,
    updateWord,
    retryPublicTranslation,
    addEntry,
    importWords,
    removeEntry,
    clearAll,
    saveEntry,
    cancelSave,
    translateSingle,
    translateAll,
    cancelTranslate,
    cancelAllTranslate,
    notFoundCount,
    hasWords,
    hasAiWorkInProgress,
    batchProgress,
  }
}
