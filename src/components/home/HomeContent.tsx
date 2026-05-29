'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Danmaku } from '@/components/ui/danmaku'
import { WordInputCard, TranslateOnlyCard, ResultsList, HomeHeader } from '@/components/home'
import { GuestHomepage } from '@/components/home/guest/GuestHomepage'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import AppLayout from '@/components/layout/AppLayout'
import MobileNavBar from '@/components/layout/MobileNavBar'
import ErrorBoundary from '@/components/error-boundary'
import type { WordResult, ReviewGroup } from '@/types/api'
import { saveToStorage, loadFromStorage } from '@/lib/storage'
import { usePageView } from '@/lib/analytics'
import { FullscreenFlashcard } from '@/components/flashcard/FullscreenFlashcard'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function HomeContent() {
  usePageView('Home')
  const { currentStep, isActive, completeOnboarding } = useOnboarding()

  const [wordsInput, setWordsInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPos, _setShowPos] = useState(true)
  const [showExample, _setShowExample] = useState(true)
  const [results, setResults] = useState<WordResult[]>([])
  const [showDanmaku, setShowDanmaku] = useState(false)
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none')
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
          <div className="flex-1 min-h-0">
            <FullscreenFlashcard />
          </div>
        </div>

        {/* 桌面端：保持原有布局 */}
        <div className="hidden xl:flex xl:flex-col xl:h-screen">
          <HomeHeader
            showDanmaku={showDanmaku}
            onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
            onFeatureClick={promptLogin}
          />

          <div className="flex-1 flex flex-col xl:flex-row min-h-0 xl:overflow-hidden">
            <div className="flex flex-col xl:w-[440px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-border">
              <div className="p-4 md:p-6 lg:p-8 xl:pr-4 space-y-6">
                <WordInputCard
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  showPos={showPos}
                  showExample={showExample}
                  groups={groups}
                  selectedTargetGroupId={selectedTargetGroupId}
                  setSelectedTargetGroupId={setSelectedTargetGroupId}
                  results={results}
                  setResults={setResults}
                  wordsInput={wordsInput}
                  setWordsInput={setWordsInput}
                />

                <ErrorBoundary>
                  <TranslateOnlyCard />
                </ErrorBoundary>
              </div>
            </div>

            <div className="flex-1 flex flex-col xl:overflow-y-auto">
              <div className="p-4 md:p-6 lg:p-8 xl:pl-4">
                <ResultsList
                  ref={resultsRef}
                  results={results}
                  showPos={showPos}
                  showExample={showExample}
                  onClear={() => setResults([])}
                />
              </div>
              <footer className="py-6 px-4 md:px-6 lg:px-8 text-center text-sm text-muted-foreground">
                <a
                  href="https://blog.dogeggcode.cyou"
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

      {/* 引导步骤 6：功能探索提示 */}
      {isActive && currentStep === 6 && isAuthenticated && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">🎉</span>
              </div>
              <h3 className="text-xl font-bold">还有更多功能等你探索</h3>
              <p className="text-muted-foreground">
                开始你的学习之旅吧！
              </p>
              <Button
                className="w-full"
                onClick={completeOnboarding}
              >
                完成引导
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <LoginPromptDialog />
    </div>
  )
}
