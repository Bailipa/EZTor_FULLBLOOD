'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { DictationWorkspace } from '@/components/dictation/DictationWorkspace'

export default function DictationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-label="正在加载默写" />
        </div>
      }
    >
      <DictationRoute />
    </Suspense>
  )
}

function DictationRoute() {
  const params = useSearchParams()
  const isMistakePractice = params.get('source') === 'mistakes'
  const initialGroupId = params.get('groupId') || undefined
  return (
    <DictationWorkspace
      key={`${isMistakePractice ? 'mistakes' : 'dictation'}:${initialGroupId ?? 'all'}`}
      isMistakePractice={isMistakePractice}
      initialGroupId={initialGroupId}
    />
  )
}
