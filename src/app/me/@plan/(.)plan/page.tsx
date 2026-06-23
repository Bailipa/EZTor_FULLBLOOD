'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AuthorPlanList } from '@/components/me/AuthorPlanList'

export default function PlanModal() {
  const router = useRouter()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          router.back()
        }}
        onInteractOutside={(e) => {
          e.preventDefault()
          router.back()
        }}
      >
        <DialogHeader>
          <DialogTitle>作者的计划</DialogTitle>
          <DialogDescription>
            作者对应用功能的开发计划与进度同步
          </DialogDescription>
        </DialogHeader>
        <AuthorPlanList />
      </DialogContent>
    </Dialog>
  )
}
