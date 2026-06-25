'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { WordResult } from '@/types/api'

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
  saveStatus: 'idle' | 'in-vocabulary' | 'pending' | 'saving' | 'saved'
  aiTranslated?: boolean
}

interface UseRealtimeTranslationOptions {
  showPos: boolean
  showExample: boolean
  targetGroupId: string
  isGuest?: boolean
}

type DebouncedFunction = {
  (word: string): void
  cancel: () => void
}

function createDebouncedFetch(fn: (word: string) => void, delay: number): DebouncedFunction {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debouncedFn = (word: string) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(word)
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

const AI_BATCH_CONCURRENCY = 5

export function useRealtimeTranslation({ showPos, showExample, targetGroupId, isGuest }: UseRealtimeTranslationOptions) {
  const [entries, setEntries] = useState<WordEntry[]>([createEmptyEntry()])
  const debounceMapRef = useRef<Map<string, DebouncedFunction>>(new Map())
  const abortControllerRef = useRef<Map<string, AbortController>>(new Map())
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const savedWordsRef = useRef<Set<string>>(new Set())
  const aiInFlightRef = useRef<Set<string>>(new Set())
  const aiAbortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const aiCancelledMapRef = useRef<Map<string, { current: boolean }>>(new Map())

  useEffect(() => {
    return () => {
      debounceMapRef.current.forEach((fn) => fn.cancel())
      abortControllerRef.current.forEach((controller) => controller.abort())
      saveTimersRef.current.forEach((timer) => clearTimeout(timer))
      aiAbortControllersRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  const updateEntry = useCallback((entryId: string, updates: Partial<WordEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    )
  }, [])

  const cancelSaveTimer = useCallback((entryId: string) => {
    const timer = saveTimersRef.current.get(entryId)
    if (timer) {
      clearTimeout(timer)
      saveTimersRef.current.delete(entryId)
    }
  }, [])

  const startSaveTimer = useCallback(
    (entryId: string, word: string, translation: string, phonetic?: string, pos?: string, example?: string, exampleTranslation?: string) => {
      cancelSaveTimer(entryId)

      const timer = setTimeout(async () => {
        saveTimersRef.current.delete(entryId)

        const wordLower = word.trim().toLowerCase()
        if (savedWordsRef.current.has(wordLower)) {
          updateEntry(entryId, { saveStatus: 'idle' })
          return
        }

        updateEntry(entryId, { saveStatus: 'saving' })

        try {
          const syncPayload: WordResult = {
            word: word.trim(),
            translation,
            phonetic: phonetic || undefined,
            pos: pos || undefined,
            example: example || undefined,
            exampleTranslation: exampleTranslation || undefined,
          }

          if (isInvalidForLibrary(syncPayload)) {
            updateEntry(entryId, { saveStatus: 'idle' })
            return
          }

          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: [syncPayload] }),
          })

          if (res.ok) {
            savedWordsRef.current.add(wordLower)
            updateEntry(entryId, { saveStatus: 'saved' })
            setTimeout(() => {
              updateEntry(entryId, { saveStatus: 'idle' })
            }, 2000)
          } else {
            updateEntry(entryId, { saveStatus: 'idle' })
          }
        } catch {
          updateEntry(entryId, { saveStatus: 'idle' })
        }
      }, 3000)

      saveTimersRef.current.set(entryId, timer)
    },
    [cancelSaveTimer, updateEntry],
  )

  const fetchPublicTranslation = useCallback(
    async (entryId: string, word: string) => {
      const existingController = abortControllerRef.current.get(entryId)
      if (existingController) {
        existingController.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current.set(entryId, controller)

      cancelSaveTimer(entryId)
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

        if (data.success && data.data.results && data.data.results.length > 0) {
          const result = data.data.results[0]
          updateEntry(entryId, {
            translation: result.translation,
            phonetic: result.phonetic,
            pos: result.pos,
            example: result.example,
            exampleTranslation: result.exampleTranslation,
            status: 'found',
            isPublic: true,
            saveStatus: 'idle',
          })

          if (!isGuest) {
            try {
              const checkRes = await fetch(`/api/vocabulary/check?word=${encodeURIComponent(word.trim())}`)
              const checkData = await checkRes.json()

              if (checkData.success && checkData.exists) {
                updateEntry(entryId, { saveStatus: 'in-vocabulary' })
              } else {
                updateEntry(entryId, { saveStatus: 'pending' })
                startSaveTimer(
                  entryId,
                  word,
                  result.translation,
                  result.phonetic,
                  result.pos,
                  result.example,
                  result.exampleTranslation,
                )
              }
            } catch {
              updateEntry(entryId, { saveStatus: 'pending' })
              startSaveTimer(
                entryId,
                word,
                result.translation,
                result.phonetic,
                result.pos,
                result.example,
                result.exampleTranslation,
              )
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
          })
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        updateEntry(entryId, { status: 'error', saveStatus: 'idle' })
      } finally {
        abortControllerRef.current.delete(entryId)
      }
    },
    [updateEntry, cancelSaveTimer, startSaveTimer, isGuest],
  )

  const getDebouncedFetch = useCallback(
    (entryId: string) => {
      if (!debounceMapRef.current.has(entryId)) {
        const debouncedFn = createDebouncedFetch((word: string) => {
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
          fetchPublicTranslation(entryId, word)
        }, 300)

        debounceMapRef.current.set(entryId, debouncedFn)
      }

      return debounceMapRef.current.get(entryId)!
    },
    [fetchPublicTranslation, updateEntry, cancelSaveTimer],
  )

  const updateWord = useCallback(
    (entryId: string, newWord: string) => {
      cancelSaveTimer(entryId)
      updateEntry(entryId, { word: newWord, saveStatus: 'idle' })
      const debouncedFetch = getDebouncedFetch(entryId)
      debouncedFetch(newWord)
    },
    [getDebouncedFetch, updateEntry, cancelSaveTimer],
  )

  const addEntry = useCallback(() => {
    setEntries((prev) => {
      const lastEntry = prev[prev.length - 1]
      if (lastEntry && lastEntry.word.trim() === '') {
        return prev
      }
      return [...prev, createEmptyEntry()]
    })
  }, [])

  const removeEntry = useCallback((entryId: string) => {
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
  }, [cancelSaveTimer])

  const clearAll = useCallback(() => {
    debounceMapRef.current.forEach((fn) => fn.cancel())
    debounceMapRef.current.clear()

    abortControllerRef.current.forEach((controller) => controller.abort())
    abortControllerRef.current.clear()

    saveTimersRef.current.forEach((timer) => clearTimeout(timer))
    saveTimersRef.current.clear()

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
  }, [])

  const translateSingle = useCallback(
    async (entryId: string) => {
      const entry = entries.find((e) => e.id === entryId)
      if (!entry || !entry.word.trim()) return

      // 如果该 entry 已有在飞 AI 翻译，把它当作"被新一次顶掉"
      const existingFlag = aiCancelledMapRef.current.get(entryId)
      if (existingFlag) existingFlag.current = true
      const existingController = aiAbortControllersRef.current.get(entryId)
      if (existingController) existingController.abort()

      const cancelledByUser = { current: false }
      const controller = new AbortController()
      aiAbortControllersRef.current.set(entryId, controller)
      aiCancelledMapRef.current.set(entryId, cancelledByUser)

      cancelSaveTimer(entryId)
      updateEntry(entryId, { status: 'ai-loading', saveStatus: 'idle' })

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

        if (lastValidResult) {
          updateEntry(entryId, {
            translation: lastValidResult.translation,
            phonetic: lastValidResult.phonetic,
            pos: lastValidResult.pos,
            example: lastValidResult.example,
            exampleTranslation: lastValidResult.exampleTranslation,
            status: 'found',
            isPublic: false,
            aiTranslated: true,
          })

          if (!isInvalidForLibrary(lastValidResult)) {
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results: [lastValidResult] }),
            }).catch(() => {})
          }
        } else {
          updateEntry(entryId, { status: 'error' })
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
        updateEntry(entryId, { status: 'error' })
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
    [entries, showPos, showExample, targetGroupId, updateEntry, cancelSaveTimer],
  )

  const translateAll = useCallback(async () => {
    const pendingEntries = entries.filter(
      (e) =>
        e.word.trim() &&
        e.status === 'not-found' &&
        !e.aiTranslated &&
        !aiInFlightRef.current.has(e.id),
    )

    if (pendingEntries.length === 0) {
      return
    }

    const hadPriorWork = aiInFlightRef.current.size > 0
    if (!hadPriorWork) {
      toast.info(`开始AI翻译 ${pendingEntries.length} 个单词...`)
    }

    // 并发执行（限流 AI_BATCH_CONCURRENCY 个）。每个 worker 串行处理分到自己的子集。
    const concurrency = Math.min(AI_BATCH_CONCURRENCY, pendingEntries.length)
    const chains = Array.from({ length: concurrency }, (_, workerIndex) =>
      (async () => {
        for (let i = workerIndex; i < pendingEntries.length; i += concurrency) {
          const entry = pendingEntries[i]
          aiInFlightRef.current.add(entry.id)
          try {
            await translateSingle(entry.id)
          } finally {
            aiInFlightRef.current.delete(entry.id)
          }
        }
      })(),
    )
    await Promise.allSettled(chains)
  }, [entries, translateSingle])

  const cancelTranslate = useCallback((entryId: string) => {
    const flag = aiCancelledMapRef.current.get(entryId)
    if (flag) flag.current = true
    const controller = aiAbortControllersRef.current.get(entryId)
    if (controller) controller.abort()
  }, [])

  const cancelAllTranslate = useCallback(() => {
    aiCancelledMapRef.current.forEach((flag) => {
      flag.current = true
    })
    aiAbortControllersRef.current.forEach((controller) => {
      controller.abort()
    })
  }, [])

  const notFoundCount = entries.filter(
    (e) => e.word.trim() && e.status === 'not-found' && !e.aiTranslated,
  ).length
  const hasWords = entries.some((e) => e.word.trim())
  const hasAiWorkInProgress = entries.some((e) => e.status === 'ai-loading')

  return {
    entries,
    updateWord,
    addEntry,
    removeEntry,
    clearAll,
    translateSingle,
    translateAll,
    cancelTranslate,
    cancelAllTranslate,
    notFoundCount,
    hasWords,
    hasAiWorkInProgress,
  }
}
