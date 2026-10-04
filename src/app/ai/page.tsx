'use client'

import AppLayout from '@/components/layout/AppLayout'
import { TranslationWorkspace } from '@/components/ai/TranslationWorkspace'
import { usePageView } from '@/lib/analytics'

export default function AiPage() {
  usePageView('翻译')

  return (
    <AppLayout>
      <div className="flex h-[calc(var(--app-visible-height,100dvh)-var(--mobile-nav-space))] flex-col md:h-dvh">
        <div className="flex-1 min-h-0">
          <TranslationWorkspace />
        </div>
      </div>
    </AppLayout>
  )
}
