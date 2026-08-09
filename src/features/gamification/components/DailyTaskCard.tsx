'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { DailyTaskState } from '@/features/gamification/types'

interface DailyTaskCardProps {
  refreshKey?: number
  defaultCollapsed?: boolean
}

export function DailyTaskCard({ refreshKey = 0, defaultCollapsed = false }: DailyTaskCardProps) {
  const [tasks, setTasks] = useState<DailyTaskState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const fetchTasks = (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    fetch('/api/game/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTasks(data.data)
        else setError(data.error || '加载失败')
      })
      .catch((e) => setError(e.message || '网络错误'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    if (refreshKey > 0) fetchTasks(true)
  }, [refreshKey])

  // 从默写/其他页面返回或 App 从后台恢复时重新拉取，
  // 避免 Android WebView bfcache 显示旧的"任务进度"（如卡在 4/20）。
  useEffect(() => {
    const handlePageShow = () => fetchTasks(true)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchTasks(true)
    }
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const completedCount = tasks.filter((t) => t.isCompleted).length
  const flashcardTask = tasks.find((t) => t.taskType === 'FLASHCARD_INTERACT')

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-3 gap-2 text-sm text-muted-foreground">
          <span className="text-destructive text-xs">{error}</span>
          <button onClick={() => fetchTasks()} className="text-primary hover:underline flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" />
            重试
          </button>
        </CardContent>
      </Card>
    )
  }

  if (collapsed) {
    const allCompleted = tasks.every((t) => t.isCompleted)
    const flashcardInProgress = flashcardTask && !flashcardTask.isCompleted
    const activeTask = flashcardInProgress
      ? flashcardTask
      : tasks.find((t) => !t.isCompleted) || flashcardTask

    if (allCompleted) {
      return (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center gap-2 justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                今日任务全部完成！你就是最强英语人！
              </span>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (activeTask) {
      const progress = Math.min(100, Math.round((activeTask.currentValue / activeTask.targetValue) * 100))
      return (
        <Card
          className="cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setCollapsed(false)}
        >
          <CardContent className="py-2.5 px-3">
            <div className="flex items-center gap-2.5">
              <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium shrink-0">{activeTask.title}</span>
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {activeTask.currentValue}/{activeTask.targetValue}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                +{activeTask.powerReward}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground animate-pulse-scale" />
            </div>
          </CardContent>
        </Card>
      )
    }
  }

  return (
    <Card>
      <CardContent className="py-2.5 px-3">
        <div
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setCollapsed(true)}
        >
          <span className="text-xs font-medium">每日任务</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {completedCount}/{tasks.length}
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const progress = Math.min(100, Math.round((task.currentValue / task.targetValue) * 100))
            return (
              <div key={task.taskType} className="flex items-center gap-2.5">
                {task.isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate">{task.title}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-2 shrink-0">
                      +{task.powerReward}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {task.description}
                    {!task.isCompleted && task.currentValue > 0 && (
                      <span className="ml-1">({task.currentValue}/{task.targetValue})</span>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
