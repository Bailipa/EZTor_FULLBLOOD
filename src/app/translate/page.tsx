'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { WordInputCard, TranslateOnlyCard, ResultsList, HomeHeader } from '@/components/home'
import { GuestWordInputCard } from '@/components/home/GuestWordInputCard'
import { GuestHomeHeader } from '@/components/home/guest/GuestHomeHeader'
import AppLayout from '@/components/layout/AppLayout'
import MobileNavBar from '@/components/layout/MobileNavBar'
import ErrorBoundary from '@/components/error-boundary'
import type { WordResult, ReviewGroup } from '@/types/api'
import { usePageView } from '@/lib/analytics'
import { saveToStorage, loadFromStorage } from '@/lib/storage'

export default function TranslatePage() {
  usePageView('Translate')

  const [wordsInput, setWordsInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPos] = useState(true)
  const [showExample] = useState(true)
  const [results, setResults] = useState<WordResult[]>([])
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none')
  const [showDanmaku, setShowDanmaku] = useState(false)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const prevResultsLengthRef = useRef(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user

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

  // 游客模式
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <GuestHomeHeader />
        <div className="p-4 md:p-6 lg:p-8 pb-20">
          <GuestWordInputCard
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            setResults={setResults}
            wordsInput={wordsInput}
            setWordsInput={setWordsInput}
          />
          {results.length > 0 && (
            <div className="mt-6">
              <ResultsList
                ref={resultsRef}
                results={results}
                showPos={showPos}
                showExample={showExample}
              />
            </div>
          )}
        </div>
        <MobileNavBar />
      </div>
    )
  }

  // 登录用户模式
  return (
    <AppLayout>
      <div className="flex flex-col xl:h-screen">
        {/* 顶栏（暂时禁用）
        <HomeHeader
          showDanmaku={showDanmaku}
          onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
        />
        */}

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
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
