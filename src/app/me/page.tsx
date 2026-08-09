'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { useQQGroupUrl } from '@/lib/siteConfig'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Trophy,
  MessageSquare,
  MessageCircle,
  ExternalLink,
  LogOut,
  ChevronRight,
  Loader2,
  MonitorPlay,
  Gamepad2,
  Coffee,
  FileSearch,
  Lock,
  BookOpen,
  ClipboardList,
  MonitorDown,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react'
import { GameWidget } from '@/components/ui/game/GameWidget'
import { DanmakuSettingsContent } from '@/components/me/DanmakuSettings'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { DonationDialog } from '@/components/home/DonationModal'
import { DanmakuToggleButton } from '@/components/home/DanmakuToggleButton'
import { FeatureLockedDialog } from '@/features/gamification/components/FeatureLockedDialog'
import { FEATURE_UNLOCK_THRESHOLDS } from '@/features/gamification/constants'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useAppVersion } from '@/hooks/useAppVersion'

export default function MePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const qqGroupUrl = useQQGroupUrl()
  const isAuthenticated = status === 'authenticated' && !!session?.user
  const appVer = useAppVersion()

  const [combatPower, setCombatPower] = useState<number | null>(null)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false)
  const [lockedFeatureName, setLockedFeatureName] = useState('')
  const [lockedFeaturePower, setLockedFeaturePower] = useState(0)

  const [dailyGoal, setDailyGoal] = useState(20)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('20:00')
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/game/profile')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setCombatPower(data.data.combatPower)
          }
        })
        .catch(() => {})
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/preferences')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setDailyGoal(data.data.dailyGoal ?? 20)
          setReminderEnabled(!!data.data.reviewReminderEnabled)
          if (data.data.reviewReminderTime) {
            setReminderTime(data.data.reviewReminderTime)
          }
        }
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true))
  }, [isAuthenticated])

  const savePrefs = async () => {
    setSavingPrefs(true)
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyGoal,
          reviewReminderEnabled: reminderEnabled,
          reviewReminderTime: reminderEnabled ? reminderTime : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('设置已保存')
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch {
      toast.error('保存失败，请重试')
    } finally {
      setSavingPrefs(false)
    }
  }

  const guardedHref =
    (requiresAuth: boolean) => (e: React.MouseEvent) => {
      if (requiresAuth && !isAuthenticated) {
        e.preventDefault()
        router.push('/auth/signin')
      }
    }

  const openLockedDialog = (featureName: string, requiredPower: number) => {
    setLockedFeatureName(featureName)
    setLockedFeaturePower(requiredPower)
    setLockedDialogOpen(true)
  }

  const isDanmakuUnlocked =
    combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.DANMAKU
  const isGameUnlocked =
    combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.MINI_GAME

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-4 md:p-8 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] xl:pb-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">我的</h1>
            {isAuthenticated && (
              <p className="text-sm text-muted-foreground">
                已登录:{session?.user?.name ?? session?.user?.email ?? ''}
              </p>
            )}
          </header>

          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <Link
                href="/history"
                onClick={guardedHref(true)}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">生词本</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <Link
                href="/leaderboard"
                onClick={guardedHref(true)}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">排行榜</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <Link
                href="/chat"
                onClick={guardedHref(true)}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">说话</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-3">
                  <MonitorPlay className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">弹幕复习</span>
                </span>
                {isAuthenticated ? (
                  <DanmakuToggleButton
                    locked={!isDanmakuUnlocked}
                    onLockedClick={() =>
                      openLockedDialog('弹幕复习', FEATURE_UNLOCK_THRESHOLDS.DANMAKU)
                    }
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/auth/signin')}
                    className="gap-1.5 shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>登录解锁</span>
                  </Button>
                )}
              </div>

              <Collapsible className="border-t">
                <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-3">
                    <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">弹幕调节</span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <DanmakuSettingsContent />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <span className="flex items-center gap-3">
                  <Gamepad2 className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">小游戏</span>
                </span>
                {isAuthenticated ? (
                  isGameUnlocked ? (
                    <GameWidget />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openLockedDialog('小游戏', FEATURE_UNLOCK_THRESHOLDS.MINI_GAME)
                      }
                      className="gap-1.5 shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>未解锁</span>
                    </Button>
                  )
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/auth/signin')}
                    className="gap-1.5 shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>登录解锁</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <Link
                href="/me/plan"
                onClick={guardedHref(true)}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">作者的计划</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>

              {/* 版本信息：App 内显示已装版本 + 更新状态；浏览器显示当前 web 版本（点进下载页） */}
              {appVer.mounted && appVer.isApp && appVer.hasUpdate === false ? (
                <div className="flex items-center justify-between p-4">
                  <span className="flex items-center gap-3">
                    <MonitorDown className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">当前版本</span>
                  </span>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    v{appVer.installedVersion ?? '?'}
                  </span>
                </div>
              ) : (
                <Link
                  href="/download"
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <MonitorDown className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">
                      {appVer.mounted && appVer.isApp ? '发现新版本' : '当前版本'}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-mono tabular-nums text-muted-foreground">
                      {appVer.mounted && appVer.isApp
                        ? `v${appVer.installedVersion ?? '?'}`
                        : `v${appVer.latestVersion ?? '?'}`}
                    </span>
                    {appVer.mounted && appVer.isApp && appVer.hasUpdate === true && appVer.latestVersion && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        → v{appVer.latestVersion}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </span>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 divide-y divide-border">
              <button
                type="button"
                onClick={() =>
                  window.open(qqGroupUrl, '_blank', 'noopener,noreferrer')
                }
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">反馈</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <a
                href="https://github.com/Bailipa/EZTor_FULLBLOOD"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <ExternalLink className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">GitHub</span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </a>

              <DonationDialog>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="flex items-center gap-3">
                    <Coffee className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">支持开发者</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </DonationDialog>

              {!isAuthenticated && (
                <a
                  href="/flywheel-preview.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <FileSearch className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">功能预览</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium">主题外观</p>
                <p className="text-xs text-muted-foreground">
                  切换浅色 / 深色 / 跟随系统
                </p>
              </div>
              <ModeToggle />
            </CardContent>
          </Card>

          {isAuthenticated && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-0.5">
                  <p className="font-medium">每日目标与复习提醒</p>
                  <p className="text-xs text-muted-foreground">
                    设定每日默写目标，到点提醒你完成复习
                  </p>
                </div>

                {prefsLoaded ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">每日默写目标（词）</label>
                      <Input
                        type="number"
                        min={5}
                        max={500}
                        value={dailyGoal}
                        onChange={(e) => setDailyGoal(Number(e.target.value))}
                        className="w-32"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">复习提醒</p>
                        <p className="text-xs text-muted-foreground">
                          未达成目标时到点提醒一次
                        </p>
                      </div>
                      <Switch
                        checked={reminderEnabled}
                        onCheckedChange={setReminderEnabled}
                      />
                    </div>

                    {reminderEnabled && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">提醒时间</label>
                        <Input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="w-32"
                        />
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={savePrefs}
                      disabled={savingPrefs}
                      className="gap-1.5 shadow-sm"
                    >
                      {savingPrefs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      保存设置
                    </Button>
                  </>
                ) : (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!isAuthenticated ? (
            <Button
              className="w-full"
              size="lg"
              onClick={() => router.push('/auth/signin')}
            >
              <LogOut className="w-4 h-4 mr-2 rotate-180" />
              登录
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full text-destructive/70 hover:text-destructive"
                  size="lg"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认退出登录?</AlertDialogTitle>
                  <AlertDialogDescription>
                    退出后您需要重新输入账号密码才能访问您的生词本。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      await signOut({ redirect: false })
                      router.push('/')
                    }}
                  >
                    确认退出
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <FeatureLockedDialog
        open={lockedDialogOpen}
        onOpenChange={setLockedDialogOpen}
        featureName={lockedFeatureName}
        requiredPower={lockedFeaturePower}
        currentPower={combatPower ?? 0}
      />
    </AppLayout>
  )
}