'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, BookOpen, ChevronDown, Loader2, PenTool, RefreshCw } from 'lucide-react'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'

interface MistakeWord {
  id: string
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  correctCount: number
  incorrectCount: number
}

const PAGE_SIZE = 50

export interface RecentMistake {
  word: string
  translation: string
  status: 'saving' | 'saved' | 'unconfirmed'
}

export function MistakeNotebook({ refreshKey = 0, recentMistake, onPractice, onConfigure, practiceDisabled = false }: { refreshKey?: number; recentMistake?: RecentMistake | null; onPractice?: () => void; onConfigure?: () => void; practiceDisabled?: boolean }) {
  const router = useRouter()
  const { currentStep, isActive, nextStep } = useOnboarding()
  const [words, setWords] = useState<MistakeWord[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const requestGeneration = useRef(0)

  useEffect(() => {
    let active = true
    requestGeneration.current += 1
    setLoadingMore(false)
    setLoadMoreError(null)
    setLoading(true)
    setError(null)

    fetch(`/api/dictation/mistakes?limit=${PAGE_SIZE}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error || '加载错词失败')
        }
        if (!active) return
        setWords(result.data)
        setTotal(result.pagination.total)
        setNextCursor(result.pagination.nextCursor)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : '加载错词失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [retry, refreshKey])

  const loadMore = async () => {
    if (!nextCursor || loadingMore || loading) return
    const generation = requestGeneration.current
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), cursor: nextCursor })
      const response = await fetch(`/api/dictation/mistakes?${params}`)
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '加载更多错词失败')
      if (generation !== requestGeneration.current) return
      setWords((current) => [...current, ...result.data.filter((word: MistakeWord) => !current.some((item) => item.id === word.id))])
      setNextCursor(result.pagination.nextCursor)
    } catch (cause: unknown) {
      if (generation === requestGeneration.current) setLoadMoreError(cause instanceof Error ? cause.message : '加载更多错词失败')
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false)
    }
  }

  return (
    <div data-review-notebook className="space-y-4">
          {isActive && currentStep === 3 && (
            <Card className="border-primary/40 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <h2 className="font-semibold">错词本</h2>
                <p className="text-sm text-muted-foreground">
                  这里会长期记录默写中答错的单词，方便你集中复习。
                </p>
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => {
                    nextStep()
                    router.push('/history')
                  }}
                >
                  继续查看生词本
                </Button>
              </CardContent>
            </Card>
          )}
          <header data-workspace-toolbar className="indigo-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <AlertCircle className="size-6 text-primary" />
                错词本
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                汇总默写答错过的单词，优先显示错误次数较多的词。
              </p>
            </div>
            {loading || total === 0 ? (
              <Button disabled className="w-full sm:w-auto">
                <PenTool />
                错词专练（最多 50 个）
              </Button>
            ) : (
              onPractice ? <Button onClick={onPractice} disabled={practiceDisabled} className="w-full sm:w-auto"><PenTool />错词专练（最多 50 个）</Button> : (
                <Link href="/dictation?source=mistakes"><Button className="w-full sm:w-auto"><PenTool />错词专练（最多 50 个）</Button></Link>
              )
            )}
          </header>

          {recentMistake && (recentMistake.status !== 'saved' || !words.some((word) => word.word.toLowerCase() === recentMistake.word.toLowerCase())) && (
            <div data-review-recent role="status" className="rounded-lg border border-border p-3 text-sm">
              <strong>{recentMistake.word}</strong>
              <p className="mt-1 text-xs text-muted-foreground">{recentMistake.translation}</p>
              <p className="mt-2 text-xs">{recentMistake.status === 'saving' ? '正在保存到错词本…' : recentMistake.status === 'saved' ? '已保存，正在更新列表…' : '同步状态未确认，请刷新错词本核对。'}</p>
            </div>
          )}

          <section data-workspace-toolbar className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">已记录 {total.toLocaleString()} 个错词</p>
                <p className="text-xs text-muted-foreground">答对后仍会保留记录，方便持续复习。</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="刷新错词" onClick={() => setRetry((n) => n + 1)}>
              <RefreshCw className="size-4" />
            </Button>
          </section>

          {error ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>重试</Button>
              </CardContent>
            </Card>
          ) : loading && words.length === 0 ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          ) : words.length === 0 ? (
            <Card>
              <CardContent className="space-y-4 py-12 text-center">
                <p className="font-medium">还没有错词记录</p>
                <p className="text-sm text-muted-foreground">默写过程中答错的单词会立即收录到这里。</p>
                {onConfigure ? <Button variant="outline" onClick={onConfigure}>配置默写</Button> : <Link href="/dictation"><Button variant="outline">开始默写</Button></Link>}
              </CardContent>
            </Card>
          ) : (
            <>
              <div data-workspace-mistake-list className="grid gap-3 sm:grid-cols-2">
                {words.map((word) => (
                  <Card key={word.id} data-recent-mistake={word.word.toLowerCase() === recentMistake?.word.toLowerCase()}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h2 className="text-lg font-semibold">{word.word}</h2>
                        {word.pos && <span className="text-xs text-muted-foreground">{word.pos}</span>}
                        {word.phonetic && <span className="text-xs text-muted-foreground">{word.phonetic}</span>}
                      </div>
                      <p data-workspace-mistake-definition className="text-sm">{word.translation || '暂无释义'}</p>
                      {word.example && <p data-workspace-mistake-example className="border-t border-border pt-2 text-xs text-muted-foreground">{word.example}</p>}
                      <p data-workspace-mistake-stats className="text-xs text-muted-foreground">答错 {word.incorrectCount} 次 · 答对 {word.correctCount} 次</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {nextCursor && (
                <div className="flex justify-center">
                  <div className="space-y-2 text-center">
                    <Button variant="outline" onClick={loadMore} disabled={loading || loadingMore}>
                      {loadingMore ? <Loader2 className="animate-spin" /> : <ChevronDown />}
                      加载更多错词
                    </Button>
                    {loadMoreError && <p className="text-sm text-destructive">{loadMoreError}</p>}
                  </div>
                </div>
              )}
            </>
          )}
    </div>
  )
}
