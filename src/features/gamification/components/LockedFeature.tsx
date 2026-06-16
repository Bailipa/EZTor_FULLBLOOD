'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { FeatureLockedDialog } from './FeatureLockedDialog'
import type { FeatureKey } from '@/features/gamification/constants'

interface LockedFeatureProps {
  feature: FeatureKey
  featureName: string
  requiredPower: number
  userPower: number
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function LockedFeature({
  feature: _feature,
  featureName,
  requiredPower,
  userPower,
  children,
  fallback,
}: LockedFeatureProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const isUnlocked = userPower >= requiredPower

  const handleClick = useCallback(() => {
    if (!isUnlocked) {
      setDialogOpen(true)
    }
  }, [isUnlocked])

  if (isUnlocked) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleClick}
        className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm text-muted-foreground"
      >
        <Lock className="w-3.5 h-3.5" />
        <span>{featureName}</span>
      </Button>
      <FeatureLockedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        featureName={featureName}
        requiredPower={requiredPower}
        currentPower={userPower}
      />
    </>
  )
}
