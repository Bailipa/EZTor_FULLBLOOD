'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  ChevronRight,
  Database,
  Globe2,
  LockKeyhole,
  Search,
  Sparkles,
  Upload,
  Volume2,
  Plus,
  X,
} from 'lucide-react'
import type { WordResult } from '@/types/api'
import { useWordTranslation } from '@/hooks/useWordTranslation'
import { cn } from '@/lib/utils'
import { useBrandTheme } from '@/components/brand-theme-provider'

interface GuestWordInputCardProps {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  setResults: (results: WordResult[] | ((prev: WordResult[]) => WordResult[])) => void
  wordsInput: string
  setWordsInput: (input: string | ((prev: string) => string)) => void
  containerId?: string
  textareaId?: string
  onLockedFeatureClick?: (featureName: string) => void
  variant?: 'light' | 'dark'
}

interface NotFoundWord {
  word: string
  suggestions?: string[]
}

interface TranslateResultItem {
  word: string
  translation: string
  phonetic?: string
  pos?: string
  example?: string
  exampleTranslation?: string
  [key: string]: unknown
}

const recentQueries = ['apple', 'take for granted', 'inevitable']

export function GuestWordInputCard({
  isLoading,
  setIsLoading,
  setResults,
  wordsInput,
  setWordsInput,
  containerId,
  textareaId,
  onLockedFeatureClick,
  variant = 'light',
}: GuestWordInputCardProps) {
  const [notFoundWords, setNotFoundWords] = useState<NotFoundWord[]>([])
  const { brandTheme } = useBrandTheme()
  const isPurple = brandTheme === 'purple'
  const {
    pendingWords,
    setPendingWords,
    completedCount,
    fileInputRef,
    parseWords,
    validateWordCount,
    beginProcessing,
    finishProcessing,
    createKeyDownHandler,
  } = useWordTranslation({ wordsInput, setWordsInput })

  const handleProcess = async () => {
    if (isLoading) return

    const words = parseWords()
    if (words.length === 0) return
    if (!validateWordCount(words)) return

    setIsLoading(true)
    setNotFoundWords([])
    beginProcessing(words)

    try {
      setResults([])
      const response = await fetch('/api/public-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `请求失败: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success && data.data) {
        const inputWordMap = new Map<string, string>()
        words.forEach((word) => {
          inputWordMap.set(word.toLowerCase(), word)
        })

        const publicResults: WordResult[] = data.data.results.map((r: TranslateResultItem) => ({
          word: inputWordMap.get(r.word.toLowerCase()) || r.word,
          phonetic: r.phonetic || undefined,
          pos: r.pos || undefined,
          translation: r.translation,
          example: r.example || undefined,
          exampleTranslation: r.exampleTranslation || undefined,
          isPublic: true,
        }))

        const foundWords = new Set(
          data.data.results.map((r: TranslateResultItem) => r.word.toLowerCase()),
        )
        const notFound = words.filter((w) => !foundWords.has(w.toLowerCase()))

        const allResults: WordResult[] = [...publicResults]

        if (notFound.length > 0) {
          const notFoundWithSuggestions: NotFoundWord[] = await Promise.all(
            notFound.map(async (word) => {
              const suggestions = await findSimilarWords(word, data.data.results)
              return { word, suggestions }
            }),
          )
          setNotFoundWords(notFoundWithSuggestions)

          const notFoundResults: WordResult[] = notFound.map((word) => ({
            word,
            phonetic: '',
            pos: '未收录',
            translation: '⚠️ 该词暂未在公共词库收录，登录后可继续用 AI 查清楚',
            example: '',
            exampleTranslation: '',
            isPublic: false,
            isNotFound: true,
          }))

          allResults.push(...notFoundResults)
        }

        const orderedResults: WordResult[] = []
        const resultMap = new Map<string, WordResult>()

        allResults.forEach((result) => {
          resultMap.set(result.word.toLowerCase(), result)
        })

        words.forEach((word) => {
          const normalizedWord = word.toLowerCase()
          if (resultMap.has(normalizedWord)) {
            orderedResults.push(resultMap.get(normalizedWord)!)
            resultMap.delete(normalizedWord)
          }
        })

        resultMap.forEach((result) => {
          orderedResults.push(result)
        })

        finishProcessing(orderedResults.length)
        setResults(orderedResults)

        setWordsInput((prevInput) => {
          const lines = prevInput.split('\n')
          const foundSet = new Set(foundWords)
          return lines
            .filter((l) => {
              const normalized = l.trim().toLowerCase()
              return normalized && !foundSet.has(normalized)
            })
            .join('\n')
        })

        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'GUEST_TRANSLATE',
            metadata: {
              totalWords: words.length,
              foundWords: publicResults.length,
              notFoundWords: notFound.length,
              successRate: Math.round((publicResults.length / words.length) * 10000) / 100,
            },
          }),
        }).catch(() => {})
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (process.env.NODE_ENV === 'development') console.error('Translation error:', err)
      toast.error(message || '查询失败，请稍后重试')

      setResults((prev) => {
        if (prev.length > 0) return prev
        return words.map((w) => ({
          word: w,
          phonetic: '',
          pos: '查询失败',
          translation: `请求失败: ${message}`,
          example: '',
          exampleTranslation: '',
          isPublic: false,
        })) as WordResult[]
      })

      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'GUEST_TRANSLATE_ERROR',
          metadata: {
            error: message,
            wordCount: words.length,
          },
        }),
      }).catch(() => {})
    } finally {
      setIsLoading(false)
      setPendingWords([])
    }
  }

  const findSimilarWords = async (
    word: string,
    results: TranslateResultItem[],
  ): Promise<string[]> => {
    const allWords = results.map((r: TranslateResultItem) => r.word)
    const suggestions: string[] = []
    const lowerWord = word.toLowerCase()

    for (const w of allWords) {
      const lowerW = w.toLowerCase()
      if (lowerW.includes(lowerWord) || lowerWord.includes(lowerW)) {
        suggestions.push(w)
      } else if (levenshteinDistance(lowerWord, lowerW) <= 2) {
        suggestions.push(w)
      }
      if (suggestions.length >= 3) break
    }

    return suggestions
  }

  const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = []
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          )
        }
      }
    }
    return matrix[b.length][a.length]
  }

  const handleKeyDown = createKeyDownHandler(handleProcess)
  const isDark = variant === 'dark'

  const handleNewline = () => {
    const textarea = document.getElementById(textareaId || 'guest-word-input') as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    setWordsInput((prev) => prev.substring(0, start) + '\n' + prev.substring(end))
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + 1, start + 1)
    })
  }

  const removeLine = (lineIndex: number) => {
    setWordsInput((prev) => {
      const lines = prev.split('\n')
      lines.splice(lineIndex, 1)
      return lines.join('\n')
    })
  }

  const addLine = () => {
    setWordsInput((prev) => prev + '\n')
    requestAnimationFrame(() => {
      const textarea = document.getElementById(textareaId || 'guest-word-input') as HTMLTextAreaElement | null
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    })
  }

  const MAX_WORD_COUNT = 50

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const lines = newValue.split('\n')
    const nonEmptyLines = lines.filter((l) => l.trim())

    if (nonEmptyLines.length > MAX_WORD_COUNT) {
      toast.error(`单次最多只能输入 ${MAX_WORD_COUNT} 个单词或词组，仅保留前 ${MAX_WORD_COUNT} 个`)

      let count = 0
      const truncatedLines = lines.filter((l) => {
        if (l.trim()) {
          count++
          return count <= MAX_WORD_COUNT
        }
        return true
      })
      const truncated = truncatedLines.join('\n')
      setWordsInput(truncated)

      const textareaEl = document.getElementById(textareaId || 'guest-word-input') as HTMLTextAreaElement | null
      if (textareaEl) {
        textareaEl.selectionStart = truncated.length
        textareaEl.selectionEnd = truncated.length
      }
      return
    }

    setWordsInput(newValue)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setWordsInput(text)
    }
    reader.readAsText(file)
  }

  return (
    <>
      <Card
        id={containerId}
        className={cn(
          'overflow-hidden rounded-[20px] shadow-sm',
          isDark
            ? 'border-white/20 bg-white/[0.035] text-white'
            : 'border-border bg-card text-slate-950',
        )}
      >
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.02fr)]">
            <div
              className={cn(
                'border-b p-4 sm:p-5 lg:border-b-0 lg:border-r',
                isDark ? 'border-white/12' : 'border-border',
              )}
            >
              <div className={cn('flex items-center gap-2 text-[15px] font-semibold', isDark ? 'text-white' : 'text-foreground')}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
                  <Globe2 className={cn('h-4 w-4', isDark ? 'text-cyan-300' : 'text-primary')} />
                </div>
                <span>查询</span>
                <span className={cn('text-[13px] font-medium', isDark ? 'text-slate-400' : 'text-caption')}>（游客模式）</span>
              </div>
              <p className={cn('mt-2 text-[13px] leading-[1.6]', isDark ? 'text-slate-400' : 'text-caption')}>
                每次可查询多个单词，每行一个
              </p>

              <div className="mt-5">
                {isLoading ? (
                  <div
                    className={cn(
                      'min-h-[64px] rounded-2xl border p-4',
                      isDark ? 'border-white/12 bg-black/10' : 'border-border bg-muted/50',
                    )}
                    role="status"
                    aria-live="polite"
                    aria-label="正在查询中"
                  >
                    <div className="flex flex-wrap gap-2">
                      {pendingWords.map((word, index) => (
                        <span
                          key={`${index}-${word}`}
                          data-word={word.toLowerCase()}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-sm font-medium animate-[fadeIn_0.25s_ease-in-out]',
                            isDark
                              ? 'border-blue-300/20 bg-blue-400/10 text-blue-100'
                              : 'border-primary/20 bg-accent text-primary',
                          )}
                        >
                          {word}
                        </span>
                      ))}
                    </div>

                    {pendingWords.length === 0 && (
                      <div className="flex min-h-[150px] flex-col items-center justify-center py-8 animate-[fadeIn_0.3s_ease-in-out]">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Sparkles className="h-6 w-6 text-green-500" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">查询完成</span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          已找到 {completedCount} 个结果
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <><div className="relative">
                    <Textarea
                      id={textareaId}
                      placeholder="每行一个单词或短语，回车换行"
                      className={cn(
                        'min-h-[120px] resize-none rounded-xl pr-[8.5rem] pt-4 text-sm leading-6 shadow-inner lg:min-h-[54px]',
                        isDark
                          ? 'border-white/12 bg-black/10 text-white placeholder:text-slate-500'
                          : 'border-border bg-muted/30 text-foreground',
                      )}
                      style={{ whiteSpace: 'pre-wrap' }}
                      value={wordsInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                      aria-label="输入要查询的单词"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".txt"
                      className="hidden"
                      aria-label="导入 TXT"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute right-14 top-2.5 rounded-full',
                        isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-caption hover:text-foreground',
                      )}
                      onClick={handleNewline}
                      title="换行"
                      aria-label="换行"
                      disabled={isLoading}
                    >
                      <span className="text-sm font-bold">⏎</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute right-[6.5rem] top-2.5 rounded-full',
                        isDark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-caption hover:text-foreground',
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      title="导入 TXT"
                      aria-label="导入 TXT"
                      disabled={isLoading}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute right-2 top-2.5 rounded-full',
                        isDark ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:text-primary',
                      )}
                      onClick={handleProcess}
                      title="开始查词"
                      aria-label="开始查词"
                      disabled={isLoading || !wordsInput.trim()}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>

                  {wordsInput.trim() && (
                    <div
                      className={cn(
                        'mt-3 rounded-xl border p-3 text-left',
                        isDark
                          ? 'border-white/12 bg-black/10'
                          : 'border-border bg-muted/30',
                      )}
                    >
                      <div className="flex flex-wrap gap-2 justify-start">
                        {wordsInput.split('\n').map((line, originalIndex) => {
                          const word = line.trim()
                          if (!word) return null
                          return (
                            <span
                              key={`chip-${originalIndex}-${word}`}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium',
                                isDark
                                  ? 'border-blue-300/20 bg-blue-400/10 text-blue-100'
                                  : 'border-primary/20 bg-accent text-primary',
                              )}
                            >
                              {word}
                              <button
                                type="button"
                                onClick={() => removeLine(originalIndex)}
                                className={cn(
                                  'ml-0.5 rounded-full p-0.5 transition-colors',
                                  isDark
                                    ? 'text-blue-200/60 hover:bg-blue-300/20 hover:text-blue-100'
                                    : 'text-primary/60 hover:bg-primary/20 hover:text-primary',
                                )}
                                aria-label={`删除 ${word}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={addLine}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs transition-colors',
                            isDark
                              ? 'border-slate-500/40 text-slate-400 hover:border-blue-300/40 hover:text-blue-200'
                              : 'border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary',
                          )}
                        >
                          <Plus className="h-3 w-3" />
                          添加单词/词组
                        </button>
                        <span className={cn('text-xs', isDark ? 'text-slate-500' : 'text-caption')}>
                          {wordsInput.split('\n').filter((l) => l.trim()).length} 个词
                        </span>
                      </div>
                    </div>
                  )}
                </>)}
              </div>

              <div className="mt-4 hidden lg:block">
                <p className={cn('mb-2 text-[13px] font-medium', isDark ? 'text-slate-400' : 'text-caption')}>最近查询</p>
                <div className="space-y-2">
                  {recentQueries.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-[14px] transition-colors',
                        isDark
                          ? 'border-white/12 bg-white/[0.03] text-slate-200 hover:border-blue-300/30 hover:bg-blue-500/10'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent',
                      )}
                      onClick={() => setWordsInput(item)}
                    >
                      <span>{item}</span>
                      <ChevronRight className="h-4 w-4 text-caption" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 lg:hidden">
                <Button
                  onClick={handleProcess}
                  disabled={isLoading || !wordsInput.trim()}
                  className="h-12 w-full rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-md hover:brightness-90"
                  aria-label="开始查词"
                >
                  {isLoading ? (
                    <>
                      <Search className="mr-2 h-4 w-4 animate-spin" />
                      查询中...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      开始查词
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="hidden lg:flex lg:flex-col lg:justify-between p-4 sm:p-5">
              <div>
                <div className={cn('flex items-center gap-2 text-[15px] font-semibold', isDark ? 'text-white' : 'text-foreground')}>
                  <LockKeyhole className={cn('h-4 w-4', isDark ? 'text-slate-400' : 'text-caption')} />
                  <span>查询结果</span>
                  <span className={cn('text-[13px] font-medium', isDark ? 'text-slate-400' : 'text-caption')}>（登录后解锁更多）</span>
                </div>

                <div
                  className={cn(
                    'mt-4 rounded-2xl border p-4 shadow-sm',
                    isDark ? 'border-white/12 bg-black/10' : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('text-xl font-bold tracking-tight sm:text-2xl', isDark ? 'text-white' : 'text-foreground')}>
                      inevitable
                    </span>
                    <button
                      type="button"
                      className={cn(
                        'rounded-full p-2 transition-colors',
                        isDark ? 'text-slate-400 hover:bg-white/10 hover:text-blue-300' : 'text-caption hover:bg-accent hover:text-primary',
                      )}
                      aria-label="播放 inevitable 的发音"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn('font-mono text-[13px]', isDark ? 'text-slate-400' : 'text-caption')}>
                      /ɪˈnevɪtəbl/
                    </span>
                    <Badge variant="secondary">adj.</Badge>
                    <span className={cn('rounded-full px-3 py-1 text-[13px] font-medium', isDark ? 'bg-emerald-400/15 text-emerald-200' : 'bg-accent text-primary')}>
                      不可避免的
                    </span>
                  </div>

                  <div className={cn('mt-4 border-t pt-4', isDark ? 'border-white/10' : 'border-border')}>
                    <p className={cn('text-[13px] font-semibold', isDark ? 'text-white' : 'text-foreground')}>中文释义</p>
                    <p className={cn('mt-1.5 text-[14px] leading-[1.7]', isDark ? 'text-slate-300' : 'text-muted-foreground')}>
                      不可避免的；必然会发生的
                    </p>
                  </div>

                  <div className={cn('mt-4 border-t pt-4', isDark ? 'border-white/10' : 'border-border')}>
                    <p className={cn('text-[13px] font-semibold', isDark ? 'text-white' : 'text-foreground')}>例句</p>
                    <p className={cn('mt-1.5 text-[14px] leading-[1.7]', isDark ? 'text-slate-200' : 'text-muted-foreground')}>
                      In the digital age, change is inevitable.
                    </p>
                    <p className={cn('mt-1 text-[13px] leading-[1.7]', isDark ? 'text-slate-400' : 'text-caption')}>
                      在数字时代，变化是不可避免的。
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={cn(
                    'mt-4 flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-colors',
                    isDark
                      ? 'border-emerald-300/25 bg-emerald-400/10 hover:bg-emerald-400/15'
                      : 'border-primary/20 bg-accent/60 hover:bg-accent',
                    !onLockedFeatureClick && 'cursor-default',
                  )}
                  onClick={() => onLockedFeatureClick?.('AI 翻译、生词本与默写复习')}
                >
                  <div>
                    <p className={cn('text-[14px] font-semibold', isDark ? 'text-emerald-100' : 'text-primary')}>
                      AI 翻译（登录后解锁）
                    </p>
                    <p className={cn('mt-1 text-[13px]', isDark ? 'text-slate-400' : 'text-caption')}>
                      更自然的上下文翻译与用法解释
                    </p>
                  </div>
                  <LockKeyhole className={cn('h-5 w-5', isDark ? 'text-emerald-100' : 'text-primary')} />
                </button>
              </div>

              <CardFooter className="mt-5 flex items-center justify-between gap-3 px-0 pb-0">
                <span className={cn('text-[12px]', isDark ? 'text-slate-500' : 'text-caption')}>
                  公共词库 · 直接可查
                </span>
                <Button
                  onClick={handleProcess}
                  disabled={isLoading || !wordsInput.trim()}
                  className="h-10 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-90"
                  aria-label="开始查词"
                >
                  {isLoading ? (
                    <>
                      <Search className="h-4 w-4 animate-spin" />
                      查询中...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      开始查词
                    </>
                  )}
                </Button>
              </CardFooter>
            </div>
          </div>
        </CardContent>
      </Card>

      {notFoundWords.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-4 shadow-sm animate-[fadeIn_0.3s_ease-in-out]">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
              <AlertCircle className="h-4 w-4 text-caption" />
              这组词里有暂未收录的内容
            </div>
            {notFoundWords.map((item, index) => (
              <div key={`${index}-${item.word}`} className="text-[14px]">
                <span className="font-medium text-foreground">{item.word}</span>
                {item.suggestions && item.suggestions.length > 0 && (
                  <span className="ml-2 text-caption">
                    → 您是否想查: {item.suggestions.join(', ')}
                  </span>
                )}
              </div>
            ))}
            <p className="mt-1 text-[12px] text-caption">
              💡 该词暂未收录，登录后可继续用 AI 查清楚。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
