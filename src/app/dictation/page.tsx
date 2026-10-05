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
  const isMistakePractice = useSearchParams().get('source') === 'mistakes'
  return (
    <DictationWorkspace
      key={isMistakePractice ? 'mistakes' : 'dictation'}
      isMistakePractice={isMistakePractice}
    />
  )
}
