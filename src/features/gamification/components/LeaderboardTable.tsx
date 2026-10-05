'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, Trophy, Flame, Crown, Shield } from 'lucide-react'
import type { LeaderboardEntry } from '@/features/gamification/types'

const TAB_CONFIGS = [
  { value: 'total', label: '总学力', icon: Crown },
  { value: 'monthly', label: '本月', icon: Trophy },
  { value: 'weekly', label: '本周', icon: Flame },
  { value: 'zone', label: '学区', icon: Shield },
]

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-500 font-bold text-sm">🥇</span>
  if (rank === 2) return <span className="text-gray-400 font-bold text-sm">🥈</span>
  if (rank === 3) return <span className="text-amber-700 font-bold text-sm">🥉</span>
  return <span className="text-xs text-muted-foreground w-5 text-center">{rank}</span>
}

function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        暂无数据
      </div>
    )
  }

  const podium = entries.length >= 3 ? entries.slice(0, 3) : []
  const remaining = podium.length ? entries.slice(3) : entries
  const topScore = Math.max(...entries.map((entry) => entry.score), 0)

  return (
    <div className="space-y-5">
      {podium.length > 0 && (
        <section className="space-y-2" aria-label="前三名">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">本期领跑</h3>
            <span className="text-[11px] tabular-nums text-muted-foreground">{entries.length} 位学习者</span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3 sm:items-end" aria-label="前三名">
          {podium.map((entry, index) => (
            <li
              key={entry.userId}
              className={`relative flex min-h-24 flex-col justify-between overflow-hidden rounded-xl border p-3 sm:min-h-32 ${
                index === 0 ? 'sm:col-start-2 sm:row-start-1 sm:min-h-40 border-amber-500/40 bg-gradient-to-b from-amber-500/15 to-primary/5' :
                index === 1 ? 'sm:col-start-1 sm:row-start-1 border-slate-400/35 bg-gradient-to-b from-slate-400/10 to-muted/25' :
                'sm:col-start-3 sm:row-start-1 border-orange-700/25 bg-gradient-to-b from-orange-700/10 to-muted/25'
              } ${entry.isCurrentUser ? 'ring-2 ring-primary/35' : ''}`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : 'bg-orange-700/60'}`} />
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex size-8 items-center justify-center rounded-full ${index === 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-background/80 text-muted-foreground'}`}>
                  {index === 0 ? <Crown className="size-4" /> : <span className="text-xs font-semibold">{entry.rank}</span>}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">{entry.rank === 1 ? '榜首' : `第 ${entry.rank} 名`}</span>
              </div>
              <div className="mt-3 min-w-0">
                <p title={entry.nickname} className={`truncate text-sm font-semibold ${entry.isCurrentUser ? 'text-primary' : ''}`}>
                  {entry.nickname}{entry.isCurrentUser && <span className="ml-1 text-xs font-normal">（你）</span>}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  {entry.currentStreak > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-orange-500"><Flame className="size-3" />{entry.currentStreak} 天</span>
                  ) : <span className="text-[11px] text-muted-foreground">累计学力</span>}
                  <span className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{entry.score}</span>
                </div>
              </div>
            </li>
          ))}
          </ol>
        </section>
      )}

      {remaining.length > 0 && (
        <div className="space-y-1.5">
          {podium.length > 0 && <h3 className="px-1 text-xs font-medium text-muted-foreground">其他排名</h3>}
          <ol start={podium.length ? 4 : undefined} className="space-y-1.5">
            {remaining.map((entry) => (
              <li
                key={entry.userId}
                className={`relative flex min-h-12 items-center gap-3 rounded-lg border border-transparent px-3 pb-3 pt-2 text-sm transition-colors ${
                  entry.isCurrentUser
                    ? 'border-primary/30 bg-primary/10'
                    : 'hover:border-border/70 hover:bg-muted/45'
                }`}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted/70"><RankBadge rank={entry.rank} /></span>
                <div className="flex-1 min-w-0">
                  <span className={`font-medium truncate block ${entry.isCurrentUser ? 'text-primary' : ''}`}>
                    {entry.nickname}
                    {entry.isCurrentUser && <span className="text-xs ml-1 opacity-60">(你)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {entry.currentStreak > 0 && (
                    <span className="text-xs text-orange-500 flex items-center gap-0.5">
                      <Flame className="w-3 h-3" />
                      {entry.currentStreak}
                    </span>
                  )}
                  <span className="font-mono text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {entry.score}
                  </span>
                </div>
                {topScore > 0 && (
                  <div className="absolute inset-x-3 bottom-1 h-0.5 overflow-hidden rounded-full bg-muted/70" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${Math.max(4, Math.min(100, (entry.score / topScore) * 100))}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function LeaderboardTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [activeTab, setActiveTab] = useState('total')
  const [data, setData] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const requestsRef = useRef<Record<string, AbortController>>({})

  const fetchLeaderboard = useCallback(async (type: string, silent = false) => {
    requestsRef.current[type]?.abort()
    const controller = new AbortController()
    requestsRef.current[type] = controller

    if (!silent) {
      setLoading((prev) => ({ ...prev, [type]: true }))
      setErrors((prev) => ({ ...prev, [type]: null }))
    }

    try {
      const res = await fetch(`/api/game/leaderboard?type=${type}`, {
        signal: controller.signal,
      })
      const result = await res.json()
      if (!res.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error('leaderboard request failed')
      }

      if (requestsRef.current[type] === controller) {
        setData((prev) => ({ ...prev, [type]: result.data }))
        setErrors((prev) => ({ ...prev, [type]: null }))
      }
    } catch {
      if (!controller.signal.aborted && requestsRef.current[type] === controller) {
        setErrors((prev) => ({
          ...prev,
          [type]: '排行榜加载失败，请检查网络后重试。',
        }))
      }
    } finally {
      if (!controller.signal.aborted && requestsRef.current[type] === controller) {
        delete requestsRef.current[type]
        setLoading((prev) => ({ ...prev, [type]: false }))
      }
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard(activeTab)
  }, [activeTab, refreshKey, fetchLeaderboard])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderboard(activeTab, true)
    }, 15000)
    return () => clearInterval(interval)
  }, [activeTab, fetchLeaderboard])

  useEffect(() => () => {
    Object.values(requestsRef.current).forEach((controller) => controller.abort())
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          排行榜
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            {TAB_CONFIGS.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {TAB_CONFIGS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {loading[tab.value] ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : errors[tab.value] ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center" role="alert">
                  <p className="text-sm text-muted-foreground">{errors[tab.value]}</p>
                  <button
                    type="button"
                    onClick={() => fetchLeaderboard(tab.value)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    重试
                  </button>
                </div>
              ) : (
                <LeaderboardList entries={data[tab.value] || []} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
