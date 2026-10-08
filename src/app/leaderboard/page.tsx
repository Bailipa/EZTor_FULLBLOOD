'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { LeaderboardTable } from '@/features/gamification/components/LeaderboardTable'
import { WarZoneCard } from '@/features/gamification/components/WarZoneCard'
import { NicknameDialog } from '@/features/gamification/components/NicknameDialog'
import { StreakCalendar } from '@/features/gamification/components/StreakCalendar'
import { CombatPowerBadge } from '@/features/gamification/components/CombatPowerBadge'
import { Loader2, Pencil, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SharePopover } from '@/components/share/SharePopover'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { Card, CardContent } from '@/components/ui/card'

export default function LeaderboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [nicknameOpen, setNicknameOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const { currentStep, isActive, nextStep } = useOnboarding()
  const [onboardingNicknameSet, setOnboardingNicknameSet] = useState(false)
  const hasAutoOpenedShareRef = useRef(false)
  const [profile, setProfile] = useState<{
    nickname: string | null
    combatPower: number
    currentStreak: number
    longestStreak: number
    provider: 'xiaoying' | 'local'
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
      return
    }
    if (status !== 'authenticated') return

    fetch('/api/game/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setProfile(data.data)
          // 6.1: 非 onboarding 状态下，无昵称时弹昵称框
          if (!data.data.nickname && !isActive) {
            setNicknameOpen(true)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status, router, isActive])

  // Onboarding step 6: force nickname dialog
  useEffect(() => {
    if (isActive && currentStep === 6 && profile) {
      if (profile.nickname) {
        setOnboardingNicknameSet(true)
      } else {
        setNicknameOpen(true)
      }
    }
  }, [isActive, currentStep, profile])

  // Onboarding step 6: auto-open share popover after nickname is set (一次性)
  useEffect(() => {
    if (isActive && currentStep === 6 && onboardingNicknameSet && !nicknameOpen && !hasAutoOpenedShareRef.current) {
      hasAutoOpenedShareRef.current = true
      setAutoCloseSeconds(3)
      setShareOpen(true)
    }
  }, [isActive, currentStep, onboardingNicknameSet, nicknameOpen])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session?.user) return null

  return (
    <div className="relative h-screen bg-background transition-colors duration-300 flex flex-col">
      <AppLayout>
        <div data-workspace-page data-workspace-ranking className="flex flex-col h-full overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <div data-workspace-ranking-summary className="flex flex-col gap-2 sm:gap-4">
            <div data-workspace-toolbar className="indigo-page-header flex items-center justify-start gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAutoCloseSeconds(0)
                    setShareOpen(true)
                  }}
                  className="size-8 p-0 sm:h-8 sm:w-auto sm:px-2.5"
                  aria-label="分享成果"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">分享成果</span>
                </Button>
                <CombatPowerBadge refreshKey={refreshKey} hideStreak compact />
              </div>
            </div>

            {profile && (
              <div data-workspace-ranking-profile className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4">
                {profile.nickname && (
                  <span className="flex min-w-0 max-w-[55vw] items-center gap-1 text-sm text-foreground sm:max-w-none">
                    <span className="truncate font-medium">{profile.nickname}</span>
                    <button
                      onClick={() => setNicknameOpen(true)}
                      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="修改昵称"
                      aria-label="修改昵称"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                <StreakCalendar
                  currentStreak={profile.currentStreak}
                  longestStreak={profile.longestStreak}
                />
              </div>
            )}
          </div>

          {profile?.provider === 'xiaoying' && !profile?.nickname && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 text-xs">小应</span>
                  <span>你通过小应账号登录,但还没同步昵称到榜单</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => { window.location.href = '/api/auth/xiaoying/start?redirectTo=/leaderboard' }}
                >
                  立即同步小应昵称
                </Button>
              </CardContent>
            </Card>
          )}

          <div data-workspace-ranking-grid className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,2.15fr)] lg:items-start">
            <aside aria-label="我的学区">
              <WarZoneCard refreshKey={refreshKey} />
            </aside>
            <section aria-label="学力排行榜" className="min-w-0">
              <LeaderboardTable refreshKey={refreshKey} />
            </section>
          </div>
        </div>
      </AppLayout>

      <NicknameDialog
        open={nicknameOpen}
        onOpenChange={(open) => {
          if (isActive && currentStep === 6 && !onboardingNicknameSet && !open) {
            return
          }
          setNicknameOpen(open)
        }}
        onSuccess={(nickname, cost) => {
          setProfile((prev) => prev ? { ...prev, nickname, combatPower: prev.combatPower - cost } : prev)
          setRefreshKey((k) => k + 1)
          setOnboardingNicknameSet(true)
          setNicknameOpen(false)
        }}
        hideCloseButton={isActive && currentStep === 6 && !onboardingNicknameSet}
      />

      <SharePopover
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open)
          if (!open) setAutoCloseSeconds(0)
        }}
        userId={session.user.id}
        autoCloseSeconds={autoCloseSeconds}
      />

      {/* 引导步骤 6：排行榜介绍 + 分享 + 下一步 */}
      {isActive && currentStep === 6 && onboardingNicknameSet && (
        <div
          className={`fixed left-4 right-4 transition-opacity ${shareOpen ? 'z-40 pointer-events-none opacity-60' : 'z-50'}`}
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">🏆 排行榜</h3>
              <p className="text-sm text-muted-foreground mb-3">
                昵称已设置！这里展示你的学区排名和学力，努力成为「英帝」吧！
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 className="w-4 h-4 mr-1" />
                  分享一下
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => { nextStep(); router.push('/') }}
                >
                  下一步
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
