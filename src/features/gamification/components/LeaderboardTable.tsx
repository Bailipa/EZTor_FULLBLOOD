'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, Trophy, Flame, Crown, Shield } from 'lucide-react'
import type { LeaderboardEntry } from '@/features/gamification/types'

const TAB_CONFIGS = [
  { value: 'total', label: '总战力', icon: Crown },
  { value: 'monthly', label: '本月', icon: Trophy },
  { value: 'weekly', label: '本周', icon: Flame },
  { value: 'zone', label: '战区', icon: Shield },
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

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.userId}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
            entry.isCurrentUser
              ? 'bg-primary/10 border border-primary/20'
              : 'hover:bg-muted/50'
          }`}
        >
          <RankBadge rank={entry.rank} />
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
            <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
              {entry.combatPower}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function LeaderboardTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [activeTab, setActiveTab] = useState('total')
  const [data, setData] = useState<Record<string, LeaderboardEntry[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const activeTabRef = useRef(activeTab)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  const fetchLeaderboard = useCallback(async (type: string, silent = false) => {
    if (!silent) setLoading((prev) => ({ ...prev, [type]: true }))
    try {
      const res = await fetch(`/api/game/leaderboard?type=${type}`)
      const result = await res.json()
      if (result.success) {
        setData((prev) => ({ ...prev, [type]: result.data }))
      }
    } catch {
    } finally {
      if (!silent) setLoading((prev) => ({ ...prev, [type]: false }))
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard(activeTab)
  }, [activeTab, refreshKey, fetchLeaderboard])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderboard(activeTabRef.current, true)
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

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
