'use client'

import { useEffect, useState } from 'react'
import { Zap, Flame } from 'lucide-react'

interface ProfileData {
  combatPower: number
  currentStreak: number
  dailyPowerGained: number
  dailyPowerCap: number
}

export function CombatPowerBadge({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<ProfileData | null>(null)

  useEffect(() => {
    fetch('/api/game/profile')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setData({
            combatPower: res.data.combatPower,
            currentStreak: res.data.currentStreak,
            dailyPowerGained: res.data.dailyPowerGained,
            dailyPowerCap: res.data.dailyPowerCap,
          })
        }
      })
      .catch(() => {})
  }, [refreshKey])

  if (!data) return null

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Zap className="w-3.5 h-3.5" />
        <span className="font-semibold">{data.combatPower}</span>
      </div>
      {data.currentStreak > 0 && (
        <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
          <Flame className="w-3.5 h-3.5" />
          <span>{data.currentStreak}天</span>
        </div>
      )}
      <span className="text-muted-foreground">
        今日 +{data.dailyPowerGained}/{data.dailyPowerCap}
      </span>
    </div>
  )
}
