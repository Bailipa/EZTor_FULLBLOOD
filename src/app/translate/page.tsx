'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { TranslateOnlyCard } from '@/components/home'
import { WordTranslationPanel } from '@/components/home/WordTranslationPanel'
import { ChatRoom } from '@/components/chat/ChatRoom'
import AppLayout from '@/components/layout/AppLayout'
import ErrorBoundary from '@/components/error-boundary'
import type { ReviewGroup } from '@/types/api'
import { usePageView } from '@/lib/analytics'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

function GuestChatPlaceholder({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-lg font-medium">登录后解锁聊天功能</p>
        <Button onClick={onLogin}>登录</Button>
      </div>
    </div>
  )
}

export default function TranslatePage() {
  usePageView('Translate')

  const [showPos] = useState(true)
  const [showExample] = useState(true)
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none')

  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const isGuestMode = !isAuthenticated

  const { promptLogin, LoginPromptDialog } = useLoginPrompt()

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/review-groups')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setGroups(data.data)
          }
        })
        .catch(() => {})
    }
  }, [session])

  const handleGuestFeatureClick = useCallback(
    (featureName: string) => {
      promptLogin(featureName)
    },
    [promptLogin],
  )

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
                isGuest={isGuestMode}
                onGuestFeatureClick={handleGuestFeatureClick}
              />

              {isAuthenticated && (
                <ErrorBoundary>
                  <TranslateOnlyCard />
                </ErrorBoundary>
              )}
            </div>
          </div>

          <div className="hidden xl:flex flex-col xl:overflow-hidden">
            <div className="flex-1 p-4 md:p-6 lg:p-8 xl:pl-4">
              {isAuthenticated ? (
                <ChatRoom />
              ) : (
                <GuestChatPlaceholder onLogin={() => promptLogin('聊天')} />
              )}
            </div>
          </div>
        </div>
      </div>
      <LoginPromptDialog />
    </AppLayout>
  )
}
