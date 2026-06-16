'use client'

import { Flame, Calendar } from 'lucide-react'

interface StreakCalendarProps {
  currentStreak: number
  longestStreak: number
}

export function StreakCalendar({ currentStreak, longestStreak }: StreakCalendarProps) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <Flame className="w-4 h-4 text-orange-500" />
        <div>
          <div className="font-semibold">{currentStreak} 天连续</div>
          <div className="text-muted-foreground">最长 {longestStreak} 天</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar className="w-3.5 h-3.5" />
        <span>今日已打卡</span>
      </div>
    </div>
  )
}
