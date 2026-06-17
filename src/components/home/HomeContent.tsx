'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Danmaku } from '@/components/ui/danmaku'
import { HomeHeader } from '@/components/home'
import { WordTranslationPanel } from '@/components/home/WordTranslationPanel'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import AppLayout from '@/components/layout/AppLayout'
import type { ReviewGroup } from '@/types/api'
import { saveToStorage, loadFromStorage } from '@/lib/storage'
import { usePageView } from '@/lib/analytics'
import { FullscreenFlashcard } from '@/components/flashcard/FullscreenFlashcard'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap, MessageSquare } from 'lucide-react'
import { DailyTaskCard } from '@/features/gamification/components/DailyTaskCard'
import { CombatPowerBadge } from '@/features/gamification/components/CombatPowerBadge'
import { FeatureUnlockNotification } from '@/features/gamification/components/FeatureUnlockNotification'
import type { FeatureKey } from '@/features/gamification/constants'

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

export default function HomeContent() {
  usePageView('Home')
  const { currentStep, isActive, nextStep, completeOnboarding, startOnboarding } = useOnboarding()
  const router = useRouter()
  const [hasInteractedWithFlashcard, setHasInteractedWithFlashcard] = useState(false)

  const [showPos, _setShowPos] = useState(true)
  const [showExample, _setShowExample] = useState(true)
  const [showDanmaku, setShowDanmaku] = useState(false)
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none')
  const [unlockNotifOpen, setUnlockNotifOpen] = useState(false)
  const [unlockedFeatures, _setUnlockedFeatures] = useState<FeatureKey[]>([])
  const [taskRefreshKey, setTaskRefreshKey] = useState(0)

  const { data: session, status } = useSession()
  const {
    promptLogin,
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
    <div className="relative h-screen bg-background font-[family-name:var(--font-geist-sans)] transition-colors duration-300 flex flex-col">
      {showDanmaku && <Danmaku isVisible={showDanmaku} />}

      <AppLayout>
        {/* 移动端 */}
        <div className="xl:hidden flex flex-col h-full">
          <HomeHeader
            showDanmaku={showDanmaku}
            onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
            onFeatureClick={promptLogin}
          />
          {isAuthenticated && (
            <div className="px-4 py-2 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur">
              <CombatPowerBadge />
            </div>
          )}
          {isAuthenticated && (
            <div className="px-4 py-2">
              <DailyTaskCard refreshKey={taskRefreshKey} defaultCollapsed={true} />
            </div>
          )}
          <div className="flex-1 min-h-0">
            <FullscreenFlashcard onInteraction={() => {
              if (isAuthenticated) {
                setHasInteractedWithFlashcard(true)
                setTaskRefreshKey((k) => k + 1)
              }
            }} />
          </div>
        </div>

        {/* 桌面端 */}
        <div className="hidden xl:flex xl:flex-col xl:h-screen">
          <HomeHeader
            showDanmaku={showDanmaku}
            onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
            onFeatureClick={promptLogin}
          />

          <div className="flex-1 flex flex-col xl:flex-row min-h-0 xl:overflow-hidden">
            <div className="flex flex-col xl:w-[440px] xl:shrink-0 xl:overflow-y-auto xl:border-r xl:border-border">
              <div className="p-4 md:p-6 lg:p-8 xl:pr-4 space-y-6">
                {isAuthenticated && (
                  <div className="flex items-center justify-between">
                    <div />
                    <CombatPowerBadge />
                  </div>
                )}
                {isAuthenticated && <DailyTaskCard defaultCollapsed={false} />}
                <WordTranslationPanel
                  showPos={showPos}
                  showExample={showExample}
                  groups={groups}
                  selectedTargetGroupId={selectedTargetGroupId}
                  setSelectedTargetGroupId={setSelectedTargetGroupId}
                  isGuest={isGuestMode}
                  onGuestFeatureClick={handleGuestFeatureClick}
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col xl:overflow-hidden">
              <div className="flex-1 p-4 md:p-6 lg:p-8 xl:pl-4">
                {isAuthenticated ? (
                  <ChatRoom />
                ) : (
                  <GuestChatPlaceholder onLogin={() => promptLogin('聊天')} />
                )}
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
                  去探索更多功能吧：弹幕复习、分享成就、聊天反馈...
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
