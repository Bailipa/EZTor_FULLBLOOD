'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import ContributionForm from '@/components/contributions/ContributionForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Loader2, Award } from 'lucide-react'

type ContributionRow = { rank: number; displayName: string; count: number; isMe: boolean }

interface BoardData {
  enabled: boolean
  period: 'all'
  asOf?: string
  rows: ContributionRow[]
  page: number
  pageSize: number
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

export default function ContributionLeaderboardPage() {
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

  if (status === 'loading' || (loading && !board)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }
  if (status !== 'authenticated') return null

  const currentVisibility = mine?.visibility || 'private'

  return (
    <AppLayout>
      <div className="mx-auto min-h-full w-full max-w-5xl space-y-4 p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:p-6 xl:pb-6">
        <header className="indigo-page-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Award className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">单词贡献榜</h1>
              <p className="text-sm text-muted-foreground">让公共词库更完整、更准确</p>
            </div>
          </div>
        </header>

        <nav className="flex gap-6 border-b border-border" aria-label="公共词库导航">
          <Link href="/public-vocabulary" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 text-sm text-muted-foreground hover:text-foreground">
            <BookOpen className="size-4" />公共词库
          </Link>
          <Link href="/contributions" aria-current="page" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-primary px-1 text-sm font-medium text-primary">
            <Award className="size-4" />单词贡献榜
          </Link>
        </nav>

        {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}<Button variant="ghost" size="sm" onClick={() => { void load() }}>重试</Button></div>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}

        <Suspense fallback={<p className="text-sm text-muted-foreground">加载贡献表单…</p>}><ContributionForm onUpdated={load} /></Suspense>

        {mine && (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">我的贡献</p>
                  <p className="text-sm text-muted-foreground">{board?.myCount ?? mine.total} 点 · {board?.myRank ? `当前第 ${board.myRank} 名` : currentVisibility === 'private' ? '未参与公开排名' : '暂无公开排名'}</p>
                </div>
                <Button variant="outline" className="min-h-11" onClick={() => setShowDetails((value) => !value)}>
                  {showDetails ? '收起明细' : '查看我的贡献明细'}
                </Button>
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
                      className="min-h-11"
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
              {showDetails && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-medium">我的记录（只对本人可见）</p>
                  {mine.enabled && mine.entries.length === 0 && <p className="text-sm text-muted-foreground">暂无贡献。</p>}
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
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="font-semibold">累计贡献榜</h2>

            {board?.enabled ? (
              <>
                <div className="text-sm text-muted-foreground">
                  {board.asOf && <span className="block text-xs">数据更新时间：{new Date(board.asOf).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>}
                </div>
                <div className="text-xs text-muted-foreground">公开参与人数：{board.totalParticipants}</div>
                {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : board.rows.length ? (
                  <ol className="space-y-2">
                    {board.rows.map((row, index) => (
                      <li key={`${row.rank}-${row.displayName}-${index}`} className={`flex items-center gap-3 rounded-lg border p-3 ${row.isMe ? 'border-primary/60 bg-primary/5' : ''}`}>
                        <span className="w-10 shrink-0 text-center text-lg font-semibold tabular-nums">{row.rank}</span>
                        <span className="min-w-0 flex-1 break-words">{row.displayName}{row.isMe ? ' · 我' : ''}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{row.count} 点</span>
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
    </AppLayout>
  )
}
