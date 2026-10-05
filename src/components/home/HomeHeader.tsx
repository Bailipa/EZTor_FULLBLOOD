'use client'

import { Button } from '@/components/ui/button'
import { FlashcardWidget } from '@/components/ui/flashcard/flashcard-widget'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Home, Lock } from 'lucide-react'
import { DonationButton } from './DonationModal'
import { DanmakuToggleButton } from './DanmakuToggleButton'
import { DanmakuSettingsDialog } from '@/components/me/DanmakuSettings'
import { FEATURE_UNLOCK_THRESHOLDS } from '@/features/gamification/constants'
import { FeatureLockedDialog } from '@/features/gamification/components/FeatureLockedDialog'
import styles from '@/components/ai/translation-workspace.module.css'
import { useSession } from 'next-auth/react'

const GameWidget = dynamic(() => import('@/components/ui/game/GameWidget').then((module) => module.GameWidget), { loading: () => <span className="text-xs text-muted-foreground">载入游戏…</span> })

export function HomeHeader({
  onFlashcardInteraction,
  flashcardOpenRequest = 0,
  combatPower = null,
}: { onFlashcardInteraction?: () => void; flashcardOpenRequest?: number; combatPower?: number | null } = {}) {
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const [cardExpanded, setCardExpanded] = useState(false)
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false)
  const [lockedFeatureName, setLockedFeatureName] = useState('')
  const [lockedFeaturePower, setLockedFeaturePower] = useState(0)

  const handleLockedFeature = (featureName: string, requiredPower: number) => {
    setLockedFeatureName(featureName)
    setLockedFeaturePower(requiredPower)
    setLockedDialogOpen(true)
  }

  const isDanmakuUnlocked = combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.DANMAKU
  const isGameUnlocked = combatPower === null || combatPower >= FEATURE_UNLOCK_THRESHOLDS.MINI_GAME

  return (
    <>
      <header data-home-header className={`${styles.homeHeader} flex flex-col bg-white dark:bg-card md:bg-sidebar md:dark:bg-sidebar p-4 sm:p-6 md:h-14 md:p-0 md:shrink-0 rounded-xl md:rounded-none shadow-sm md:shadow-none border border-border md:border-x-0 md:border-t-0 md:border-b md:border-sidebar-border transition-colors duration-300`}>
        <button
          type="button"
          onClick={() => setCardExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-left md:hidden"
          aria-expanded={cardExpanded}
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground">EZTor</h1>
          <span className="sm:hidden flex items-center gap-1 text-sm text-muted-foreground">
            <span>{cardExpanded ? '收起' : '展开'}</span>
            {cardExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        <div className={`${cardExpanded ? 'block' : 'hidden sm:block'} md:mx-auto md:flex md:h-full md:w-full md:max-w-7xl md:items-center md:justify-between md:gap-4 md:px-6 xl:px-8`}>
          <h1 className="hidden shrink-0 items-center gap-2 text-lg font-semibold text-sidebar-foreground md:flex"><Home className="size-5 text-primary" />工作台</h1>
          <div className="space-y-1.5 mt-2 md:hidden">
            <p className="text-sm sm:text-base text-gray-500 dark:text-muted-foreground">
              An Easier Translator.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400" role="alert">
              提示:翻译内容由 AI 大模型生成,请仔细甄别。
            </p>
          </div>
          <nav
            className="flex flex-wrap md:flex-nowrap items-center gap-2 sm:gap-3 mt-3 md:mt-0"
            aria-label="首页工具"
          >
            {isAuthenticated && (
              <div className="hidden xl:block">
                <FlashcardWidget onInteraction={onFlashcardInteraction} openRequest={flashcardOpenRequest} />
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
              <DanmakuSettingsDialog />
            </div>
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
