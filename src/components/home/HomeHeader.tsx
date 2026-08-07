'use client'

import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { FlashcardWidget } from '@/components/ui/flashcard/flashcard-widget'
import { GameWidget } from '@/components/ui/game/GameWidget'
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Lock, Download } from 'lucide-react'
import { DonationButton } from './DonationModal'
import { DanmakuToggleButton } from './DanmakuToggleButton'
import { FEATURE_UNLOCK_THRESHOLDS } from '@/features/gamification/constants'
import { FeatureLockedDialog } from '@/features/gamification/components/FeatureLockedDialog'
import { useSession } from 'next-auth/react'
import { useAppVersion } from '@/hooks/useAppVersion'

export function HomeHeader() {
  const { data: session, status } = useSession()
  const appVer = useAppVersion()
  const isAuthenticated = status === 'authenticated' && session?.user
  const [cardExpanded, setCardExpanded] = useState(false)
  const [combatPower, setCombatPower] = useState<number | null>(null)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false)
  const [lockedFeatureName, setLockedFeatureName] = useState('')
  const [lockedFeaturePower, setLockedFeaturePower] = useState(0)

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/game/profile')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setCombatPower(data.data.combatPower)
          }
        })
        .catch(() => {})
    }
  }, [isAuthenticated])

  const handleLockedFeature = (featureName: string, requiredPower: number) => {
    setLockedFeatureName(featureName)
    setLockedFeaturePower(requiredPower)
    setLockedDialogOpen(true)
  }

  const isDanmakuUnlocked = combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.DANMAKU
  const isGameUnlocked = combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.MINI_GAME

  return (
    <>
      <header className="flex flex-col bg-white dark:bg-card xl:bg-sidebar xl:dark:bg-sidebar p-4 sm:p-6 xl:px-6 xl:h-14 xl:py-0 xl:justify-center xl:overflow-hidden xl:flex-row xl:items-center xl:shrink-0 rounded-xl xl:rounded-none shadow-sm xl:shadow-none border border-border xl:border-x-0 xl:border-t-0 xl:border-b xl:border-sidebar-border transition-colors duration-300">
        <button
          type="button"
          onClick={() => setCardExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-left xl:hidden"
          aria-expanded={cardExpanded}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground">EZTor</h1>
          <span className="sm:hidden flex items-center gap-1 text-sm text-muted-foreground">
            <span>{cardExpanded ? '收起' : '展开'}</span>
            {cardExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        <div className={cardExpanded ? 'block' : 'hidden sm:block xl:block'}>
          <div className="space-y-1.5 mt-2 xl:hidden">
            <p className="text-sm sm:text-base text-gray-500 dark:text-muted-foreground">
              An Easier Translator.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400" role="alert">
              提示:翻译内容由 AI 大模型生成,请仔细甄别。
            </p>
          </div>
          <nav
            className="flex flex-wrap xl:flex-nowrap items-center gap-2 sm:gap-3 mt-3 xl:mt-0"
            aria-label="主导航"
          >
            {isAuthenticated && (
              <div className="hidden xl:block">
                <FlashcardWidget />
              </div>
            )}
            {isAuthenticated && (
              <div className="hidden xl:block">
                {isGameUnlocked ? (
                  <GameWidget />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleLockedFeature('小游戏', FEATURE_UNLOCK_THRESHOLDS.MINI_GAME)
                    }
                    className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm text-muted-foreground"
                  >
                    <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>小游戏</span>
                  </Button>
                )}
              </div>
            )}
            <div className="hidden xl:block">
              <DanmakuToggleButton
                locked={isAuthenticated && !isDanmakuUnlocked}
                onLockedClick={() =>
                  handleLockedFeature('弹幕复习', FEATURE_UNLOCK_THRESHOLDS.DANMAKU)
                }
              />
            </div>
            <div className="hidden xl:block">
              <ModeToggle />
            </div>
            {(!appVer.mounted || !appVer.isApp || appVer.hasUpdate === true) && (
              <div className="hidden xl:block">
                <Button asChild variant="outline" className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm text-muted-foreground">
                  <a href="/download">
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{appVer.mounted && appVer.isApp ? '更新软件' : '下载应用'}</span>
                  </a>
                </Button>
              </div>
            )}
            <div className="hidden xl:block">
              <DonationButton />
            </div>
          </nav>
        </div>
      </header>

      <FeatureLockedDialog
        open={lockedDialogOpen}
        onOpenChange={setLockedDialogOpen}
        featureName={lockedFeatureName}
        requiredPower={lockedFeaturePower}
        currentPower={combatPower ?? 0}
      />
    </>
  )
}