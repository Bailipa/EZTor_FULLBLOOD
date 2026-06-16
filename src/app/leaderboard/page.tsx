'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import MobileNavBar from '@/components/layout/MobileNavBar'
import { LeaderboardTable } from '@/features/gamification/components/LeaderboardTable'
import { WarZoneCard } from '@/features/gamification/components/WarZoneCard'
import { NicknameDialog } from '@/features/gamification/components/NicknameDialog'
import { StreakCalendar } from '@/features/gamification/components/StreakCalendar'
import { CombatPowerBadge } from '@/features/gamification/components/CombatPowerBadge'
import { Loader2, Pencil } from 'lucide-react'

export default function LeaderboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [nicknameOpen, setNicknameOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
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
          if (!data.data.nickname) {
            setNicknameOpen(true)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status, router])

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
            <CombatPowerBadge refreshKey={refreshKey} />
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
            <div className="lg:col-span-2">
              <LeaderboardTable refreshKey={refreshKey} />
            </div>
            <div className="space-y-4">
              <WarZoneCard refreshKey={refreshKey} />
            </div>
          </div>
        </div>
      </AppLayout>

      <MobileNavBar />

      <NicknameDialog
        open={nicknameOpen}
        onOpenChange={setNicknameOpen}
        onSuccess={(nickname, cost) => {
          setProfile((prev) => prev ? { ...prev, nickname, combatPower: prev.combatPower - cost } : prev)
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
