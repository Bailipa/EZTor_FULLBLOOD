'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, Users, Plus, Pencil } from 'lucide-react'
import type { ZoneInfo } from '@/features/gamification/types'
import { ZoneRenameDialog } from './ZoneRenameDialog'

export function WarZoneCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [zone, setZone] = useState<ZoneInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  const fetchZone = () => {
    setLoading(true)
    fetch('/api/game/zone')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setZone(data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchZone()
  }, [refreshKey])

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

  if (!zone) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Shield className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">尚未加入战区</p>
          <Button size="sm" onClick={handleJoin} disabled={joining}>
            <Plus className="w-4 h-4 mr-1" />
            {joining ? '加入中...' : '加入战区'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            {zone.name}
            {zone.isCurrentUserTop && (
              <button
                onClick={() => setRenameOpen(true)}
                className="text-muted-foreground hover:text-foreground transition-colors ml-auto"
                title="修改战区名称（消耗 10 战力）"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
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
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Users className="w-3.5 h-3.5" />
            <span>{zone.memberCount}/{zone.maxMembers} 成员</span>
          </div>
          <div className="space-y-1">
            {zone.members.slice(0, 10).map((m) => (
              <div
                key={m.userId}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                  m.isCurrentUser ? 'bg-primary/10' : ''
                }`}
              >
                <span className="w-4 text-center text-muted-foreground">{m.rank}</span>
                <span className={`flex-1 truncate ${m.isCurrentUser ? 'font-medium text-primary' : ''}`}>
                  {m.nickname}
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400">{m.combatPower}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ZoneRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={zone.name}
        onSuccess={() => fetchZone()}
      />
    </>
  )
}
