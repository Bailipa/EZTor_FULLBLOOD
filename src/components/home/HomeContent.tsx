'use client'

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMinimalFeatures } from '@/components/interface-style-provider'
import { HomeHeader } from '@/components/home/HomeHeader'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import AppLayout from '@/components/layout/AppLayout'
import { useAnalytics, usePageView } from '@/lib/analytics'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BookOpen, AlertCircle, PenLine, Languages, ArrowUpRight, ArrowRight } from 'lucide-react'
import styles from '@/components/ai/translation-workspace.module.css'
import studyStyles from '@/features/study/study.module.css'
import { CombatPowerBadge, type CombatPowerSummary } from '@/features/gamification/components/CombatPowerBadge'
import { FeatureUnlockNotification } from '@/features/gamification/components/FeatureUnlockNotification'
import type { FeatureKey } from '@/features/gamification/constants'

const StudyHome = lazy(() => import('@/features/study/StudyHome'))
const DailyTaskCard = lazy(() => import('@/features/gamification/components/DailyTaskCard').then((module) => ({ default: module.DailyTaskCard })))

export default function HomeContent() {
  const { minimal, mainVisible } = useMinimalFeatures()
  usePageView('Home')
  const { track } = useAnalytics()
  const router = useRouter()
  const [flashcardOpenRequest, setFlashcardOpenRequest] = useState(0)

  const [unlockNotifOpen, setUnlockNotifOpen] = useState(false)
  const [unlockedFeatures, _setUnlockedFeatures] = useState<FeatureKey[]>([])
  const [taskRefreshKey, setTaskRefreshKey] = useState(0)
  const [profile, setProfile] = useState<CombatPowerSummary | null>(null)
  const profileRequestRef = useRef<Promise<CombatPowerSummary | null> | null>(null)
  const profileUserIdRef = useRef<string | null>(null)

  const { data: session, status } = useSession()
  const {
    promptLogin,
    LoginPromptDialog,
  } = useLoginPrompt()

  const isAuthenticated = status === 'authenticated' && !!session?.user

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
            <div data-workspace-home className={`${styles.homePage} ${studyStyles.homePage}`}>
              <section data-home-lead className={styles.homeLead} aria-label="学习与查词">
                <div data-home-intro className={styles.homeIntro}>
                  <p className={styles.eyebrow}>今日计划</p>
                  <h2>今天学什么？</h2>
                  <p className={styles.homeDescription}>从一篇文章或一道练习开始，稳步推进今天的学习。</p>
                  {mainVisible('/dictation') && <Button className="mt-6 min-h-11 gap-3 rounded-lg px-5 shadow-none" onPointerEnter={() => { if (isAuthenticated) router.prefetch('/dictation') }} onFocus={() => { if (isAuthenticated) router.prefetch('/dictation') }} onClick={() => { track('CTA_CLICK', { placement: 'home', action: 'start_dictation' }); if (isAuthenticated) router.push('/dictation'); else promptLogin('默写复习') }}>
                    <PenLine className="size-4" />开始默写<ArrowRight className="size-4" />
                  </Button>}
                </div>
                <div data-home-shortcuts className={styles.learningLinks}>
                  {mainVisible('/dictation') && <button onPointerEnter={() => { if (isAuthenticated) router.prefetch('/mistakes') }} onFocus={() => { if (isAuthenticated) router.prefetch('/mistakes') }} onClick={() => { track('CTA_CLICK', { placement: 'home', action: 'mistakes' }); if (isAuthenticated) router.push('/mistakes'); else promptLogin('错词本') }}>
                    <AlertCircle className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    <span><strong>错词本</strong><small>把易错的词，再巩固一遍</small></span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </button>}
                  {mainVisible('/history') && <button onPointerEnter={() => { if (isAuthenticated) router.prefetch('/history') }} onFocus={() => { if (isAuthenticated) router.prefetch('/history') }} onClick={() => { track('CTA_CLICK', { placement: 'home', action: 'vocabulary' }); if (isAuthenticated) router.push('/history'); else promptLogin('生词本') }}>
                    <BookOpen className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    <span><strong>生词本</strong><small>回看收藏，整理所学</small></span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </button>}
                  {mainVisible('/ai') && <Link href="/ai" onClick={() => track('CTA_CLICK', { placement: 'home', action: 'translate' })}>
                    <Languages className="size-5 text-muted-foreground" strokeWidth={1.5} />
                    <span><strong>翻译</strong><small>查一个词，读懂一句话</small></span>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>}
                  {minimal && <Link href="/me#minimal-features">显示功能设置</Link>}
                </div>

              </section>

              <div data-home-grid>
                <section data-home-study className="mt-5 min-w-0 md:mt-0" aria-label="四六级备考">
                  <Suspense fallback={<div className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">载入阅读工作台…</div>}>
                    <StudyHome />
                  </Suspense>
                </section>

                {isAuthenticated && (
                  <section data-home-progress className={styles.homeProgress} aria-label="今日进度">
                    <Card className={`${styles.progressSummary} py-0`}>
                      <CardContent className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-1.5">
                        <h2 className="text-sm font-medium">学力进度</h2>
                        <CombatPowerBadge data={profile} />
                      </CardContent>
                    </Card>
                    <Suspense fallback={<div className="min-h-11 rounded-lg border border-border px-3 py-3 text-xs text-muted-foreground">载入每日任务…</div>}>
                      <DailyTaskCard
                        refreshKey={taskRefreshKey}
                        defaultCollapsed
                        forceExpanded={false}
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
                    </Suspense>
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
