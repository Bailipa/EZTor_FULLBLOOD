'use client'

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
