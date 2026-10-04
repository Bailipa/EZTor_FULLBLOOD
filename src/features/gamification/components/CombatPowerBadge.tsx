'use client'

import { useEffect, useState } from 'react'
import { Zap, Flame } from 'lucide-react'

export interface CombatPowerSummary {
  combatPower: number
  currentStreak: number
  dailyPowerGained: number
  dailyPowerCap: number
}

export function CombatPowerBadge({ refreshKey = 0, data }: { refreshKey?: number; data?: CombatPowerSummary | null }) {
  const [loadedData, setLoadedData] = useState<CombatPowerSummary | null>(null)

  useEffect(() => {
    if (data !== undefined) return
    fetch('/api/game/profile')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setLoadedData({
            combatPower: res.data.combatPower,
            currentStreak: res.data.currentStreak,
            dailyPowerGained: res.data.dailyPowerGained,
            dailyPowerCap: res.data.dailyPowerCap,
          })
        }
      })
      .catch(() => {})
  }, [refreshKey, data])

  const profile = data === undefined ? loadedData : data

  if (!profile) return null

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Zap className="w-3.5 h-3.5" />
        <span className="font-semibold">{profile.combatPower}</span>
      </div>
      {profile.currentStreak > 0 && (
        <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
          <Flame className="w-3.5 h-3.5" />
          <span>{profile.currentStreak}天</span>
        </div>
      )}
      <span className="text-muted-foreground">
        今日 +{profile.dailyPowerGained}/{profile.dailyPowerCap}
      </span>
    </div>
  )
}
