'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { saveToStorage, loadFromStorage } from '@/lib/storage'

export interface UseWordTranslationOptions {
  wordsInput: string
  setWordsInput: (input: string | ((prev: string) => string)) => void
}

export function useWordTranslation({ wordsInput, setWordsInput }: UseWordTranslationOptions) {
  const [pendingWords, setPendingWords] = useState<string[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = loadFromStorage<string>('vocab_wordsInput', '')
    if (saved) setWordsInput(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveToStorage('vocab_wordsInput', wordsInput)
  }, [wordsInput])

  const parseWords = useCallback((): string[] => {
    if (!wordsInput.trim()) return []
    return wordsInput
      .split('\n')
      .map((w) => w.trim().replace(/\s+/g, ' '))
      .filter((w) => w.length > 0)
  }, [wordsInput])

  const validateWordCount = useCallback((words: string[], maxCount = 50): boolean => {
    if (words.length > maxCount) {
      toast.error(`单次最多只能查询 ${maxCount} 个单词或短语，请分批查询！`)
      return false
    }
    return true
  }, [])

  const beginProcessing = useCallback((words: string[]) => {
    setPendingWords(words)
    setCompletedCount(0)
  }, [])

  const finishProcessing = useCallback((count: number) => {
    setPendingWords([])
    setCompletedCount(count)
  }, [])

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const createKeyDownHandler = useCallback((handleProcess: () => void) => {
    return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleProcess()
      }
    }
  }, [])

  return {
    pendingWords,
    setPendingWords,
    completedCount,
    setCompletedCount,
    fileInputRef,
    parseWords,
    validateWordCount,
    beginProcessing,
    finishProcessing,
    clearFileInput,
    createKeyDownHandler,
  }
}
