'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { DailyTaskState } from '@/features/gamification/types'

function milestoneStage(task: DailyTaskState): { start: number; end: number; progress: number; nextReward: number } {
  const milestones = task.milestones ?? []
  const idx = Math.min(task.milestoneIndex ?? 0, milestones.length)
  if (idx === 0) {
    const end = milestones[0]?.target ?? task.targetValue
    return { start: 0, end, progress: task.currentValue / end * 100, nextReward: milestones[0]?.powerReward ?? task.powerReward }
  }
  const end = idx < milestones.length ? milestones[idx].target : (milestones[milestones.length - 1]?.target ?? task.targetValue)
  const start = milestones[idx - 1]?.target ?? 0
  const progress = end > start ? (task.currentValue - start) / (end - start) * 100 : 100
  return { start, end, progress, nextReward: milestones[idx]?.powerReward ?? task.powerReward }
}

// 里程碑任务进度条显示当前段（达标刷新，目标=段终点）；普通任务显示累计进度
function renderTaskProgress(task: DailyTaskState) {
  const isMilestone = (task.milestones?.length ?? 0) > 0
  const progress = Math.min(100, Math.round((task.currentValue / task.targetValue) * 100))
  if (isMilestone) {
    const stage = milestoneStage(task)
    return {
      progress: Math.min(100, Math.round(stage.progress)),
      label: `${Math.min(task.currentValue, stage.end)}/${stage.end}`,
      reward: stage.nextReward,
    }
  }
  return { progress, label: `${task.currentValue}/${task.targetValue}`, reward: task.powerReward }
}

interface DailyTaskCardProps {
  refreshKey?: number
  defaultCollapsed?: boolean
  onTaskClick?: (task: DailyTaskState) => void
}

export function DailyTaskCard({ refreshKey = 0, defaultCollapsed = false, onTaskClick }: DailyTaskCardProps) {
  const [tasks, setTasks] = useState<DailyTaskState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const requestRef = useRef<Promise<void> | null>(null)
  const refreshPendingRef = useRef(false)
  const fetchTasksRef = useRef<((silent?: boolean) => void) | null>(null)

  const fetchTasks = useCallback((silent = false, queueIfBusy = false) => {
    if (requestRef.current) {
      if (queueIfBusy) refreshPendingRef.current = true
      return
    }
    if (!silent) setLoading(true)
    setError(null)
    let request: Promise<void>
    request = fetch('/api/game/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTasks(data.data)
        else setError(data.error || '加载失败')
      })
      .catch((e) => setError(e.message || '网络错误'))
      .finally(() => {
        if (requestRef.current === request) requestRef.current = null
        setLoading(false)
        if (refreshPendingRef.current) {
          refreshPendingRef.current = false
          fetchTasksRef.current?.(true)
        }
      })
    requestRef.current = request
  }, [])

  useEffect(() => {
    fetchTasksRef.current = fetchTasks
    return () => {
      fetchTasksRef.current = null
    }
  }, [fetchTasks])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    if (refreshKey > 0) fetchTasks(true, true)
  }, [fetchTasks, refreshKey])

  // 从默写/其他页面返回或 App 从后台恢复时重新拉取，
  // 避免 Android WebView bfcache 显示旧的"任务进度"（如卡在 4/20）。
  useEffect(() => {
    let lastRefreshAt = 0
    const refreshOnReturn = () => {
      const now = Date.now()
      if (now - lastRefreshAt < 1000) return
      lastRefreshAt = now
      fetchTasks(true)
    }
    const handlePageShow = () => refreshOnReturn()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshOnReturn()
    }
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchTasks])

  const completedCount = tasks.filter((t) => t.isCompleted).length
  const flashcardTask = tasks.find((t) => t.taskType === 'FLASHCARD_INTERACT')

  if (loading) {
    return (
      <Card className="py-0">
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="py-0">
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

  if (tasks.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="py-3 text-center text-xs text-muted-foreground">
          今天暂无学习任务
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
        <Card className="py-0 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="py-1.5 px-3">
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
      const rp = renderTaskProgress(activeTask)
      return (
        <Card className="py-0">
          <CardContent className="py-1.5 px-3">
            <div className="flex min-h-11 items-center gap-2.5">
              <div
                role="button"
                tabIndex={0}
                aria-label={`继续任务：${activeTask.title}`}
                className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onTaskClick?.(activeTask)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTaskClick?.(activeTask) }
                }}
              >
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium shrink-0">{activeTask.title}</span>
                <Progress value={rp.progress} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{rp.label}</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">+{rp.reward}</span>
              </div>
              <button type="button" className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="展开每日任务" onClick={() => setCollapsed(false)}>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      )
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="py-1.5 px-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium">每日任务</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{completedCount}/{tasks.length}</span>
            <button type="button" className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted" aria-label="收起每日任务" onClick={() => setCollapsed(true)}>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const rp = renderTaskProgress(task)
            return (
              <div
                key={task.taskType}
                role="button"
                tabIndex={0}
                aria-label={`打开任务：${task.title}。${task.description}`}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onTaskClick?.(task)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTaskClick?.(task) }
                }}
              >
                {task.isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate">{task.title}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-2 shrink-0">
                      +{rp.reward}
                    </span>
                  </div>
                  <Progress value={rp.progress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {task.description}
                    {!task.isCompleted && task.currentValue > 0 && (
                      <span className="ml-1">({rp.label})</span>
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
