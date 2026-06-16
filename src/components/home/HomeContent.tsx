'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Danmaku } from '@/components/ui/danmaku'
import { HomeHeader } from '@/components/home'
import { WordTranslationPanel } from '@/components/home/WordTranslationPanel'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { GuestHomepage } from '@/components/home/guest/GuestHomepage'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import AppLayout from '@/components/layout/AppLayout'
import MobileNavBar from '@/components/layout/MobileNavBar'
import type { WordResult, ReviewGroup } from '@/types/api'
import { saveToStorage, loadFromStorage } from '@/lib/storage'
import { usePageView } from '@/lib/analytics'
import { FullscreenFlashcard } from '@/components/flashcard/FullscreenFlashcard'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap } from 'lucide-react'
import { DailyTaskCard } from '@/features/gamification/components/DailyTaskCard'
import { CombatPowerBadge } from '@/features/gamification/components/CombatPowerBadge'
import { FeatureUnlockNotification } from '@/features/gamification/components/FeatureUnlockNotification'
import type { FeatureKey } from '@/features/gamification/constants'

export default function HomeContent() {
  usePageView('Home')
  const { currentStep, isActive, completeOnboarding, startOnboarding } = useOnboarding()
  const completeButtonRef = useRef<HTMLButtonElement>(null)
  const [hasInteractedWithFlashcard, setHasInteractedWithFlashcard] = useState(false)

  const [wordsInput, setWordsInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPos, _setShowPos] = useState(true)
  const [showExample, _setShowExample] = useState(true)
  const [results, setResults] = useState<WordResult[]>([])
  const [showDanmaku, setShowDanmaku] = useState(false)
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none')
  const [unlockNotifOpen, setUnlockNotifOpen] = useState(false)
  const [unlockedFeatures, setUnlockedFeatures] = useState<FeatureKey[]>([])
  const [taskRefreshKey, setTaskRefreshKey] = useState(0)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const prevResultsLengthRef = useRef(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { data: session, status } = useSession()
  const {
    showLoginPrompt: _showLoginPrompt,
    pendingFeature: _pendingFeature,
    promptLogin,
    closePrompt: _closePrompt,
    LoginPromptDialog,
  } = useLoginPrompt()

  const isAuthenticated = status === 'authenticated' && session?.user
  const isGuestMode = !isAuthenticated

  useEffect(() => {
    const savedDanmaku = loadFromStorage<boolean>('vocab_showDanmaku', false)
    setShowDanmaku(savedDanmaku)
  }, [])

  useEffect(() => {
    saveToStorage('vocab_showDanmaku', showDanmaku)
  }, [showDanmaku])

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/review-groups')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setGroups(data.data)
          }
        })
        .catch((err) => {
          if (process.env.NODE_ENV === 'development') console.error('Failed to fetch groups', err)
        })
    }
  }, [session])

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (results.length > 0 && prevResultsLengthRef.current === 0) {
      scrollTimeoutRef.current = setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
    prevResultsLengthRef.current = results.length
  }, [results.length])

  const handleFeatureClick = useCallback(
    (featureName: string) => {
      if (isGuestMode) {
        promptLogin(featureName)
      }
    },
    [isGuestMode, promptLogin],
  )

  if (isGuestMode) {
    return (
      <div className="relative min-h-screen bg-background font-[family-name:var(--font-geist-sans)] transition-colors duration-300">
        <main className="relative z-10 pb-14">
          <GuestHomepage
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            setResults={setResults}
            wordsInput={wordsInput}
            setWordsInput={setWordsInput}
            results={results}
            showPos={showPos}
            showExample={showExample}
            resultsRef={resultsRef}
            onFeatureClick={handleFeatureClick}
          />
        </main>

        <MobileNavBar />
        <LoginPromptDialog />
      </div>
    )
  }

  return (
    <div className="relative h-screen bg-background font-[family-name:var(--font-geist-sans)] transition-colors duration-300 flex flex-col">
      {showDanmaku && isAuthenticated && <Danmaku isVisible={showDanmaku} />}

      <AppLayout>
        {/* 移动端：显示全屏闪卡 */}
        <div className="xl:hidden flex flex-col h-full">
          <HomeHeader
            showDanmaku={showDanmaku}
            onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
            onFeatureClick={promptLogin}
          />
          <div className="px-4 py-2 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur">
            <CombatPowerBadge />
          </div>
          <div className="px-4 py-2">
            <DailyTaskCard refreshKey={taskRefreshKey} defaultCollapsed={true} />
          </div>
          <div className="flex-1 min-h-0">
            <FullscreenFlashcard onInteraction={() => {
              setHasInteractedWithFlashcard(true)
              setTaskRefreshKey((k) => k + 1)
            }} />
          </div>
        </div>

        {/* 桌面端：翻译+反馈布局 */}
        <div className="hidden xl:flex xl:flex-col xl:h-screen">
          <HomeHeader
            showDanmaku={showDanmaku}
            onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
            onFeatureClick={promptLogin}
          />

          <div className="flex-1 flex flex-col xl:flex-row min-h-0 xl:overflow-hidden">
            <div className="flex flex-col xl:w-[440px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-border">
              <div className="p-4 md:p-6 lg:p-8 xl:pr-4 space-y-6">
                <div className="flex items-center justify-between">
                  <div />
                  <CombatPowerBadge />
                </div>
                <DailyTaskCard defaultCollapsed={false} />
                <WordTranslationPanel
                  showPos={showPos}
                  showExample={showExample}
                  groups={groups}
                  selectedTargetGroupId={selectedTargetGroupId}
                  setSelectedTargetGroupId={setSelectedTargetGroupId}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col xl:overflow-hidden">
              <div className="flex-1 p-4 md:p-6 lg:p-8 xl:pl-4">
                <ChatRoom />
              </div>
              <footer className="py-6 px-4 md:px-6 lg:px-8 text-center text-sm text-muted-foreground">
                <a
                  href="https://beian.miit.gov.cn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  ICP备案号：粤ICP备2026008729号
                </a>
              </footer>
            </div>
          </div>
        </div>
      </AppLayout>

      {/* 新手引导入口悬浮按钮 */}
      {!isActive && isAuthenticated && !hasInteractedWithFlashcard && (
        <button
          onClick={startOnboarding}
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-sm font-medium">新手引导</span>
        </button>
      )}

      {/* 引导步骤 6：功能探索提示 */}
      {isActive && currentStep === 6 && isAuthenticated && (
        <>
          <div className="fixed bottom-20 left-4 right-4 z-50">
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">🎉 还有更多功能等你探索</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  开始你的学习之旅吧！
                </p>
                <Button
                  ref={completeButtonRef}
                  className="w-full"
                  onClick={completeOnboarding}
                >
                  完成引导
                </Button>
              </CardContent>
            </Card>
          </div>
          <OnboardingTooltip
            targetRef={completeButtonRef}
            title="完成引导"
            description="点击'完成引导'开始你的学习之旅。"
            position="top"
          />
        </>
      )}

      <FeatureUnlockNotification
        open={unlockNotifOpen}
        onOpenChange={setUnlockNotifOpen}
        unlockedFeatures={unlockedFeatures}
      />
      <LoginPromptDialog />
    </div>
  )
}
