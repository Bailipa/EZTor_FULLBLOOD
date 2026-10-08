'use client'

import { Flame, Check } from 'lucide-react'

interface StreakCalendarProps {
  currentStreak: number
  longestStreak: number
}

export function StreakCalendar({ currentStreak, longestStreak }: StreakCalendarProps) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <Flame className="w-3.5 h-3.5 text-orange-500" />
        <span className="font-semibold">{currentStreak}天</span>
        <span className="hidden text-muted-foreground sm:inline">最高 {longestStreak}</span>
        <span className="sr-only">，最长连续 {longestStreak} 天</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground" aria-label="今日已完成学习" title="今日已完成学习">
        <Check className="w-3.5 h-3.5 text-emerald-500" />
        <span className="hidden sm:inline">今日完成</span>
        <span className="sr-only">今日完成</span>
      </div>
    </div>
  )
}
