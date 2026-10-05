'use client'

import { memo, Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import ContributionForm from '@/components/contributions/ContributionForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Loader2, Award, Plus, LocateFixed, SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type ContributionRow = { rank: number; displayName: string; count: number; isMe: boolean }

interface BoardData {
  enabled: boolean
  period: 'all'
  asOf?: string
  rows: ContributionRow[]
  page: number
  pageSize: number
  myPage: number | null
  totalPages?: number
  totalParticipants: number
  myCount: number
  myRank: number | null
  visibility: string
}

interface MyData {
  enabled: boolean
  visibility: 'private' | 'anonymous' | 'nickname'
  publicAlias: string | null
  hasNickname: boolean
  total: number
  entries: { id: string; kind: 'NEW' | 'CORRECTION'; points: number; word: string; status: string; occurredAt: string; voidReason: string | null }[]
}

export const ContributionWorkspacePanel = memo(function ContributionWorkspacePanel({ embedded = false }: { embedded?: boolean }) {
  const { status } = useSession()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [board, setBoard] = useState<BoardData | null>(null)
  const [mine, setMine] = useState<MyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [contributionOpen, setContributionOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [findNotice, setFindNotice] = useState('')
  const [findTargetPage, setFindTargetPage] = useState<number | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    }
  }, [status, router])

  const load = useCallback(async () => {
    if (status !== 'authenticated') return
    setLoading(true)
    setError('')
    try {
      const [boardRes, mineRes] = await Promise.all([
        fetch(`/api/contributions/leaderboard?page=${page}`),
        fetch('/api/contributions/me'),
      ])
      const [boardJson, mineJson] = await Promise.all([boardRes.json(), mineRes.json()])
      if (!boardRes.ok || !boardJson.success) throw new Error(boardJson.error || '贡献榜加载失败')
      if (!mineRes.ok || !mineJson.success) throw new Error(mineJson.error || '个人贡献加载失败')
      setBoard(boardJson.data)
      setMine(mineJson.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (findTargetPage === null || loading || !board || board.page !== page) return
    const row = document.querySelector<HTMLElement>('[data-contribution-me="true"]')
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFindNotice('已在榜单中找到您。')
    }
    setFindTargetPage(null)
  }, [board, findTargetPage, loading, page])

  const saveVisibility = async (visibility: MyData['visibility']) => {
    setSaving(true)
    setNotice('')
    try {
      const res = await fetch('/api/contributions/visibility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || '展示设置保存失败')
      setMine((current) => current ? { ...current, ...json.data } : current)
      setBoard((current) => current ? { ...current, visibility } : current)
      setNotice('展示设置已保存')
      await load()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '展示设置保存失败')
    } finally {
      setSaving(false)
    }
  }

  const findMe = () => {
    setFindNotice('')
    if (!board?.myRank || !board.myPage) {
      setFindNotice(mine?.total
        ? currentVisibility === 'private' ? '您的榜单展示目前设为仅自己可见，因此不会出现在公开榜单中。' : '您目前还没有公开排名，审核通过并公开的贡献会显示在榜单中。'
        : '您还没有贡献新词或纠错记录。')
      return
    }
    const targetPage = board.myPage
    setFindTargetPage(targetPage)
    setPage(targetPage)
  }

  if (status === 'loading' || (loading && !board)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }
  if (status !== 'authenticated') return null

  const currentVisibility = mine?.visibility || 'private'

  const content = (
          <div data-workspace-page data-vocabulary-panel="contributions" data-workspace-content data-workspace-contributions className={embedded ? "min-h-0 w-full space-y-4 p-0" : "mx-auto min-h-full w-full max-w-5xl space-y-4 p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:p-6 xl:pb-6"}>
        <header data-workspace-local-heading className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <Award className="size-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">单词贡献榜</h1>
              <p className="text-xs text-muted-foreground">让公共词库更完整、更准确</p>
            </div>
          </div>
          <Dialog open={contributionOpen} onOpenChange={setContributionOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-9"><Plus className="size-4" />我要贡献</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>一起完善词库</DialogTitle>
                <DialogDescription>新增词条或提交释义疑问，通过审核后贡献 +1。</DialogDescription>
              </DialogHeader>
              <Suspense fallback={<p className="text-sm text-muted-foreground">加载贡献表单…</p>}>
                <ContributionForm inDialog onUpdated={load} />
              </Suspense>
            </DialogContent>
          </Dialog>
        </header>

        <nav data-workspace-local-nav className="flex gap-6 border-b border-border" aria-label="公共词库导航">
          <Link href="/public-vocabulary" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 text-sm text-muted-foreground hover:text-foreground">
            <BookOpen className="size-4" />公共词库
          </Link>
          <Link href="/contributions" aria-current="page" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-primary px-1 text-sm font-medium text-primary">
            <Award className="size-4" />单词贡献榜
          </Link>
        </nav>

        {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}<Button variant="ghost" size="sm" onClick={() => { void load() }}>重试</Button></div>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

        <Card data-workspace-contribution-board>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Award className="size-5 text-primary" />累计贡献榜</h2>
              {board?.enabled && <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{board.totalParticipants} 位贡献者</span>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              {board?.asOf ? <p className="text-xs text-muted-foreground">更新于 {new Date(board.asOf).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p> : <span />}
              <div className="flex items-center gap-1">
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="min-h-9"><SlidersHorizontal className="size-4" />榜单设置</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                      <DialogTitle>榜单设置</DialogTitle>
                      <DialogDescription>管理你的公开展示方式和个人贡献记录。</DialogDescription>
                    </DialogHeader>
                    {mine && <div className="space-y-4">
                      <div>
                        <p className="font-medium">我的贡献：{board?.myCount ?? mine.total} 点</p>
                        <p className="text-sm text-muted-foreground">{board?.myRank ? `当前第 ${board.myRank} 名` : currentVisibility === 'private' ? '未参与公开排名' : '暂无公开排名'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">榜单展示方式</p>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="榜单展示方式">
                          {([
                            ['private', '仅自己可见'],
                            ['anonymous', '匿名参与'],
                            ['nickname', '使用游戏昵称'],
                          ] as const).map(([value, label]) => (
                            <Button
                              key={value}
                              type="button"
                              variant={currentVisibility === value ? 'default' : 'outline'}
                              className="min-h-9"
                              aria-pressed={currentVisibility === value}
                              disabled={saving}
                              onClick={() => { void saveVisibility(value) }}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {currentVisibility === 'nickname'
                            ? `公开名称预览：${mine.hasNickname ? '当前游戏昵称' : mine.publicAlias || '匿名贡献者'}`
                            : currentVisibility === 'anonymous'
                              ? `公开名称预览：${mine.publicAlias || '匿名贡献者'}`
                              : '其他用户看不到你的名字和个人排名。'}
                        </p>
                      </div>
                      <div className="border-t pt-3">
                        <Button variant="outline" size="sm" className="min-h-9" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails}>
                          {showDetails ? '收起贡献明细' : '查看我的贡献明细'}
                        </Button>
                        {showDetails && <div className="mt-3 space-y-2">
                          {mine.enabled && mine.entries.length === 0 && <p className="text-sm text-muted-foreground">暂无贡献记录。</p>}
                          <ul className="max-h-72 space-y-2 overflow-y-auto">
                            {mine.entries.map((entry) => (
                              <li key={entry.id} className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/50 p-3 text-sm">
                                <span className="font-medium">{entry.word} · {entry.kind === 'CORRECTION' ? '纠错' : '新增'} +{entry.points}</span>
                                <span className="text-xs text-muted-foreground">
                                  {entry.status === 'VALID' ? '有效' : `已作废${entry.voidReason ? `：${entry.voidReason}` : ''}`} · {new Date(entry.occurredAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>}
                      </div>
                    </div>}
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" className="min-h-9" onClick={findMe} disabled={loading || !board}>
                  <LocateFixed className="size-4" />找自己
                </Button>
              </div>
            </div>
            {findNotice && <p role="status" className="text-sm text-muted-foreground">{findNotice}</p>}

            {board?.enabled ? (
              <>
                {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : board.rows.length ? (
                  <ol className="space-y-2" aria-label="累计贡献排名">
                    {board.rows.map((row, index) => (
                      <li key={`${row.rank}-${row.displayName}-${index}`} data-contribution-me={row.isMe ? 'true' : undefined} className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2.5 ${row.isMe ? 'border-primary/60 bg-primary/5' : 'bg-card/50'}`}>
                        <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${row.rank === 1 ? 'bg-primary text-primary-foreground' : row.rank <= 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{row.rank}</span>
                        <span className="min-w-0 flex-1 break-words">{row.displayName}{row.isMe ? ' · 我' : ''}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{row.count}<span className="ml-1 text-xs font-normal text-muted-foreground">点</span></span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">还没有公开参与的贡献者。</p>}
                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" className="min-h-11" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button>
                  <span className="text-sm text-muted-foreground">第 {page}/{board.totalPages || 1} 页</span>
                  <Button variant="outline" className="min-h-11" disabled={page >= (board.totalPages || 1) || loading} onClick={() => setPage((value) => value + 1)}>下一页</Button>
                </div>
              </>
            ) : (
              <p className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                暂未加载贡献榜，请重试。
              </p>
            )}
          </CardContent>
        </Card>

      </div>
  )
  return embedded ? content : <AppLayout>{content}</AppLayout>
})
