'use client'

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePageView } from '@/lib/analytics'
import { BookOpen, ChevronLeft, ChevronRight, Download, Search, Award, CircleHelp } from 'lucide-react'
import Link from 'next/link'
import { useImportExportVisibility } from '@/hooks/useImportExportVisibility'

interface PublicVocabularyWord {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  exampleTranslation: string | null
}

const ContributionForm = dynamic(() => import('@/components/contributions/ContributionForm'), { loading: () => <p className="text-sm text-muted-foreground">正在打开疑问表单…</p> })

const PAGE_SIZE = 50

export default function PublicVocabularyPage() {
  usePageView('Public Vocabulary')
  const { status } = useSession()
  const { show: showImportExportActions } = useImportExportVisibility()
  const [questionWord, setQuestionWord] = useState<PublicVocabularyWord | null>(null)
  const questionTrigger = useRef<HTMLButtonElement | null>(null)
  const questionCard = useRef<HTMLDivElement | null>(null)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [words, setWords] = useState<PublicVocabularyWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const submissionUpdated = useCallback(async () => { setRetry((value) => value + 1) }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (query) params.set('q', query)

    setLoading(true)
    setError(null)
    fetch(`/api/public-vocabulary?${params}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error || '加载公共词库失败')
        }
        if (!active) return
        setWords(result.data)
        setTotal(result.pagination.total)
        setTotalPages(Math.max(1, result.pagination.totalPages))
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : '加载公共词库失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [page, query, retry])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setQuery(input.trim())
  }

  const handleDownload = () => {
    const params = new URLSearchParams({ format: 'csv' })
    if (query) params.set('q', query)
    window.location.href = `/api/public-vocabulary?${params}`
  }

  return (
    <AppLayout>
      <main className="min-h-screen bg-background p-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:p-8 xl:pb-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="indigo-page-header">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpen className="size-6 text-primary" />
              公共词库
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {showImportExportActions
                ? '浏览公共词条，或下载全部词条与当前搜索结果。'
                : '浏览公共词条。'}
            </p>
          </header>

          <nav className="flex gap-6 border-b border-border" aria-label="公共词库导航">
            <Link href="/public-vocabulary" aria-current="page" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-primary px-1 text-sm font-medium text-primary">
              <BookOpen className="size-4" />公共词库
            </Link>
            <Link href="/contributions" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 text-sm text-muted-foreground hover:text-foreground">
              <Award className="size-4" />单词贡献榜
            </Link>
          </nav>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <form onSubmit={handleSearch} className="flex min-w-0 flex-1 gap-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="搜索英文单词或中文释义"
                  aria-label="搜索英文单词或中文释义"
                  className="min-w-0"
                />
                <Button type="submit" variant="secondary">
                  <Search />
                  搜索
                </Button>
              </form>
              {showImportExportActions && (
                <Button type="button" variant="outline" onClick={handleDownload}>
                  <Download />
                  {query ? '下载搜索结果 CSV' : '下载全部 CSV'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? '正在加载…' : `共 ${total.toLocaleString()} 条词汇`}
            </p>
          </section>

          {error ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
                  重试
                </Button>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <Card key={item} className="animate-pulse">
                  <CardContent className="space-y-3 p-4">
                    <div className="h-5 w-1/3 rounded bg-muted" />
                    <div className="h-4 w-full rounded bg-muted" />
                    <div className="h-4 w-2/3 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : words.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                没有找到匹配的词条。
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {words.map((word) => (
                  <Card key={word.word} className="public-vocabulary-entry">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h2 className="text-lg font-semibold">{word.word}</h2>
                        {word.pos && (
                          <span className="text-xs text-muted-foreground">{word.pos}</span>
                        )}
                        {word.phonetic && (
                          <span className="text-xs text-muted-foreground">{word.phonetic}</span>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 pt-3 text-sm">{word.translation}</p>
                        <button type="button" onClick={(event) => { questionTrigger.current = event.currentTarget; setQuestionWord(word) }} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-ring" aria-label={`对 ${word.word} 的释义有疑问`} aria-haspopup="dialog" title="对释义有疑问？">
                          <CircleHelp className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                      {word.example && (
                        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                          <p>{word.example}</p>
                          {word.exampleTranslation && <p className="mt-1">{word.exampleTranslation}</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <nav aria-label="公共词库分页" className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft />
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {page} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页
                  <ChevronRight />
                </Button>
              </nav>
            </>
          )}
        </div>
      </main>
      <Dialog open={Boolean(questionWord)} onOpenChange={(open) => { if (!open) setQuestionWord(null) }}>
        <DialogContent ref={questionCard} className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" onOpenAutoFocus={(event) => { event.preventDefault(); questionCard.current?.focus() }} onCloseAutoFocus={(event) => { event.preventDefault(); questionTrigger.current?.focus() }}>
          <DialogHeader>
            <DialogTitle>说说你的疑问 · {questionWord?.word}</DialogTitle>
            <DialogDescription>看看当前释义，告诉我们哪里让你困惑，以及你认为正确的内容。</DialogDescription>
          </DialogHeader>
          {questionWord && (status === 'authenticated' ? (
            <Suspense fallback={<p className="text-sm text-muted-foreground">正在打开疑问表单…</p>}>
              <ContributionForm key={questionWord.word} compact correctionWord={questionWord.word} onUpdated={submissionUpdated} />
            </Suspense>
          ) : status === 'loading' ? <p className="text-sm text-muted-foreground">正在加载…</p> : (
            <div className="space-y-4">
              <p className="rounded-lg bg-muted/50 p-3 text-sm">{questionWord.translation}</p>
              <p className="text-sm text-muted-foreground">登录后可以提交疑问，并查看审核结果。</p>
              <Button asChild><Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/contributions?correct=${encodeURIComponent(questionWord.word)}`)}`}>登录后填写</Link></Button>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
