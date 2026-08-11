'use client'

import AppLayout from '@/components/layout/AppLayout'
import { AiAssistant } from '@/components/ai/AiAssistant'
import { usePageView } from '@/lib/analytics'

export default function AiPage() {
  usePageView('AI助手')

  return (
    <AppLayout>
      <div className="flex flex-col h-[100dvh]">
        <div className="flex-1 min-h-0">
          <AiAssistant />
        </div>
      </div>
    </AppLayout>
  )
}
