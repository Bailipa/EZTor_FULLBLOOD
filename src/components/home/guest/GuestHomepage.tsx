'use client'

import { type RefObject, useCallback } from 'react'
import {
  ArrowRight,
  BookOpen,
  BookText,
  Globe2,
  LibraryBig,
  PencilLine,
  Search,
  Sparkles,
} from 'lucide-react'
import { GuestWordInputCard } from '@/components/home/GuestWordInputCard'
import { ResultsList } from '@/components/home/ResultsList'
import { GuestHomeHeader } from '@/components/home/guest/GuestHomeHeader'
import { Button } from '@/components/ui/button'
import type { WordResult } from '@/types/api'

interface GuestHomepageProps {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  setResults: (results: WordResult[] | ((prev: WordResult[]) => WordResult[])) => void
  wordsInput: string
  setWordsInput: (input: string | ((prev: string) => string)) => void
  results: WordResult[]
  showPos: boolean
  showExample: boolean
  resultsRef: RefObject<HTMLDivElement | null>
  onFeatureClick: (featureName: string) => void
}

const SEARCH_SECTION_ID = 'guest-search-panel'
const SEARCH_TEXTAREA_ID = 'guest-word-input'

const highlightItems = [
  {
    icon: Globe2,
    title: '公共词库可直接使用',
    description: '无需登录，立即查询',
  },
  {
    icon: Sparkles,
    title: '登录后解锁 AI 翻译',
    description: '更准的翻译与例句分析',
  },
  {
    icon: BookOpen,
    title: '自动沉淀到生词本',
    description: '查过即存，高效复习',
  },
]

const lightWorkflowSteps = [
  {
    step: '1',
    title: '查询',
    description: '在游客模式下即可查询，登录后获得更精准的 AI 翻译与例句解析。',
    icon: Search,
  },
  {
    step: '2',
    title: '保存到生词本',
    description: '一键保存生词，自动归类并支持添加笔记与标签，构建你的专属词库。',
    icon: LibraryBig,
  },
  {
    step: '3',
    title: '默写复习',
    description: '基于艾宾浩斯记忆曲线智能安排默写与复习，巩固记忆，长期掌握。',
    icon: PencilLine,
  },
]

const exampleWords = ['apple', 'hello', 'inevitable', 'take for granted']

export function GuestHomepage({
  isLoading,
  setIsLoading,
  setResults,
  wordsInput,
  setWordsInput,
  results,
  showPos,
  showExample,
  resultsRef,
  onFeatureClick,
}: GuestHomepageProps) {
  const scrollToSection = useCallback((id: string, shouldFocus = false) => {
    const target = document.getElementById(id)
    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (shouldFocus) {
      window.setTimeout(() => {
        const textarea = document.getElementById(SEARCH_TEXTAREA_ID)
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.focus()
        }
      }, 450)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-slate-950">
      <GuestHomeHeader />

      <section className="bg-[linear-gradient(180deg,var(--color-surface-alt)_0%,var(--background)_40%,var(--color-card)_100%)]">
        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-4 sm:px-6 lg:grid lg:grid-cols-[0.88fr_1fr] lg:items-center lg:gap-12 lg:px-16 lg:pb-24 lg:pt-24 xl:px-[72px]">
          <div className="hidden lg:block max-w-[640px]">
            <h1 className="text-[26px] font-bold leading-[1.3] tracking-[-0.03em] text-foreground sm:text-[32px] lg:text-[44px]">
              为大学生打造的
              <br />
              AI 英语查词与学习空间
            </h1>
            <div className="mt-5 h-1 w-16 rounded-full bg-primary lg:mt-8 lg:w-24" />
            <p className="mt-5 max-w-[560px] text-[15px] leading-[1.7] text-muted-foreground lg:mt-8 lg:text-[18px]">
              在游客模式下，即可使用强大的公共词库快速查询。登录后解锁 AI 翻译、例句分析与学习工具，让每一次查词都沉淀为可复习的知识。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-10 lg:gap-4">
              <Button
                size="lg"
                className="h-12 rounded-2xl bg-primary px-8 text-[15px] font-semibold text-primary-foreground shadow-md hover:brightness-90 sm:h-[52px] sm:text-base lg:h-[60px] lg:rounded-2xl lg:px-9 lg:text-lg"
                onClick={() => scrollToSection(SEARCH_SECTION_ID, true)}
              >
                <Search className="h-4 w-4 lg:h-5 lg:w-5" />
                开始查词
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-2xl border-border bg-card px-8 text-[15px] font-semibold text-brand-subtle shadow-sm hover:bg-accent sm:h-[52px] sm:text-base lg:h-[60px] lg:rounded-2xl lg:px-9 lg:text-lg"
                onClick={() => scrollToSection('workflow')}
              >
                <BookText className="h-4 w-4 lg:h-5 lg:w-5" />
                先看看功能
              </Button>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-3 lg:mt-16 lg:gap-6">
              {highlightItems.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1.5 text-[13px] leading-[1.6] text-caption">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-0 lg:mt-0">
            <GuestWordInputCard
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              setResults={setResults}
              wordsInput={wordsInput}
              setWordsInput={setWordsInput}
              containerId={SEARCH_SECTION_ID}
              textareaId={SEARCH_TEXTAREA_ID}
              onLockedFeatureClick={onFeatureClick}
            />
            <div className="mt-4 lg:hidden">
              <div className="flex flex-wrap gap-2">
                {exampleWords.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => setWordsInput((prev) => prev ? prev + '\n' + word : word)}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-primary"
                  >
                    {word}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[13px] text-caption">
                无需登录，公共词库直接查 ·{' '}
                <a href="/auth/signin" className="text-primary underline underline-offset-2">登录解锁更多</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {results.length > 0 && (
        <section className="bg-background px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-[1180px] rounded-[20px] border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-7">
            <div ref={resultsRef} className="mb-6">
              <h2 className="text-xl font-bold tracking-tight text-foreground">查词结果</h2>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-caption">
                先把这一组词查清楚；如果其中有值得反复回看的词，再登录把它们继续留下来学。
              </p>
            </div>
            <ResultsList results={results} showPos={showPos} showExample={showExample} />
          </div>
        </section>
      )}

      <section id="workflow" className="hidden lg:block bg-card px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-[1320px]">
          <div className="text-center">
            <h2 className="text-[24px] font-bold tracking-[-0.03em] text-foreground sm:text-[30px] lg:text-[34px]">
              从查询到掌握的 3 步学习循环
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-primary lg:mt-4 lg:w-24" />
            <p className="mt-4 text-[15px] text-caption lg:mt-5 lg:text-lg">让每一次查词都成为长期记忆的一部分</p>
          </div>

          <div className="mt-10 grid items-center gap-6 lg:mt-12 lg:gap-8 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {lightWorkflowSteps.map((item, index) => (
              <StepWithConnector key={item.title} item={item} showConnector={index < lightWorkflowSteps.length - 1} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

interface WorkflowItem {
  step: string
  title: string
  description: string
  icon: typeof Search
}

function StepWithConnector({ item, showConnector }: { item: WorkflowItem; showConnector: boolean }) {
  return (
    <>
      <div className="rounded-2xl border border-border bg-card px-6 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="flex items-start gap-4 sm:gap-5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-bold text-primary">
            {item.step}
          </span>
          <div>
            <h3 className="text-xl font-bold text-foreground sm:text-2xl">{item.title}</h3>
            <div className="mt-4 flex gap-4 sm:mt-5 sm:gap-5">
              <item.icon className="mt-1 h-9 w-9 flex-shrink-0 text-foreground sm:h-10 sm:w-10" />
              <p className="text-[14px] leading-[1.7] text-muted-foreground sm:text-base">{item.description}</p>
            </div>
          </div>
        </div>
      </div>
      {showConnector && (
        <div className="hidden items-center text-primary lg:flex">
          <span className="block h-px w-16 border-t border-dashed border-primary/40" />
          <ArrowRight className="-ml-1 h-7 w-7" />
        </div>
      )}
    </>
  )
}
