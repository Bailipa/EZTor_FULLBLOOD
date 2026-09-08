'use client'

import AppLayout from '@/components/layout/AppLayout'
import { ZhEnAssistant } from '@/components/ai/ZhEnAssistant'
import { usePageView } from '@/lib/analytics'

export default function AiPage() {
  usePageView('AI助手')

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-56px)] xl:h-screen">
        <div className="flex-1 min-h-0">
          <ZhEnAssistant />
        </div>
      </div>
    </AppLayout>
  )
}
