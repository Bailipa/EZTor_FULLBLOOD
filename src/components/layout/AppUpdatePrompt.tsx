'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, Sparkles, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { isDesktopApp } from '@/lib/appEnv'
import { useAppUpdate } from '@/hooks/useAppUpdate'

const REMINDER_KEY = 'eztor_update_reminder'
const REMINDER_MS = 24 * 60 * 60 * 1000 // 点「稍后」24h 内不再提示同版本

function readReminder(): { version: string; remindAt: number } | null {
  try {
    const raw = localStorage.getItem(REMINDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.version && typeof parsed.remindAt === 'number') return parsed
    return null
  } catch {
    return null
  }
}

function writeReminder(version: string, remindAt: number) {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify({ version, remindAt }))
  } catch {
    /* 忽略 */
  }
}

/**
 * 桌面端自动更新提示（右下角卡片，业内标准交互）：
 *   available   → 「发现新版本 vX」+ 立即更新 / 稍后（24h 内不再提示同版本）
 *   downloading → 版本 + 下载进度条
 *   ready       → 「新版本已就绪」+ 重启更新（quitAndInstall：自动退出/静默安装/自动重启）
 *   error       → 更新失败提示（可关闭）
 * checking / uptodate 不打扰用户。用户确认后才开始下载，不默认自动下载。
 */
export function AppUpdatePrompt() {
  const update = useAppUpdate()
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [suppressed, setSuppressed] = useState(false)

  // 「稍后」抑制判断放在 effect（避免 render 里调 Date.now 的纯度限制）：
  // available 状态或版本变化时，依据 localStorage 的 reminder 决定是否抑制提示
  useEffect(() => {
    if (update.status === 'available' && update.version) {
      const r = readReminder()
      setSuppressed(!!(r && r.version === update.version && r.remindAt > Date.now()))
    }
  }, [update.status, update.version])

  if (!isDesktopApp() || typeof window === 'undefined') return null
  if (!update.status || update.status === 'checking' || update.status === 'uptodate') return null

  const versionText = update.version ? ` v${update.version}` : ''

  if (update.status === 'available' && update.version) {
    if (suppressed) return null
    return (
      <Card className="fixed bottom-4 right-4 z-50 w-[320px] p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">发现新版本{versionText}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          检测到新版本，是否立即更新？下载完成后一键重启即可生效。
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1 gap-1.5"
            onClick={() => window.eztor?.downloadUpdate?.()}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            立即更新
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              writeReminder(update.version!, Date.now() + REMINDER_MS)
              setSuppressed(true)
            }}
          >
            稍后
          </Button>
        </div>
      </Card>
    )
  }

  if (update.status === 'downloading') {
    const pct = update.percent ?? 0
    return (
      <Card className="fixed bottom-4 right-4 z-50 w-[320px] p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">正在更新 EZTor{versionText}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">新版本正在下载，完成后点击重启即可生效</p>
        <div className="mt-3 flex items-center gap-2">
          <Progress value={pct} className="h-1.5" />
          <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
      </Card>
    )
  }

  if (update.status === 'ready') {
    return (
      <Card className="fixed bottom-4 right-4 z-50 w-[320px] p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">新版本已就绪{versionText}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          点击「重启更新」，应用将自动退出、安装并重新打开，全程无需手动操作
        </p>
        <Button className="mt-3 w-full gap-1.5" onClick={() => window.eztor?.installUpdate?.()}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          重启更新
        </Button>
      </Card>
    )
  }

  if (errorDismissed) return null
  return (
    <Card className="fixed bottom-4 right-4 z-50 w-[320px] p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <X className="w-4 h-4 text-destructive" aria-hidden="true" />
          <span className="text-sm font-semibold text-destructive">检查更新失败</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setErrorDismissed(true)} aria-label="关闭">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        网络异常或更新源不可用，可稍后重试，或前往下载页手动安装最新版
      </p>
    </Card>
  )
}
