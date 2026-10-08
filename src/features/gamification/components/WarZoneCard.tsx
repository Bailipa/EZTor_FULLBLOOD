'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, Users, Plus, Pencil, ArrowRightLeft, ChevronDown } from 'lucide-react'
import type { ZoneInfo } from '@/features/gamification/types'
import { ZoneRenameDialog } from './ZoneRenameDialog'
import { ZoneTransferDialog } from './ZoneTransferDialog'
import { ZoneTitleDialog } from './ZoneTitleDialog'

export function WarZoneCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [zone, setZone] = useState<ZoneInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [joining, setJoining] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [titleOpen, setTitleOpen] = useState(false)
  const requestRef = useRef<AbortController | null>(null)

  const fetchZone = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)

    setError(false)
    try {
      const response = await fetch('/api/game/zone', { signal: controller.signal })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error('zone request failed')
      if (requestRef.current === controller) setZone(data.data ?? null)
    } catch {
      if (!controller.signal.aborted && requestRef.current === controller) {
        setError(true)
      }
    } finally {
      if (!controller.signal.aborted && requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchZone()
    return () => requestRef.current?.abort()
  }, [fetchZone, refreshKey])

  const handleJoin = async () => {
    setJoining(true)
    try {
      const res = await fetch('/api/game/leaderboard?type=zone')
      const data = await res.json()
      if (data.success) {
        fetchZone()
      }
    } catch {
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Shield className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" role="alert">学区信息加载失败</p>
          <Button size="sm" variant="outline" onClick={() => void fetchZone()}>
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!zone) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Shield className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">尚未加入学区</p>
          <Button size="sm" onClick={handleJoin} disabled={joining}>
            <Plus className="w-4 h-4 mr-1" />
            {joining ? '加入中...' : '加入学区'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="w-4 h-4 text-blue-500" />
            {zone.name}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setTransferOpen(true)}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="学区转移（消耗 20 学力）"
                aria-label="学区转移"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
              {zone.isCurrentUserTop && (
                <button
                  onClick={() => setRenameOpen(true)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="修改学区名称（消耗 10 学力）"
                  aria-label="修改学区名称"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </CardTitle>
          {zone.previousName && zone.renamedAt && (
            <p className="text-[10px] text-muted-foreground mt-1">
              原{zone.previousName}
              {zone.renamedByName && `，被${zone.renamedByName}改名`}
              {(() => {
                const daysSince = Math.floor(
                  (Date.now() - new Date(zone.renamedAt).getTime()) / (1000 * 60 * 60 * 24)
                )
                return daysSince > 0 ? `，${daysSince}天前` : '，今天'
              })()}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{zone.memberCount}/{zone.maxMembers} 成员</span>
            </div>
          </div>
          <details className="group border-t pt-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span>成员排名</span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="mt-2 space-y-1" aria-label={`${zone.name}成员排名`}>
              {zone.members.slice(0, 10).map((m) => (
                <li
                  key={m.userId}
                  className={`flex min-h-9 items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-xs ${
                    m.isCurrentUser ? 'border-primary/30 bg-primary/10' : 'hover:bg-muted/45'
                  }`}
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold tabular-nums ${m.rank <= 3 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                  >
                    {m.rank}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    {m.zoneTitle}
                    {m.rank === 1 && zone.isCurrentUserTop && (
                      <button
                        onClick={() => setTitleOpen(true)}
                        className="ml-0.5 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                        title="修改称号（消耗 20 学力）"
                        aria-label="修改我的学区称号"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${m.isCurrentUser ? 'font-semibold text-primary' : ''}`}
                  >
                    {m.nickname}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                    {m.score}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </CardContent>
      </Card>

      <ZoneRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={zone.name}
        onSuccess={() => fetchZone()}
      />

      <ZoneTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        currentZoneId={zone.id}
        canTransfer={zone.canTransfer}
        transferCooldownRemaining={zone.transferCooldownRemaining}
        onSuccess={() => fetchZone()}
      />

      <ZoneTitleDialog
        open={titleOpen}
        onOpenChange={setTitleOpen}
        currentTitle={zone.members[0]?.zoneTitle ?? '英帝'}
        onSuccess={() => fetchZone()}
      />
    </>
  )
}
