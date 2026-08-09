import type { Metadata } from 'next'
import { Suspense } from 'react'
import HomeContent from '@/components/home/HomeContent'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'EZTor - 智能英语翻译与词汇记忆工具',
  description:
    'EZTor 是一款简洁强大的英语翻译与词汇记忆工具，支持 AI 批量翻译、生词本管理、默写复习等功能，助你高效记忆英语单词。',
  keywords: ['英语翻译', '词汇记忆', '单词本', 'AI翻译', '英语学习', 'EZTor'],
  openGraph: {
    title: 'EZTor - 智能英语翻译与词汇记忆工具',
    description: '支持 AI 批量翻译、生词本管理、默写复习，助你高效记忆英语单词。',
    type: 'website',
    images: '/icons/icon-512.png',
  },
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border animate-pulse">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-8 w-32 bg-muted rounded" />
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-64 bg-muted rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded" />
            </div>
          </div>
        </div>

        <div className="border-2 shadow-sm rounded-lg">
          <div className="p-4 sm:p-6 space-y-4 animate-pulse">
            <div className="flex justify-between">
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded" />
            </div>
            <div className="min-h-[150px] bg-muted/30 rounded-md" />
          </div>
        </div>

        <div className="border-2 shadow-sm rounded-lg">
          <div className="p-4 sm:p-6 space-y-4 animate-pulse">
            <div className="h-6 w-36 bg-muted rounded" />
            <div className="min-h-[80px] bg-muted/30 rounded-md" />
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}
