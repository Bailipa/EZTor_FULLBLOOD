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
}

interface UseRealtimeTranslationOptions {
  showPos: boolean
  showExample: boolean
  targetGroupId: string
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
  }
}

export function useRealtimeTranslation({ showPos, showExample, targetGroupId }: UseRealtimeTranslationOptions) {
  const [entries, setEntries] = useState<WordEntry[]>([createEmptyEntry()])
  const debounceMapRef = useRef<Map<string, DebouncedFunction>>(new Map())
  const abortControllerRef = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    return () => {
      debounceMapRef.current.forEach((fn) => fn.cancel())
      abortControllerRef.current.forEach((controller) => controller.abort())
    }
  }, [])

  const updateEntry = useCallback((entryId: string, updates: Partial<WordEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
    )
  }, [])

  const fetchPublicTranslation = useCallback(
    async (entryId: string, word: string) => {
      const existingController = abortControllerRef.current.get(entryId)
      if (existingController) {
        existingController.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current.set(entryId, controller)

      updateEntry(entryId, { status: 'loading' })

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
          })
        } else {
          updateEntry(entryId, {
            translation: '',
            phonetic: undefined,
            pos: undefined,
            example: undefined,
            exampleTranslation: undefined,
            status: 'not-found',
            isPublic: false,
          })
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        updateEntry(entryId, { status: 'error' })
      } finally {
        abortControllerRef.current.delete(entryId)
      }
    },
    [updateEntry],
  )

  const getDebouncedFetch = useCallback(
    (entryId: string) => {
      if (!debounceMapRef.current.has(entryId)) {
        const debouncedFn = createDebouncedFetch((word: string) => {
          if (word.trim().length === 0) {
            updateEntry(entryId, {
              translation: '',
              phonetic: undefined,
              pos: undefined,
              example: undefined,
              exampleTranslation: undefined,
              status: 'idle',
              isPublic: false,
            })
            return
          }
          fetchPublicTranslation(entryId, word)
        }, 300)

        debounceMapRef.current.set(entryId, debouncedFn)
      }

      return debounceMapRef.current.get(entryId)!
    },
    [fetchPublicTranslation, updateEntry],
  )

  const updateWord = useCallback(
    (entryId: string, newWord: string) => {
      updateEntry(entryId, { word: newWord })
      const debouncedFetch = getDebouncedFetch(entryId)
      debouncedFetch(newWord)
    },
    [getDebouncedFetch, updateEntry],
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
  }, [])

  const translateSingle = useCallback(
    async (entryId: string) => {
      const entry = entries.find((e) => e.id === entryId)
      if (!entry || !entry.word.trim()) return

      updateEntry(entryId, { status: 'ai-loading' })

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            words: [entry.word.trim()],
            options: { showPos, showExample },
            targetGroupId: targetGroupId === 'none' ? null : targetGroupId,
          }),
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
          })

          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: [lastValidResult] }),
          }).catch(() => {})
        } else {
          updateEntry(entryId, { status: 'error' })
          toast.error('翻译失败，请重试')
        }
      } catch (error: unknown) {
        const err = error as Error
        if (err.name === 'AbortError') {
          toast.error('请求超时')
        } else {
          toast.error(err.message || '翻译失败')
        }
        updateEntry(entryId, { status: 'error' })
      }
    },
    [entries, showPos, showExample, targetGroupId, updateEntry],
  )

  const translateAll = useCallback(async () => {
    const notFoundEntries = entries.filter((e) => e.word.trim() && e.status === 'not-found')

    if (notFoundEntries.length === 0) {
      toast.info('没有需要AI翻译的单词')
      return
    }

    toast.info(`开始AI翻译 ${notFoundEntries.length} 个单词...`)

    for (const entry of notFoundEntries) {
      await translateSingle(entry.id)
    }
  }, [entries, translateSingle])

  const notFoundCount = entries.filter((e) => e.word.trim() && e.status === 'not-found').length
  const hasWords = entries.some((e) => e.word.trim())

  return {
    entries,
    updateWord,
    addEntry,
    removeEntry,
    translateSingle,
    translateAll,
    notFoundCount,
    hasWords,
  }
}
