'use client'

import { type RefObject, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  BookText,
  Check,
  CheckCircle2,
  Gamepad2,
  Globe2,
  GraduationCap,
  LibraryBig,
  Minus,
  PencilLine,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { GuestWordInputCard } from '@/components/home/GuestWordInputCard'
import { ResultsList } from '@/components/home/ResultsList'
import { GuestHomeHeader } from '@/components/home/guest/GuestHomeHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

const darkWorkflowSteps = [
  {
    step: '1',
    title: '查词',
    description: '使用公共词库快速查询，了解词义、用法与例句。',
    icon: Search,
  },
  {
    step: '2',
    title: '收录生词',
    description: '一键加入生词本，自动分类并添加笔记与标签。',
    icon: LibraryBig,
  },
  {
    step: '3',
    title: '默写复习',
    description: '基于遗忘曲线智能安排复习，通过默写巩固记忆。',
    icon: PencilLine,
  },
]

const supportItems = [
  {
    icon: Globe2,
    title: '权威词库支持',
    description: '整合牛津、柯林斯等优质词典',
  },
  {
    icon: ShieldCheck,
    title: '隐私与安全',
    description: '你的查询与学习数据安全加密',
  },
  {
    icon: GraduationCap,
    title: '专为学习设计',
    description: '围绕记忆曲线与复习科学构建',
  },
]

const comparisonRows = [
  {
    icon: Globe2,
    label: '公共词库查询',
    description: '权威词典释义、例句',
    guest: true,
    member: true,
  },
  {
    icon: Sparkles,
    label: 'AI 翻译与解析',
    description: '更自然的上下文翻译与用法解析',
    guest: false,
    member: true,
  },
  {
    icon: BookOpen,
    label: '生词本与标签',
    description: '自动收录，支持笔记与标签管理',
    guest: false,
    member: true,
  },
  {
    icon: PencilLine,
    label: '默写复习',
    description: '智能安排，强化长期记忆',
    guest: false,
    member: true,
  },
  {
    icon: Gamepad2,
    label: '更多学习工具',
    description: '词汇统计、学习计划、导出等',
    guest: false,
    member: true,
  },
]

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
  const router = useRouter()

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
    <div className="min-h-screen bg-white text-slate-950">
      <GuestHomeHeader onStart={() => scrollToSection(SEARCH_SECTION_ID, true)} />

      <section className="bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.06),transparent_30%),linear-gradient(180deg,#ffffff_0%,#ffffff_72%,#f8fbff_100%)]">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-8 pb-24 pt-24 lg:grid-cols-[0.88fr_1fr] lg:px-16 xl:px-[72px]">
          <div className="max-w-[640px]">
            <h1 className="text-[44px] font-semibold leading-[1.12] tracking-[-0.04em] text-[#061534] sm:text-[60px] lg:text-[64px]">
              为大学生打造的
              <br />
              AI 英语查词与学习空间
            </h1>
            <div className="mt-8 h-1 w-24 bg-cyan-600" />
            <p className="mt-8 max-w-[560px] text-[20px] leading-[1.8] text-slate-600">
              在游客模式下，即可使用强大的公共词库快速查询。登录后解锁 AI 翻译、例句分析与学习工具，让每一次查词都沉淀为可复习的知识。
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-[60px] rounded-lg bg-blue-600 px-9 text-lg font-semibold text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.95)] hover:bg-blue-700"
                onClick={() => scrollToSection(SEARCH_SECTION_ID, true)}
              >
                <Search className="h-5 w-5" />
                开始查词
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-[60px] rounded-lg border-slate-200 bg-white px-9 text-lg font-semibold text-slate-800 shadow-[0_10px_26px_-22px_rgba(15,23,42,0.4)] hover:bg-slate-50"
                onClick={() => scrollToSection('workflow')}
              >
                <BookText className="h-5 w-5" />
                先看看功能
              </Button>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              {highlightItems.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <item.icon className="mt-1 h-7 w-7 flex-shrink-0 text-cyan-600" />
                  <div>
                    <p className="text-base font-semibold text-[#061534]">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
        </div>
      </section>

      {results.length > 0 && (
        <section className="bg-white px-6 pb-20">
          <div className="mx-auto max-w-[1180px] rounded-[22px] border border-slate-200 bg-white px-7 py-7 shadow-[0_18px_60px_-46px_rgba(15,23,42,0.35)]">
            <div ref={resultsRef} className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-[#061534]">查词结果</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                先把这一组词查清楚；如果其中有值得反复回看的词，再登录把它们继续留下来学。
              </p>
            </div>
            <ResultsList results={results} showPos={showPos} showExample={showExample} />
          </div>
        </section>
      )}

      <section id="workflow" className="bg-white px-8 pb-24">
        <div className="mx-auto max-w-[1320px]">
          <div className="text-center">
            <h2 className="text-[34px] font-semibold tracking-[-0.03em] text-[#061534] sm:text-[40px]">
              从查询到掌握的 3 步学习循环
            </h2>
            <div className="mx-auto mt-4 h-1 w-24 bg-cyan-600" />
            <p className="mt-5 text-lg text-slate-500">让每一次查词都成为长期记忆的一部分</p>
          </div>

          <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {lightWorkflowSteps.map((item, index) => (
              <StepWithConnector key={item.title} item={item} showConnector={index < lightWorkflowSteps.length - 1} />
            ))}
          </div>

          <div className="mt-10 text-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-base font-semibold text-blue-600 transition-colors hover:text-blue-700"
              onClick={() => scrollToSection('features')}
            >
              查看完整功能
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="bg-[#03121e] bg-[radial-gradient(circle_at_72%_6%,rgba(37,99,235,0.28),transparent_28%),radial-gradient(circle_at_18%_30%,rgba(20,184,166,0.14),transparent_24%),linear-gradient(180deg,#03101a_0%,#061625_42%,#03121e_100%)] px-8 py-24 text-white"
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="grid items-center gap-14 lg:grid-cols-[0.82fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4" />
                为大学生打造的英语学习空间
              </span>
              <h2 className="mt-8 text-[46px] font-semibold leading-[1.15] tracking-[-0.045em] sm:text-[58px]">
                查词、翻译与复习
                <br />
                融为一体的学习流程
              </h2>
              <p className="mt-8 max-w-[560px] text-lg leading-8 text-slate-300">
                游客模式下即可使用强大的公共词库快速查询。登录后解锁 AI 翻译、例句分析与学习工具，让每一次学习都更高效地沉淀与掌握。
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button
                  size="lg"
                  className="h-[58px] rounded-lg bg-blue-600 px-9 text-base font-semibold text-white hover:bg-blue-500"
                  onClick={() => scrollToSection(SEARCH_SECTION_ID, true)}
                >
                  <Search className="h-5 w-5" />
                  开始查词
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-[58px] rounded-lg border-white/20 bg-white/[0.03] px-8 text-base font-semibold text-white hover:bg-white/[0.08]"
                  onClick={() => scrollToSection('dark-workflow')}
                >
                  <PlayCircle className="h-5 w-5" />
                  看看怎么用
                </Button>
              </div>
              <div className="mt-12 grid gap-6 sm:grid-cols-3">
                {highlightItems.map((item) => (
                  <div key={`dark-${item.title}`} className="flex items-start gap-3">
                    <item.icon className="mt-1 h-6 w-6 flex-shrink-0 text-cyan-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <GuestWordInputCard
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              setResults={setResults}
              wordsInput={wordsInput}
              setWordsInput={setWordsInput}
              onLockedFeatureClick={onFeatureClick}
              variant="dark"
            />
          </div>

          <div className="mt-20 grid overflow-hidden rounded-2xl border border-white/12 bg-white/[0.035] lg:grid-cols-3">
            {supportItems.map((item, index) => (
              <div
                key={item.title}
                className={cn(
                  'flex items-center gap-5 px-8 py-8',
                  index > 0 && 'border-t border-white/10 lg:border-l lg:border-t-0',
                )}
              >
                <item.icon className="h-10 w-10 flex-shrink-0 text-slate-300" />
                <div>
                  <p className="text-lg font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div id="dark-workflow" className="pt-24">
            <div className="text-center">
              <h2 className="text-[34px] font-semibold tracking-[-0.035em] text-white sm:text-[40px]">
                从查询到掌握的 3 步学习循环
              </h2>
              <p className="mt-4 text-lg text-slate-400">让每个新词都真正学会、记牢、用得上</p>
            </div>

            <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
              {darkWorkflowSteps.map((item, index) => (
                <DarkStep key={item.title} item={item} showConnector={index < darkWorkflowSteps.length - 1} />
              ))}
            </div>
          </div>

          <div className="pt-24">
            <div className="text-center">
              <h2 className="text-[34px] font-semibold tracking-[-0.035em] text-white sm:text-[40px]">
                游客模式 vs. 登录后解锁
              </h2>
              <p className="mt-4 text-lg text-slate-400">从基础查词到深度学习，按需解锁更多能力</p>
            </div>

            <div className="mx-auto mt-12 max-w-[1220px] overflow-hidden rounded-[24px] border border-white/16 bg-white/[0.025]">
              <div className="grid grid-cols-[1.3fr_1fr_1fr] border-b border-white/10">
                <div className="px-8 py-6" />
                <div className="border-l border-white/10 px-8 py-6 text-center text-xl font-semibold text-white">
                  游客模式 <span className="text-sm font-normal text-slate-400">（无需登录）</span>
                </div>
                <div className="border-l border-white/10 px-8 py-6 text-center text-xl font-semibold text-white">
                  登录后解锁 <span className="ml-2 rounded-full border border-amber-400/40 px-2 py-0.5 text-xs text-amber-300">推荐</span>
                </div>
              </div>

              {comparisonRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1.3fr_1fr_1fr] border-b border-white/10 last:border-b-0">
                  <div className="flex items-center gap-4 px-8 py-6">
                    <row.icon className="h-7 w-7 flex-shrink-0 text-white" />
                    <div>
                      <p className="font-semibold text-white">{row.label}</p>
                      <p className="mt-1 text-sm text-slate-400">{row.description}</p>
                    </div>
                  </div>
                  <CapabilityCell enabled={row.guest} />
                  <CapabilityCell enabled={row.member} emphasized />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 overflow-hidden rounded-[24px] border border-white/16 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.035)_54%,rgba(2,6,23,0.18)_100%)] px-10 py-10">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_430px]">
              <div>
                <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-white">
                  现在就开始你的词汇学习之旅
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  无需登录即可使用公共词库查询，体验 EZTor 带来的高效学习流程。
                </p>
                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-12 rounded-lg bg-blue-600 px-7 text-white hover:bg-blue-500"
                    onClick={() => scrollToSection(SEARCH_SECTION_ID, true)}
                  >
                    <Search className="h-5 w-5" />
                    立即查询（游客模式）
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-lg border-white/16 bg-white/[0.03] px-7 text-white hover:bg-white/[0.08]"
                    onClick={() => router.push('/auth/signin')}
                  >
                    登录解锁更多功能
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="hidden h-44 rounded-[20px] bg-[radial-gradient(circle_at_74%_40%,rgba(34,197,94,0.18),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.2),rgba(255,255,255,0.08))] lg:block" />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 bg-[#03121e] px-8 py-10 text-slate-400">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-white">
              <BookOpen className="h-7 w-7 text-cyan-200" />
              <span className="text-2xl font-semibold tracking-tight">EZTor</span>
            </div>
            <p className="mt-4 text-sm">让英语学习更高效、更轻松。</p>
          </div>
          <nav className="flex flex-wrap gap-x-12 gap-y-4 text-sm">
            <a href="#features" className="hover:text-white">产品功能</a>
            <a href="#workflow" className="hover:text-white">学习方式</a>
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
              粤ICP备2026008729号
            </a>
          </nav>
          <p className="text-sm">© 2026 EZTor. All rights reserved.</p>
        </div>
      </footer>
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
      <div className="rounded-lg border border-slate-200 bg-white px-8 py-7 shadow-[0_18px_46px_-38px_rgba(15,23,42,0.32)]">
        <div className="flex items-start gap-5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-semibold text-blue-600">
            {item.step}
          </span>
          <div>
            <h3 className="text-2xl font-semibold text-[#061534]">{item.title}</h3>
            <div className="mt-5 flex gap-5">
              <item.icon className="mt-1 h-10 w-10 flex-shrink-0 text-[#061534]" />
              <p className="text-base leading-7 text-slate-600">{item.description}</p>
            </div>
          </div>
        </div>
      </div>
      {showConnector && (
        <div className="hidden items-center text-cyan-700 lg:flex">
          <span className="block h-px w-16 border-t border-dashed border-cyan-600/70" />
          <ArrowRight className="-ml-1 h-7 w-7" />
        </div>
      )}
    </>
  )
}

function DarkStep({ item, showConnector }: { item: WorkflowItem; showConnector: boolean }) {
  return (
    <>
      <div className="rounded-2xl border border-white/16 bg-white/[0.03] p-7">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/20 text-lg font-semibold text-blue-100">
            {item.step}
          </span>
          <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
        </div>
        <p className="mt-5 min-h-[56px] text-base leading-7 text-slate-300">{item.description}</p>
        <div className="mt-6 rounded-xl border border-white/12 bg-black/10 p-5">
          <item.icon className="mb-4 h-8 w-8 text-cyan-200" />
          <p className="font-mono text-sm text-slate-300">inevitable</p>
          <p className="mt-2 text-sm text-slate-400">/ɪˈnevɪtəbl/ · adj. 不可避免的</p>
        </div>
      </div>
      {showConnector && (
        <div className="hidden pt-28 text-white lg:block">
          <ArrowRight className="h-7 w-7" />
        </div>
      )}
    </>
  )
}

function CapabilityCell({ enabled, emphasized = false }: { enabled: boolean; emphasized?: boolean }) {
  return (
    <div className="flex items-center justify-center border-l border-white/10 px-8 py-6">
      {enabled ? (
        <span
          className={cn(
            'inline-flex items-center gap-2 text-sm text-slate-200',
            emphasized && 'text-white',
          )}
        >
          <span className={cn('flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/80 text-slate-950', emphasized && 'bg-blue-500 text-white')}>
            <Check className="h-3.5 w-3.5" />
          </span>
          支持
        </span>
      ) : (
        <Minus className="h-5 w-5 text-slate-500" />
      )}
    </div>
  )
}
