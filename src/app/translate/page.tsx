'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { TranslateOnlyCard } from '@/components/home'
import { WordTranslationPanel } from '@/components/home/WordTranslationPanel'
import { GuestWordInputCard } from '@/components/home/GuestWordInputCard'
import { GuestHomeHeader } from '@/components/home/guest/GuestHomeHeader'
import { ResultsList } from '@/components/home/ResultsList'
import { ChatRoom } from '@/components/chat/ChatRoom'
import AppLayout from '@/components/layout/AppLayout'
import MobileNavBar from '@/components/layout/MobileNavBar'
import ErrorBoundary from '@/components/error-boundary'
import type { WordResult, ReviewGroup } from '@/types/api'
import { usePageView } from '@/lib/analytics'

export default function TranslatePage() {
  usePageView('Translate')

  const [isLoading, setIsLoading] = useState(false)
  const [showPos] = useState(true)
  const [showExample] = useState(true)
  const [results, setResults] = useState<WordResult[]>([])
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none')
  const [wordsInput, setWordsInput] = useState('')

  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user

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
        <div className="flex-1 flex flex-col xl:flex-row min-h-0 xl:overflow-hidden">
          <div className="flex flex-col xl:w-[440px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-border">
            <div className="p-4 md:p-6 lg:p-8 xl:pr-4 space-y-6">
              <WordTranslationPanel
                showPos={showPos}
                showExample={showExample}
                groups={groups}
                selectedTargetGroupId={selectedTargetGroupId}
                setSelectedTargetGroupId={setSelectedTargetGroupId}
              />

              <ErrorBoundary>
                <TranslateOnlyCard />
              </ErrorBoundary>
            </div>
          </div>

          <div className="hidden xl:flex flex-col xl:overflow-hidden">
            <div className="flex-1 p-4 md:p-6 lg:p-8 xl:pl-4">
              <ChatRoom />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
