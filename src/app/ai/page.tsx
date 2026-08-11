'use client'

import AppLayout from '@/components/layout/AppLayout'
import { AiAssistant } from '@/components/ai/AiAssistant'
import { BackButton } from '@/components/layout/BackButton'
import { usePageView } from '@/lib/analytics'

export default function AiPage() {
  usePageView('AI助手')

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-56px)] xl:h-screen">
        <div className="xl:hidden px-2 py-2 border-b border-border shrink-0">
          <BackButton />
        </div>
        <div className="flex-1 min-h-0">
          <AiAssistant />
        </div>
      </div>
    </AppLayout>
  )
}
