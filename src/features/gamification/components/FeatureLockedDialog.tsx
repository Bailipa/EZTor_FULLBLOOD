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
import { Progress } from '@/components/ui/progress'
import { Lock } from 'lucide-react'

interface FeatureLockedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureName: string
  requiredPower: number
  currentPower: number
}

export function FeatureLockedDialog({
  open,
  onOpenChange,
  featureName,
  requiredPower,
  currentPower,
}: FeatureLockedDialogProps) {
  const remaining = requiredPower - currentPower
  const progress = Math.min(100, Math.round((currentPower / requiredPower) * 100))

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[320px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4 text-muted-foreground" />
            功能未解锁
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                <span className="font-medium text-foreground">{featureName}</span> 需要{' '}
                <span className="font-semibold text-amber-600">{requiredPower}</span> 战力才能解锁
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>当前战力：{currentPower}</span>
                  <span>还需 {remaining} 战力</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{progress}%</p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>好的</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
