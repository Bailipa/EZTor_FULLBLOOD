'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface PrefData {
  dailyGoal: number
  reviewReminderEnabled: boolean
  reviewReminderTime: string | null
}

interface TaskData {
  taskType: string
  currentValue: number
  targetValue: number
  isCompleted: boolean
}

const CHECK_INTERVAL_MS = 30_000

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * 复习提醒：到设定时间后，若今日复习量未达每日目标，
 * 则触发一次浏览器通知 + toast（仅当天一次）。
 */
export function useReviewReminder() {
  const { status } = useSession()
  const firedForToday = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated') return

    let pref: PrefData | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    let disposed = false

    const check = async () => {
      if (disposed || status !== 'authenticated') return

      try {
        // 先只拉偏好（轻量只读）；只有"已启用提醒且到点"才拉任务数据（会触发游戏化写入）
        if (!pref) {
          const prefRes = await fetch('/api/preferences')
          if (!prefRes.ok) return
          pref = (await prefRes.json()).data as PrefData
        }

        if (!pref.reviewReminderEnabled || !pref.reviewReminderTime) return

        const [h, m] = pref.reviewReminderTime.split(':').map(Number)
        const now = new Date()
        const passed = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)
        if (!passed) return

        const key = `${todayKey()}:${pref.dailyGoal}`
        if (firedForToday.current === key) return

        const taskRes = await fetch('/api/game/tasks')
        if (!taskRes.ok) return
        const taskData = (await taskRes.json()).data as TaskData[]
        const reviewTask = taskData.find((t) => t.taskType === 'COMPLETE_REVIEWS')
        const reviewed = reviewTask?.currentValue ?? 0

        if (reviewed < pref.dailyGoal) {
          firedForToday.current = key
          const remaining = Math.max(0, pref.dailyGoal - reviewed)
          toast.info(`今日目标还差 ${remaining} 词，来复习一下吧！`, { duration: 6000 })

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('该复习啦 📖', {
                body: `今日默写 ${reviewed}/${pref.dailyGoal} 词，还差 ${remaining} 词达成目标。`,
              })
            } catch {
              // 部分环境构造通知可能抛错，忽略
            }
          }
        }
      } catch {
        // 静默失败，不打扰用户
      }
    }

    check()
    interval = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      disposed = true
      if (interval) clearInterval(interval)
    }
  }, [status])
}

export function ReviewReminder() {
  useReviewReminder()
  return null
}
