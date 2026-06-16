'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Check, X, Loader2, Volume2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { speakText } from '@/lib/ttsBrowser'
import Link from 'next/link'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip'

interface FlashcardWord {
  word: string
  translation: string
  phonetic?: string
  pos?: string
  example?: string
  exampleTranslation?: string
  [key: string]: unknown
}

export function FullscreenFlashcard({ onInteraction }: { onInteraction?: () => void } = {}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { currentStep, isActive, nextStep } = useOnboarding()
  const [words, setWords] = useState<FlashcardWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isTranslationExpanded, setIsTranslationExpanded] = useState(false)
  const knowButtonRef = useRef<HTMLButtonElement>(null)
  const dontKnowButtonRef = useRef<HTMLButtonElement>(null)
  const showAnswerButtonRef = useRef<HTMLButtonElement>(null)

  const fetchWords = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const url = `/api/flashcard/public?limit=20&t=${Date.now()}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.data) {
        setWords(data.data)
        setCurrentIndex(0)
        setShowAnswer(false)
      } else if (!data.success) {
        setFetchError(data.error || '获取单词失败')
      }
    } catch (error) {
      setFetchError('网络错误，请检查连接后重试')
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch words:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWords()

    // 处理浏览器前进/后退缓存（bfcache）恢复
    // 每次 pageshow 都重新获取数据，因为可能是从 bfcache 恢复
    const handlePageShow = () => {
      fetchWords()
    }

    // 处理页面可见性变化（从其他标签页或页面返回）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && words.length === 0) {
        fetchWords()
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchWords, words.length])

  const currentWord = words[currentIndex]

  const handleSaveAndNext = async (category: 'known' | 'unknown') => {
    if (!currentWord) return
    onInteraction?.()

    if (status !== 'authenticated' || !session?.user) {
      // 游客模式：只切换到下一个单词
      if (currentIndex < words.length - 1) {
        setCurrentIndex((prev) => prev + 1)
        setShowAnswer(false)
        setIsTranslationExpanded(false)
      } else {
        fetchWords()
      }
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/flashcard/save-and-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: currentWord.word,
          category,
          isCorrect: category === 'known'
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('登录已过期，请重新登录')
        } else {
          toast.error(`[${res.status}] ${data.error || '保存失败'}`)
        }
        return
      }

      if (data.success) {
        // 如果是引导步骤1，推进步骤并跳转到默写页
        if (isActive && currentStep === 1) {
          nextStep()
          router.push('/dictation')
          return
        }

        // 切换到下一个单词
        if (currentIndex < words.length - 1) {
          setCurrentIndex((prev) => prev + 1)
          setShowAnswer(false)
          setIsTranslationExpanded(false)
        } else {
          fetchWords()
        }
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (error) {
      toast.error('网络错误，请重试')
      if (process.env.NODE_ENV === 'development') console.error('Failed to save word:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const playAudio = (text: string) => {
    speakText(text)
  }

  const isGuest = status !== 'authenticated' || !session?.user

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <div className="flex items-center gap-2">
          {!isLoading && words.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {words.length}
            </span>
          )}
        </div>
      </div>

      {/* 闪卡内容 - 可滚动 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : words.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {fetchError || '公共词库中暂时没有单词'}
            </p>
            <Button onClick={fetchWords} variant="outline">
              重新加载
            </Button>
          </div>
        ) : (
          <Card className="w-full max-w-md mx-auto shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-3 w-full mb-4">
                <h2 className="text-4xl font-bold text-foreground tracking-wide text-center break-words">
                  {currentWord.word}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-10 w-10 hover:bg-primary/10 flex-shrink-0"
                  onClick={() => playAudio(currentWord.word)}
                >
                  <Volume2 className="w-5 h-5 text-primary" />
                </Button>
              </div>

              {currentWord.phonetic && (
                <p className="text-sm text-muted-foreground font-mono mb-4 text-center">
                  [{currentWord.phonetic}]
                </p>
              )}

              <div
                className={`transition-all duration-300 w-full ${showAnswer ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
              >
                {showAnswer && (
                  <div className="w-full text-center break-words space-y-4">
                    <div>
                      <p className={`text-lg font-medium text-foreground ${!isTranslationExpanded ? 'line-clamp-3' : ''}`}>
                        {currentWord.translation}
                      </p>
                      {currentWord.translation && currentWord.translation.length > 100 && (
                        <button
                          onClick={() => setIsTranslationExpanded(!isTranslationExpanded)}
                          className="text-sm text-primary hover:underline mt-1"
                        >
                          {isTranslationExpanded ? '收起' : '展开全部'}
                        </button>
                      )}
                    </div>

                    {currentWord.example && (
                      <div className="pt-4 border-t border-border/50 text-sm space-y-2">
                        <p className="text-muted-foreground italic">
                          &quot;{currentWord.example}&quot;
                        </p>
                        {currentWord.exampleTranslation && (
                          <p className="text-muted-foreground text-xs">
                            {currentWord.exampleTranslation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 底部按钮 - 固定 */}
      {!isLoading && words.length > 0 && (
        <div className="p-4 pb-6 shrink-0">
          {!showAnswer ? (
            <div className="flex w-full gap-3 max-w-md mx-auto">
              <Button
                ref={showAnswerButtonRef}
                className="flex-1 h-12 text-lg"
                onClick={() => { setShowAnswer(true); onInteraction?.() }}
              >
                显示答案
              </Button>
            </div>
          ) : (
            <div className="flex w-full gap-3 max-w-md mx-auto">
              <Button
                ref={dontKnowButtonRef}
                variant="outline"
                className="flex-1 h-12 text-base border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => handleSaveAndNext('unknown')}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <X className="w-5 h-5 mr-2" />
                )}
                不认识
              </Button>
              <Button
                ref={knowButtonRef}
                className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleSaveAndNext('known')}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 mr-2" />
                )}
                认识
              </Button>
            </div>
          )}

          {/* 引导步骤 1：闪卡使用提示 */}
          {isActive && currentStep === 1 && (
            <OnboardingTooltip
              targetRef={showAnswer ? knowButtonRef : showAnswerButtonRef}
              title="闪卡学习"
              description={showAnswer
                ? "点击'认识'表示你知道这个词，点击'不认识'表示你不知道。"
                : "点击'显示答案'查看单词释义。"
              }
              position="top"
            />
          )}

          {/* 游客登录提示 */}
          {isGuest && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                登录后可保存学习进度 →{' '}
                <Link href="/auth/signin" className="text-primary underline underline-offset-2">
                  立即登录
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
