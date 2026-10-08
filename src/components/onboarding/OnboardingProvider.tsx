'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useAnalytics } from '@/lib/analytics'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BookOpen, Highlighter, RotateCcw, Compass } from 'lucide-react'

// 1–8 belonged to the retired page-by-page tour. New steps do not trigger its page tooltips.
export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 12 | 13 | 14
interface OnboardingState { currentStep: OnboardingStep; isActive: boolean; needsOnboarding: boolean; isLoading: boolean }
interface OnboardingContextType extends OnboardingState {
  nextStep: () => void
  completeOnboarding: () => Promise<void>
  skipOnboarding: () => Promise<void>
  startOnboarding: () => void
}
const OnboardingContext = createContext<OnboardingContextType | null>(null)
const steps = [
  { icon: BookOpen, title: '从一套试卷开始', description: '在“四六级备考”选择级别与练习模式，按年份或关键词找到试卷。切换试卷时会保存作答，回来继续。', example: '阅读、听力、写作和翻译，按今天的时间选择。' },
  { icon: Highlighter, title: '读不懂的地方，点一下', description: '点单词查释义，查过的词用荧光标出；再次点按可取消荧光。选中单词或语句可划线标记，两种标记可以共存。', example: '单词优先查公共词库，缺词时由 AI 补充；AI 内容仍需结合上下文判断。' },
  { icon: RotateCcw, title: '回看标记，复习薄弱点', description: '在词库的“标记查询”查看标过的单词与语句，并跳回对应试卷段落。需要练拼写时，再使用生词本、默写和错词本。', example: '文章标记用于回看，不会自动变成默写任务。' },
  { icon: Compass, title: '按自己的节奏学习', description: '手机点击底部入口打开导航，桌面使用侧栏。学习记录随账号保存；现在可直接使用网页版，微信小程序尚未上线。', example: '不用安装 APP。之后可从“设置 → 使用指南”重新查看引导。' },
]
const idle: OnboardingState = { currentStep: 0, isActive: false, needsOnboarding: false, isLoading: false }
export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider')
  return context
}
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const router = useRouter()
  const { track } = useAnalytics()
  const [state, setState] = useState<OnboardingState>(idle)
  const revision = useRef(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const key = userId ? `onboarding:v2:${userId}` : null
  useEffect(() => {
    let active = true
    const requestVersion = ++revision.current
    setState(idle); setError('')
    if (status !== 'authenticated' || !key) return
    let saved = 0
    try { saved = Number(localStorage.getItem(key)) } catch { /* Storage may be unavailable. */ }
    const resumable = Number.isInteger(saved) && saved >= 11 && saved <= 14
    setState({ ...idle, isLoading: true })
    fetch(`/api/onboarding/status${resumable ? '?resume=1' : ''}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('引导状态暂不可用')
        const result = await response.json()
        if (!result.success) throw new Error('引导状态暂不可用')
        if (active && requestVersion === revision.current) setState(result.needsOnboarding ? { currentStep: resumable ? saved as OnboardingStep : 11, isActive: true, needsOnboarding: true, isLoading: false } : idle)
      })
      .catch(() => { if (active && requestVersion === revision.current) setState(idle) })
    return () => { active = false }
  }, [key, status])
  useEffect(() => {
    if (!key || !state.isActive) return
    try { localStorage.setItem(key, String(state.currentStep)) } catch { /* Storage may be unavailable. */ }
  }, [key, state.currentStep, state.isActive])
  const completeOnboarding = useCallback(async () => {
    if (saving) throw new Error('正在保存')
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!response.ok) throw new Error('保存未成功，请重试。你的引导进度已保留。')
      if (key) { try { localStorage.removeItem(key) } catch { /* Storage may be unavailable. */ } }
      setState(idle)
      track('ONBOARDING_COMPLETE', { method: 'guided_v2' })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存未成功，请重试。')
      throw failure
    } finally { setSaving(false) }
  }, [key, saving, track])
  const finish = (href?: string) => { void completeOnboarding().then(() => { if (href) router.push(href) }).catch(() => {}) }
  const nextStep = useCallback(() => {
    setState((previous) => ({ ...previous, currentStep: Math.min(14, previous.currentStep + 1) as OnboardingStep }))
  }, [])
  const startOnboarding = useCallback(() => { if (userId) { revision.current++; setError(''); setState({ currentStep: 11, isActive: true, needsOnboarding: true, isLoading: false }) } }, [userId])
  const step = steps[state.currentStep - 11]
  const Icon = step?.icon ?? BookOpen
  return <OnboardingContext.Provider value={{ ...state, nextStep, completeOnboarding, skipOnboarding: completeOnboarding, startOnboarding }}>
    {children}
    <Dialog open={state.isActive && !!step} onOpenChange={(open) => { if (!open && !saving) finish() }}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-lg max-h-[calc(100dvh-24px)] overflow-y-auto" showCloseButton={false} onEscapeKeyDown={(event) => { if (saving) event.preventDefault() }} onPointerDownOutside={(event) => event.preventDefault()}>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>使用引导 · {state.currentStep - 10} / 4</span><Button variant="ghost" size="sm" disabled={saving} onClick={() => finish()}>稍后再看</Button></div>
        <div className="flex gap-2" aria-hidden>{steps.map((_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= state.currentStep - 11 ? 'bg-primary' : 'bg-muted'}`} />)}</div>
        <Icon className="size-10 text-primary mt-2" aria-hidden />
        <DialogTitle className="text-xl">{step?.title}</DialogTitle>
        <DialogDescription className="text-sm leading-7">{step?.description}</DialogDescription>
        <p className="rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">{step?.example}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-2">
          {state.currentStep > 11 && <Button variant="outline" disabled={saving} className="min-h-11" onClick={() => setState((previous) => ({ ...previous, currentStep: previous.currentStep - 1 as OnboardingStep }))}>上一步</Button>}
          {state.currentStep < 14 ? <Button disabled={saving} className="min-h-11 flex-1" onClick={nextStep}>下一步</Button> : <><Button variant="outline" disabled={saving} className="min-h-11" onClick={() => finish('/ai')}>先查一个词</Button><Button disabled={saving} className="min-h-11 flex-1" onClick={() => finish('/study')}>{saving ? '正在保存…' : '去选卷练习'}</Button></>}
        </div>
      </DialogContent>
    </Dialog>
  </OnboardingContext.Provider>
}
