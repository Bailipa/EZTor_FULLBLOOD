'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HomeHeader } from '@/components/home/HomeHeader'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import AppLayout from '@/components/layout/AppLayout'
import { usePageView } from '@/lib/analytics'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap, BookOpen, AlertCircle, PenLine, Languages, ArrowUpRight, ArrowRight } from 'lucide-react'
import styles from '@/components/ai/translation-workspace.module.css'
import { DailyTaskCard } from '@/features/gamification/components/DailyTaskCard'
import { CombatPowerBadge, type CombatPowerSummary } from '@/features/gamification/components/CombatPowerBadge'
import { FeatureUnlockNotification } from '@/features/gamification/components/FeatureUnlockNotification'
import type { FeatureKey } from '@/features/gamification/constants'

const DailyFlashcard = dynamic(
  () => import('@/components/flashcard/FullscreenFlashcard').then((module) => module.FullscreenFlashcard),
  { ssr: false, loading: () => <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">载入单词卡…</div> },
)

export default function HomeContent() {
  usePageView('Home')
  const { currentStep, isActive, nextStep, completeOnboarding, startOnboarding } = useOnboarding()
  const router = useRouter()
  const [hasInteractedWithFlashcard, setHasInteractedWithFlashcard] = useState(false)
  const [flashcardOpenRequest, setFlashcardOpenRequest] = useState(0)

  const [unlockNotifOpen, setUnlockNotifOpen] = useState(false)
  const [unlockedFeatures, _setUnlockedFeatures] = useState<FeatureKey[]>([])
  const [taskRefreshKey, setTaskRefreshKey] = useState(0)
  const [profile, setProfile] = useState<CombatPowerSummary | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const profileRequestRef = useRef<Promise<CombatPowerSummary | null> | null>(null)
  const profileUserIdRef = useRef<string | null>(null)

  const { data: session, status } = useSession()
  const {
    promptLogin,
    LoginPromptDialog,
  } = useLoginPrompt()

  const isAuthenticated = status === 'authenticated' && !!session?.user

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobileViewport(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null)
      profileRequestRef.current = null
      profileUserIdRef.current = null
      return
    }

    let cancelled = false
    const userId = session?.user?.id ?? null
    if (profileUserIdRef.current !== userId) {
      profileUserIdRef.current = userId
      profileRequestRef.current = null
    }
    if (!profileRequestRef.current || taskRefreshKey > 0) {
      let request: Promise<CombatPowerSummary | null>
      request = fetch('/api/game/profile')
        .then((response) => response.json())
        .then((result) => {
          const data = result?.success ? result.data : null
          if (!data) return null
          return {
            combatPower: data.combatPower,
            currentStreak: data.currentStreak,
            dailyPowerGained: data.dailyPowerGained,
            dailyPowerCap: data.dailyPowerCap,
          } as CombatPowerSummary
        })
        .catch(() => null)
      profileRequestRef.current = request
      request.finally(() => {
        if (profileRequestRef.current === request) profileRequestRef.current = null
      })
    }
    profileRequestRef.current.then((data) => {
      if (!cancelled && data) setProfile(data)
    })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, session?.user?.id, taskRefreshKey])

  return (
    <div className="relative min-h-[100dvh] bg-background font-[family-name:var(--font-geist-sans)] transition-colors duration-300 flex flex-col md:h-dvh">
      <AppLayout>
        <div className="flex min-h-[calc(100dvh-var(--mobile-nav-space))] flex-col md:h-dvh md:min-h-0">
          <HomeHeader
            combatPower={profile?.combatPower ?? null}
            flashcardOpenRequest={flashcardOpenRequest}
            onFlashcardInteraction={() => {
              if (isAuthenticated) setTaskRefreshKey((key) => key + 1)
            }}
          />

          <main className={`min-h-0 flex-1 overflow-y-auto ${styles.canvas} ${styles.homeCanvas}`}>
            <div data-workspace-home className={styles.homePage}>
              <section data-home-lead className={styles.homeLead} aria-label="学习与查词">
                <div data-home-intro className={styles.homeIntro}>
                  <p className={styles.eyebrow}>我的学习</p>
                  <h2>温故，知新</h2>
                  <p className={styles.homeDescription}>从熟悉的单词出发，每次记牢一点。</p>
                  <Button className="mt-6 min-h-11 gap-3 rounded-lg px-5 shadow-none" onPointerEnter={() => { if (isAuthenticated) router.prefetch('/dictation') }} onFocus={() => { if (isAuthenticated) router.prefetch('/dictation') }} onClick={() => isAuthenticated ? router.push('/dictation') : promptLogin('默写复习')}>
                    <PenLine className="size-4" />开始默写<ArrowRight className="size-4" />
                  </Button>
                </div>
                <div data-home-shortcuts className={styles.learningLinks}>
                  <button onPointerEnter={() => { if (isAuthenticated) router.prefetch('/mistakes') }} onFocus={() => { if (isAuthenticated) router.prefetch('/mistakes') }} onClick={() => isAuthenticated ? router.push('/mistakes') : promptLogin('错词本')}>
                    <AlertCircle className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    <span><strong>错词本</strong><small>把易错的词，再巩固一遍</small></span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </button>
                  <button onPointerEnter={() => { if (isAuthenticated) router.prefetch('/history') }} onFocus={() => { if (isAuthenticated) router.prefetch('/history') }} onClick={() => isAuthenticated ? router.push('/history') : promptLogin('生词本')}>
                    <BookOpen className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    <span><strong>生词本</strong><small>回看收藏，整理所学</small></span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </button>
                  <Link href="/ai">
                    <Languages className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    <span><strong>翻译</strong><small>查一个词，读懂一句话</small></span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                </div>

              </section>

              <div data-home-grid>
                <section data-home-words className={styles.mobileFlashcard} aria-label="每日单词">
                  <DailyFlashcard embedded
                    onInteraction={() => { if (isAuthenticated) setHasInteractedWithFlashcard(true) }}
                    onSaved={() => { if (isAuthenticated) setTaskRefreshKey((key) => key + 1) }}
                  />
                </section>

                {isAuthenticated && (
                  <section data-home-progress className={styles.homeProgress} aria-label="今日进度">
                    <Card className={`${styles.progressSummary} py-0`}>
                      <CardContent className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5">
                        <h2 className="text-sm font-medium">学力进度</h2>
                        <CombatPowerBadge data={profile} />
                      </CardContent>
                    </Card>
                    <DailyTaskCard
                      refreshKey={taskRefreshKey}
                      defaultCollapsed
                      forceExpanded={!isMobileViewport}
                      onTaskClick={(task) => {
                        if (task.taskType === 'FLASHCARD_INTERACT') {
                          setFlashcardOpenRequest((request) => request + 1)
                        } else if (task.taskType === 'COMPLETE_REVIEWS' || task.taskType === 'REACH_ACCURACY') {
                          router.push('/dictation')
                        } else {
                          router.push('/me')
                        }
                      }}
                    />
                  </section>
                )}
                {status === 'unauthenticated' && (
                  <aside className={styles.guestNote} aria-label="账号同步">
                    <BookOpen className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <p>登录，留住所学。<span>生词与学习记录随账号保存。</span></p>
                    <Link href="/auth/signin" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary">登录<ArrowRight className="size-4" /></Link>
                  </aside>
                )}
              </div>
            </div>
            <footer data-home-footer className={styles.homeFooter}>
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                ICP备案号：粤ICP备2026008729号
              </a>
            </footer>
          </main>
        </div>
      </AppLayout>

      {/* 新手引导入口悬浮按钮（仅登录用户） */}
      {isAuthenticated && !isActive && !hasInteractedWithFlashcard && (
        <button
          onClick={startOnboarding}
          className="fixed right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-sm font-medium">新手引导</span>
        </button>
      )}

      {/* 引导步骤 5：排行榜/学区介绍 */}
      {isAuthenticated && isActive && currentStep === 5 && (
        <div className="fixed left-4 right-4 z-50" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">📊 学力系统</h3>
              <p className="text-sm text-muted-foreground mb-3">
                完成学习任务获得学力，在学区中排名！每月重置，排名越高称号越强。
              </p>
              <Button
                className="w-full"
                onClick={() => { nextStep(); router.push('/leaderboard') }}
              >
                去看看排行榜
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 引导步骤 7：每日任务介绍 */}
      {isAuthenticated && isActive && currentStep === 7 && (
        <div className="fixed left-4 right-4 z-50" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">📋 每日任务</h3>
              <p className="text-sm text-muted-foreground mb-3">
                每天完成任务可获得最多 85 学力，分享还可额外获得 15 学力，连续打卡有加成！
              </p>
              <Button
                className="w-full"
                onClick={nextStep}
              >
                知道了
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 引导步骤 8：完成引导 */}
      {isAuthenticated && isActive && currentStep === 8 && (
        <>
          <div className="fixed left-4 right-4 z-50" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">🎉 引导完成！</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  去探索更多功能吧：弹幕复习、错词本、公共词库、分享成就和聊天反馈。
                </p>
                <Button
                  className="w-full"
                  onClick={completeOnboarding}
                >
                  开始学习
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isAuthenticated && (
        <FeatureUnlockNotification
          open={unlockNotifOpen}
          onOpenChange={setUnlockNotifOpen}
          unlockedFeatures={unlockedFeatures}
        />
      )}
      <LoginPromptDialog />
    </div>
  )
}
