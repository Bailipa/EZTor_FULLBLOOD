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
  const [refreshKey, setRefreshKey] = useState(0)
  const { currentStep, isActive, nextStep } = useOnboarding()
  const [onboardingNicknameSet, setOnboardingNicknameSet] = useState(false)
  const hasAutoOpenedShareRef = useRef(false)
  const [profile, setProfile] = useState<{
    nickname: string | null
    combatPower: number
    currentStreak: number
    longestStreak: number
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
        <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">排行榜</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                className="gap-1.5"
                aria-label="雷霆分享"
              >
                <Share2 className="w-4 h-4" />
                雷霆分享
              </Button>
              <CombatPowerBadge refreshKey={refreshKey} />
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-4 flex-wrap">
              {profile.nickname && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  昵称：<span className="font-medium text-foreground">{profile.nickname}</span>
                  <button
                    onClick={() => setNicknameOpen(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="修改昵称"
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
            <div className="space-y-4">
              <WarZoneCard refreshKey={refreshKey} />
            </div>
            <div className="lg:col-span-2">
              <LeaderboardTable refreshKey={refreshKey} />
            </div>
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

      <SharePopover open={shareOpen} onOpenChange={setShareOpen} userId={session.user.id} />

      {/* 引导步骤 6：排行榜介绍 + 分享 + 下一步 */}
      {isActive && currentStep === 6 && onboardingNicknameSet && (
        <div className={`fixed left-4 right-4 z-50 ${shareOpen ? 'z-[60]' : ''}`} style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
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
