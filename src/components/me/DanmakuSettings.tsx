'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Gauge, ListOrdered, Eye, Type, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  useDanmakuSettingsStore,
  DANMAKU_SETTINGS_LIMITS,
  DANMAKU_SETTINGS_DEFAULTS,
} from '@/stores/danmakuSettingsStore'
import { useDanmakuStore } from '@/stores/danmakuStore'

function SettingRow({
  icon,
  label,
  value,
  hint,
  min,
  max,
  step,
  current,
  onChange,
  onReset,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  min: number
  max: number
  step: number
  current: number
  onChange: (v: number) => void
  onReset?: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
              aria-label={`重置${label}`}
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[current]}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      />
    </div>
  )
}

export function DanmakuSettingsContent() {
  const [mounted, setMounted] = useState(false)
  const speed = useDanmakuSettingsStore((s) => s.speed)
  const amount = useDanmakuSettingsStore((s) => s.amount)
  const opacity = useDanmakuSettingsStore((s) => s.opacity)
  const size = useDanmakuSettingsStore((s) => s.size)
  const setSpeed = useDanmakuSettingsStore((s) => s.setSpeed)
  const setAmount = useDanmakuSettingsStore((s) => s.setAmount)
  const setOpacity = useDanmakuSettingsStore((s) => s.setOpacity)
  const setSize = useDanmakuSettingsStore((s) => s.setSize)
  const reset = useDanmakuSettingsStore((s) => s.reset)
  const danmakuStatus = useDanmakuStore((s) => s.status)

  useEffect(() => {
    setMounted(true)
  }, [])

  // persist 会在客户端水合后才有已保存值：挂载前返回 null，避免 SSR 默认值与
  // 客户端保存值不一致导致的水合警告（与 danmaku.tsx 的 mounted 模式一致）
  if (!mounted) return null

  const statusHint =
    danmakuStatus === 'active'
      ? '弹幕复习运行中'
      : danmakuStatus === 'counting'
        ? '弹幕开启中…'
        : danmakuStatus === 'empty'
          ? '词库暂无单词，先添加单词吧'
          : '弹幕未开启，调整不会生效'

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        <span
          className={
            danmakuStatus === 'active'
              ? 'inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5'
              : 'inline-block w-2 h-2 rounded-full bg-muted-foreground/40 mr-1.5'
          }
          aria-hidden="true"
        />
        {statusHint}
      </p>
      <SettingRow
        icon={<Gauge className="w-4 h-4" aria-hidden="true" />}
        label="弹幕速度"
        value={`${speed.toFixed(1)}x`}
        hint="越大越快，不改变数量"
        {...DANMAKU_SETTINGS_LIMITS.speed}
        current={speed}
        onChange={setSpeed}
        onReset={() => setSpeed(DANMAKU_SETTINGS_DEFAULTS.speed)}
      />
      <SettingRow
        icon={<ListOrdered className="w-4 h-4" aria-hidden="true" />}
        label="单词量"
        value={`${amount.toFixed(1)}x · ~${Math.max(1, Math.min(8, Math.ceil(3 * amount)))}条/批`}
        hint="越大越多"
        {...DANMAKU_SETTINGS_LIMITS.amount}
        current={amount}
        onChange={setAmount}
        onReset={() => setAmount(DANMAKU_SETTINGS_DEFAULTS.amount)}
      />
      <SettingRow
        icon={<Eye className="w-4 h-4" aria-hidden="true" />}
        label="不透明度"
        value={`${opacity}%`}
        hint="越高越不透明"
        {...DANMAKU_SETTINGS_LIMITS.opacity}
        current={opacity}
        onChange={setOpacity}
        onReset={() => setOpacity(DANMAKU_SETTINGS_DEFAULTS.opacity)}
      />
      <SettingRow
        icon={<Type className="w-4 h-4" aria-hidden="true" />}
        label="弹幕大小"
        value={`${size.toFixed(1)}x`}
        hint="越大越醒目"
        {...DANMAKU_SETTINGS_LIMITS.size}
        current={size}
        onChange={setSize}
        onReset={() => setSize(DANMAKU_SETTINGS_DEFAULTS.size)}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-muted-foreground"
        onClick={reset}
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        恢复默认
      </Button>
    </div>
  )
}

export function DanmakuSettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-1.5 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm text-muted-foreground"
          aria-label="弹幕设置"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          <span className="sm:hidden xl:inline">调节</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>弹幕设置</DialogTitle>
          <DialogDescription>调节弹幕速度、单词量、不透明度与大小，实时生效</DialogDescription>
        </DialogHeader>
        <DanmakuSettingsContent />
      </DialogContent>
    </Dialog>
  )
}
