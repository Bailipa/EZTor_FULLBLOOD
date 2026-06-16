'use client'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Sparkles } from 'lucide-react'
import { FEATURE_DISPLAY_NAMES } from '@/features/gamification/constants'
import type { FeatureKey } from '@/features/gamification/constants'

interface FeatureUnlockNotificationProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unlockedFeatures: FeatureKey[]
  onExperience?: (feature: FeatureKey) => void
}

export function FeatureUnlockNotification({
  open,
  onOpenChange,
  unlockedFeatures,
  onExperience,
}: FeatureUnlockNotificationProps) {
  if (unlockedFeatures.length === 0) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[320px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            新功能解锁！
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {unlockedFeatures.map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <span className="text-sm font-medium text-foreground">
                    {FEATURE_DISPLAY_NAMES[f]}
                  </span>
                  <span className="text-xs text-muted-foreground">已解锁！</span>
                </div>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            稍后再看
          </AlertDialogAction>
          {unlockedFeatures.length === 1 && onExperience && (
            <AlertDialogAction
              onClick={() => {
                onExperience(unlockedFeatures[0])
                onOpenChange(false)
              }}
            >
              立即体验
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
