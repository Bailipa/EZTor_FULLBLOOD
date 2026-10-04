'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useInterfaceStyle } from '@/components/interface-style-provider'
import { INTERFACE_STYLES } from '@/lib/interfaceStyle'
import styles from '@/components/ai/translation-workspace.module.css'
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
  ClipboardList,
  MonitorDown,
  SlidersHorizontal,
  ChevronDown,
  Trash2,
  HardDrive,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { DanmakuSettingsContent } from '@/components/me/DanmakuSettings'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DonationDialog } from '@/components/home/DonationModal'
import { DanmakuToggleButton } from '@/components/home/DanmakuToggleButton'
import { FeatureLockedDialog } from '@/features/gamification/components/FeatureLockedDialog'
import { FEATURE_UNLOCK_THRESHOLDS } from '@/features/gamification/constants'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useAppVersion } from '@/hooks/useAppVersion'
import { getAiHistoryBytes, clearAiHistory, formatBytes } from '@/lib/aiHistoryCache'
import { speakText } from '@/lib/ttsBrowser'
import { playSavedFeedbackSound } from '@/lib/feedbackSounds'
import {
  defaultExperiencePreferences,
  isHapticFeedbackAvailable,
  readExperiencePreferences,
  saveExperiencePreferences,
  type ExperiencePreferences,
} from '@/lib/experiencePreferences'

const GameWidget = dynamic(() => import('@/components/ui/game/GameWidget').then((module) => module.GameWidget), { loading: () => <span className="text-xs text-muted-foreground">载入游戏…</span> })

export default function MePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const qqGroupUrl = useQQGroupUrl()
  const isAuthenticated = status === 'authenticated' && !!session?.user
  const appVer = useAppVersion()
  const interfaceStyle = useInterfaceStyle()

  const [combatPower, setCombatPower] = useState<number | null>(null)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false)
  const [lockedFeatureName, setLockedFeatureName] = useState('')
  const [lockedFeaturePower, setLockedFeaturePower] = useState(0)

  const [dailyGoal, setDailyGoal] = useState(20)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('20:00')
  const [autoSaveWords, setAutoSaveWords] = useState(true)
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true)
  const [showImportExportActions, setShowImportExportActions] = useState(false)
  const [devicePrefs, setDevicePrefs] = useState<ExperiencePreferences>(
    defaultExperiencePreferences,
  )
  const [hapticsAvailable, setHapticsAvailable] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [prefsLoadError, setPrefsLoadError] = useState(false)

  useEffect(() => {
    setDevicePrefs(readExperiencePreferences())
    setHapticsAvailable(isHapticFeedbackAvailable())
  }, [])
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [aiCacheBytes, setAiCacheBytes] = useState(0)

  useEffect(() => {
    setAiCacheBytes(getAiHistoryBytes())
  }, [])

  const handleClearAiCache = () => {
    const { removed } = clearAiHistory()
    setAiCacheBytes(getAiHistoryBytes())
    if (removed > 0) {
      toast.success(`已清理 AI 聊天缓存，释放 ${formatBytes(removed)}`)
    } else {
      toast.info('没有可清理的 AI 缓存')
    }
  }

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
          setAutoSaveWords(data.data.autoSaveWords ?? true)
          setSoundEffectsEnabled(data.data.soundEffectsEnabled ?? true)
          setShowImportExportActions(data.data.showImportExportActions === true)
          if (data.data.reviewReminderTime) {
            setReminderTime(data.data.reviewReminderTime)
          }
        } else {
          setPrefsLoadError(true)
        }
      })
      .catch(() => setPrefsLoadError(true))
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
          autoSaveWords,
          soundEffectsEnabled,
          showImportExportActions,
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

  const updateDevicePrefs = (patch: Partial<ExperiencePreferences>) => {
    setDevicePrefs(saveExperiencePreferences(patch))
  }

  const guardedHref = (requiresAuth: boolean) => (e: React.MouseEvent) => {
    // 仅真正未登录时拦截跳登录页；loading（会话加载中）放行，由服务器中间件裁决
    if (requiresAuth && status === 'unauthenticated') {
      e.preventDefault()
      router.push('/auth/signin')
    }
  }

  const openLockedDialog = (featureName: string, requiredPower: number) => {
    setLockedFeatureName(featureName)
    setLockedFeaturePower(requiredPower)
    setLockedDialogOpen(true)
  }

  const isDanmakuUnlocked = combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.DANMAKU
  const isGameUnlocked = combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.MINI_GAME

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AppLayout>
      <div className={styles.mePage}>
        <div className={styles.meContent}>
          <header className={styles.meHeading}>
            <h1>设置</h1>
            {isAuthenticated && (
              <p className="text-sm text-muted-foreground">
                已登录:{session?.user?.name ?? session?.user?.email ?? ''}
              </p>
            )}
          </header>

          <div className={styles.meGrid}>
            <section className="min-w-0 space-y-8" aria-label="个人偏好">
              <Card className={styles.settingsBlock}>
                <h2 className={styles.sectionLabel}>外观与布局</h2>
                <CardContent className="p-4 space-y-5">
                  <div>
                    <h3 className="font-medium">界面风格</h3>
                    <p className="mt-1 mb-4 text-xs text-muted-foreground">
                      {isAuthenticated ? '选择后自动保存到账号' : '选择后保存在此浏览器'}
                    </p>
                    <fieldset
                      className={styles.styleChoices}
                      aria-label="界面风格"
                      aria-busy={interfaceStyle.saving}
                    >
                      {INTERFACE_STYLES.map((option) => (
                        <label
                          key={option.id}
                          className={styles.styleChoice}
                          data-selected={interfaceStyle.style === option.id}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name="interface-style"
                            value={option.id}
                            checked={interfaceStyle.style === option.id}
                            disabled={!interfaceStyle.ready || interfaceStyle.saving}
                            onChange={() => void interfaceStyle.selectStyle(option.id)}
                          />
                          <span
                            className={styles.stylePreview}
                            data-preview={option.id}
                            aria-hidden="true"
                          >
                            <i />
                            <span>
                              <b />
                              <b />
                              <b />
                            </span>
                          </span>
                          <strong>
                            {option.label}
                            {interfaceStyle.style === option.id ? ' ✓' : ''}
                          </strong>
                          <small>{option.description}</small>
                        </label>
                      ))}
                    </fieldset>
                    {interfaceStyle.saving && (
                      <p role="status" className="mt-2 text-xs text-muted-foreground">
                        正在保存…
                      </p>
                    )}
                    {interfaceStyle.error && (
                      <p role="alert" className="mt-2 text-xs text-destructive">
                        {interfaceStyle.error}
                        {!interfaceStyle.ready && (
                          <button
                            type="button"
                            onClick={interfaceStyle.retry}
                            className="ml-2 min-h-9 underline"
                          >
                            重试
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t pt-4">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-medium">主题外观</p>
                      <p className="text-xs text-muted-foreground">切换浅色 / 深色 / 跟随系统</p>
                    </div>
                    <ModeToggle />
                  </div>
                </CardContent>
              </Card>
              {isAuthenticated && (
                <Card className={styles.settingsBlock}>
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-0.5">
                      <p className="font-medium">学习与反馈设置</p>
                      <p className="text-xs text-muted-foreground">
                        自动保存和提示音开关随账号同步；音量、朗读、触感、动效、辉光和显示设置保存在本设备
                      </p>
                    </div>

                    {prefsLoaded ? (
                      <>
                        {prefsLoadError && (
                          <p role="status" className="text-sm text-destructive">
                            设置读取失败。当前显示默认值；保存前请确认下面的选项。
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">自动保存查词结果</p>
                            <p className="text-xs text-muted-foreground">
                              查到公共词条后，3 秒倒计时结束会加入生词本；可在词条上取消
                            </p>
                          </div>
                          <Switch
                            checked={autoSaveWords}
                            onCheckedChange={setAutoSaveWords}
                            aria-label="自动保存查词结果"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">显示导入与导出入口</p>
                            <p className="text-xs text-muted-foreground">
                              开启后显示 CSV 导入、导出和共享词库导入按钮；默认隐藏
                            </p>
                          </div>
                          <Switch
                            checked={showImportExportActions}
                            onCheckedChange={setShowImportExportActions}
                            aria-label="显示导入与导出入口"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">学习提示音</p>
                            <p className="text-xs text-muted-foreground">
                              控制答题和保存反馈；只同步开关，音量保存在本设备
                            </p>
                          </div>
                          <Switch
                            checked={soundEffectsEnabled}
                            onCheckedChange={setSoundEffectsEnabled}
                            aria-label="学习提示音"
                          />
                        </div>

                        <label className="block space-y-2">
                          <span className="flex justify-between gap-3 text-sm font-medium">
                            <span>提示音音量</span>
                            <span aria-live="polite">{devicePrefs.sfxVolume}%</span>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={devicePrefs.sfxVolume}
                            onChange={(event) =>
                              updateDevicePrefs({ sfxVolume: Number(event.target.value) })
                            }
                            className="min-h-11 w-full accent-primary"
                            aria-label="提示音音量，本设备"
                          />
                          <span className="block text-xs text-muted-foreground">
                            默认 30%；0% 会静音。本设备设置
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={!soundEffectsEnabled || devicePrefs.sfxVolume === 0}
                            onClick={() => playSavedFeedbackSound(soundEffectsEnabled)}
                          >
                            试听提示音
                          </Button>
                        </label>

                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">答题时自动朗读</p>
                            <p className="text-xs text-muted-foreground">
                              默认关闭；手动点发音按钮始终可播放
                            </p>
                          </div>
                          <Switch
                            checked={devicePrefs.autoSpeak}
                            onCheckedChange={(enabled) => updateDevicePrefs({ autoSpeak: enabled })}
                            aria-label="答题时自动朗读"
                          />
                        </div>

                        <label className="block space-y-2">
                          <span className="flex justify-between gap-3 text-sm font-medium">
                            <span>单词发音音量</span>
                            <span aria-live="polite">{devicePrefs.speechVolume}%</span>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={devicePrefs.speechVolume}
                            onChange={(event) =>
                              updateDevicePrefs({ speechVolume: Number(event.target.value) })
                            }
                            className="min-h-11 w-full accent-primary"
                            aria-label="单词发音音量，本设备"
                          />
                          <span className="block text-xs text-muted-foreground">
                            独立于答题提示音；本设备设置
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={devicePrefs.speechVolume === 0}
                            onClick={() => speakText('Example pronunciation.')}
                          >
                            试听单词发音
                          </Button>
                        </label>

                        <label className="block space-y-2">
                          <span className="block text-sm font-medium">触感反馈</span>
                          <select
                            value={devicePrefs.haptics}
                            onChange={(event) =>
                              updateDevicePrefs({
                                haptics: event.target.value as ExperiencePreferences['haptics'],
                              })
                            }
                            disabled={!hapticsAvailable}
                            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base disabled:opacity-60"
                            aria-label="触感反馈强度，本设备"
                          >
                            <option value="off">关闭</option>
                            <option value="light">轻</option>
                            <option value="standard">标准</option>
                          </select>
                          <span className="block text-xs text-muted-foreground">
                            {hapticsAvailable
                              ? '轻/标准仅映射为短振动；本设备设置'
                              : '当前设备不可用'}
                          </span>
                        </label>

                        <label className="block space-y-2">
                          <span className="block text-sm font-medium">界面动效</span>
                          <select
                            value={devicePrefs.motion}
                            onChange={(event) =>
                              updateDevicePrefs({
                                motion: event.target.value as ExperiencePreferences['motion'],
                              })
                            }
                            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                            aria-label="界面动效，本设备"
                          >
                            <option value="system">跟随系统</option>
                            <option value="reduce">减少</option>
                            <option value="full">完整（系统减少偏好优先）</option>
                          </select>
                          <span className="block text-xs text-muted-foreground">
                            本设备设置；系统已要求减少动效时始终遵循系统
                          </span>
                        </label>

                        <label className="block space-y-2">
                          <span className="block text-sm font-medium">辉金主题辉光</span>
                          <select
                            value={devicePrefs.glow}
                            onChange={(event) =>
                              updateDevicePrefs({
                                glow: event.target.value as ExperiencePreferences['glow'],
                              })
                            }
                            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                            aria-label="辉金主题辉光，本设备"
                          >
                            <option value="rich">浓郁（默认）</option>
                            <option value="subdued">收敛</option>
                          </select>
                          <span className="block text-xs text-muted-foreground">
                            辉金下生效；外观主题可用上方快捷切换
                          </span>
                        </label>

                        <div className="space-y-3 border-t border-border pt-4">
                          <p className="text-sm font-medium">查词结果显示</p>
                          {(
                            [
                              ['showPhonetic', '音标'],
                              ['showPos', '词性'],
                              ['showExample', '例句'],
                            ] as const
                          ).map(([key, label]) => (
                            <div
                              key={key}
                              className="flex min-h-11 items-center justify-between gap-4"
                            >
                              <span className="text-sm">显示{label}</span>
                              <Switch
                                checked={devicePrefs[key]}
                                onCheckedChange={(enabled) => updateDevicePrefs({ [key]: enabled })}
                                aria-label={`查词结果显示${label}`}
                              />
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground">
                            本设备设置；默认全部显示。提示音设置不影响手动发音
                          </p>
                        </div>

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
                          <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
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
              <Card className={styles.settingsBlock}>
                <h2 className={styles.sectionLabel}>学习工具</h2>
                <CardContent className="p-0 divide-y divide-border">
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
            </section>
            <section className="min-w-0 space-y-8" aria-label="设置与支持">
              <Card className={styles.settingsBlock}>
                <h2 className={styles.sectionLabel}>关于 EZTor</h2>
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

                  {/* 下载入口保留已装版本和可用更新信息。 */}
                  <Link
                    href="/download"
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <MonitorDown className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">下载APP</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-mono tabular-nums text-muted-foreground">
                        {appVer.mounted && appVer.isApp
                          ? `v${appVer.installedVersion ?? '?'}`
                          : `v${appVer.latestVersion ?? '?'}`}
                      </span>
                      {appVer.mounted &&
                        appVer.isApp &&
                        appVer.hasUpdate === true &&
                        appVer.latestVersion && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            → v{appVer.latestVersion}
                          </span>
                        )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </span>
                  </Link>
                </CardContent>
              </Card>
              <Card className={styles.settingsBlock}>
                <h2 className={styles.sectionLabel}>帮助与支持</h2>
                <CardContent className="p-0 divide-y divide-border">
                  <button
                    type="button"
                    onClick={handleClearAiCache}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="flex items-center gap-3">
                      <HardDrive className="w-5 h-5 text-muted-foreground" />
                      <span className="font-medium">清除 AI 聊天缓存</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {aiCacheBytes > 0 && (
                        <span className="text-xs text-muted-foreground">
                          占用 {formatBytes(aiCacheBytes)}
                        </span>
                      )}
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.open(qqGroupUrl, '_blank', 'noopener,noreferrer')}
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
                        <span className="font-medium">请我喝一杯咖啡</span>
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
            </section>
          </div>
          {!isAuthenticated ? (
            <Button className="w-full" size="lg" onClick={() => router.push('/auth/signin')}>
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
