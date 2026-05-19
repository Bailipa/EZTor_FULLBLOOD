'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Danmaku } from '@/components/ui/danmaku'
import { WordInputCard, TranslateOnlyCard, ResultsList, HomeHeader } from '@/components/home'
import { GuestHomepage } from '@/components/home/guest/GuestHomepage'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import ErrorBoundary from '@/components/error-boundary'
import type { WordResult, ReviewGroup } from '@/types/api'
import { saveToStorage, loadFromStorage } from '@/lib/storage'
import { usePageView } from '@/lib/analytics'

export default function HomeContent() {
  usePageView('Home')

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
      <div className="relative min-h-screen bg-white font-[family-name:var(--font-geist-sans)] transition-colors duration-300">
        <main className="relative z-10">
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

        <LoginPromptDialog />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gray-50/50 p-6 font-[family-name:var(--font-geist-sans)] transition-colors duration-300 md:p-12 dark:bg-background">
      {showDanmaku && isAuthenticated && <Danmaku isVisible={showDanmaku} />}

      <main className="relative z-10 mx-auto max-w-7xl space-y-6">
        <HomeHeader
          showDanmaku={showDanmaku}
          onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
          onFeatureClick={promptLogin}
        />

        <div className="grid grid-cols-1 items-start gap-6">
          <div className="min-w-0 space-y-6">
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

            <ResultsList
              ref={resultsRef}
              results={results}
              showPos={showPos}
              showExample={showExample}
            />
          </div>
        </div>
      </main>

      <footer className="mt-12 py-6 text-center text-sm text-muted-foreground">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
        >
          ICP备案号：粤ICP备2026008729号
        </a>
      </footer>

      <LoginPromptDialog />
    </div>
  )
}
