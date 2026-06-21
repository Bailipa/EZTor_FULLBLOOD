'use client'

import { MonitorPlay, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDanmakuStore } from '@/stores/danmakuStore'

interface DanmakuToggleButtonProps {
  locked?: boolean
  onLockedClick?: () => void
}

export function DanmakuToggleButton({ locked = false, onLockedClick }: DanmakuToggleButtonProps) {
  const status = useDanmakuStore((s) => s.status)
  const countdownValue = useDanmakuStore((s) => s.countdownValue)
  const toggle = useDanmakuStore((s) => s.toggle)

  if (locked) {
    return (
      <Button
        variant="outline"
        onClick={onLockedClick}
        className="gap-1.5 sm:gap-2 shadow-sm h-8 min-w-[120px] px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm text-muted-foreground"
        aria-label="弹幕复习(未解锁)"
      >
        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
        <span>弹幕复习</span>
      </Button>
    )
  }

  return (
    <Button
      variant={status === 'active' ? 'default' : 'outline'}
      onClick={toggle}
      className="gap-1.5 sm:gap-2 shadow-sm transition-all h-8 min-w-[120px] px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm text-primary"
      aria-label={
        status === 'counting'
          ? `弹幕倒计时 ${countdownValue}`
          : status === 'active'
            ? '关闭弹幕复习'
            : status === 'empty'
              ? '先添加单词吧'
              : '开启弹幕复习'
      }
      aria-pressed={status === 'active'}
    >
      {status === 'counting' && (
        <span className="font-mono tabular-nums" aria-hidden="true">
          {countdownValue}
        </span>
      )}
      {status === 'active' && (
        <>
          <MonitorPlay className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          <span>关闭弹幕复习</span>
        </>
      )}
      {status === 'empty' && <span>先添加单词吧</span>}
      {status === 'idle' && (
        <>
          <MonitorPlay className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          <span>开启弹幕复习</span>
        </>
      )}
    </Button>
  )
}