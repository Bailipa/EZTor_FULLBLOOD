'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BookOpen, Database, Award } from 'lucide-react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { usePageView } from '@/lib/analytics'
import { usePanelSwipe } from '@/hooks/usePanelSwipe'
import { useMinimalFeatures } from '@/components/interface-style-provider'
import { playFeedbackSound } from '@/lib/feedbackSounds'
import styles from './vocabulary-workspace.module.css'

const HistoryWorkspacePanel = dynamic(() => import('@/components/vocabulary/HistoryWorkspacePanel').then((module) => module.HistoryWorkspacePanel), {
  loading: () => <PanelLoading />,
})
const ReadingMarksPanel = dynamic(() => import('@/components/vocabulary/ReadingMarksPanel'), { loading: () => <PanelLoading /> })
const PublicVocabularyWorkspacePanel = dynamic(() => import('@/components/vocabulary/PublicVocabularyWorkspacePanel').then((module) => module.PublicVocabularyWorkspacePanel), {
  loading: () => <PanelLoading />,
})
const ContributionWorkspacePanel = dynamic(() => import('@/components/vocabulary/ContributionWorkspacePanel').then((module) => module.ContributionWorkspacePanel), {
  loading: () => <PanelLoading />,
})

type VocabularyPanel = 'history' | 'marks' | 'public' | 'contributions'
const panels: { id: VocabularyPanel; label: string; icon: typeof BookOpen }[] = [
  { id: 'history', label: '生词本', icon: BookOpen },
  { id: 'marks', label: '标记查询', icon: BookOpen },
  { id: 'public', label: '公共词库', icon: Database },
  { id: 'contributions', label: '单词贡献榜', icon: Award },
]


function PanelLoading() {
  return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground" role="status">正在载入…</div>
}

export default function VocabularyWorkspace({ initialPanel }: { initialPanel: VocabularyPanel }) {
  const { minimal, ready, visible } = useMinimalFeatures()
  const visiblePanels = panels.filter(({ id }) => visible('vocabulary', id === 'marks' ? 'history' : id))
  const panelIds = visiblePanels.map(({ id }) => id)
  const [selectedPanel, setActivePanel] = useState(initialPanel)
  const activePanel = panelIds.includes(selectedPanel) ? selectedPanel : panelIds[0]
  const gridRef = useRef<HTMLDivElement>(null)
  const [layoutTier, setLayoutTier] = useState<'single' | 'paired' | 'wide' | null>(null)
  const [mountedPanels, setMountedPanels] = useState<Set<VocabularyPanel>>(() => new Set([initialPanel]))
  const { data: session, status } = useSession()
  const accountScope = session?.user?.id ?? status
  const pathname = usePathname()
  const router = useRouter()
  usePageView(initialPanel === 'public' ? 'Public Vocabulary' : initialPanel === 'contributions' ? 'Contributions' : 'Vocabulary')

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1280px)')
    const paired = window.matchMedia('(min-width: 1100px)')
    const updateLayoutTier = () => setLayoutTier(wide.matches ? 'wide' : paired.matches ? 'paired' : 'single')
    updateLayoutTier()
    wide.addEventListener('change', updateLayoutTier)
    paired.addEventListener('change', updateLayoutTier)
    return () => {
      wide.removeEventListener('change', updateLayoutTier)
      paired.removeEventListener('change', updateLayoutTier)
    }
  }, [])

  useEffect(() => {
    if (!activePanel || !ready) return
    let visiblePanels: VocabularyPanel[] = [activePanel]
    if (activePanel !== 'marks' && !minimal && layoutTier === 'wide') {
      visiblePanels = ['history', 'public', 'contributions']
    } else if (activePanel !== 'marks' && !minimal && layoutTier === 'paired') {
      visiblePanels = activePanel === 'contributions'
        ? ['public', 'contributions']
        : ['history', 'public']
    }
    setMountedPanels((current) => visiblePanels.every((panel) => current.has(panel))
      ? current
      : new Set([...current, ...visiblePanels]))
  }, [activePanel, layoutTier, minimal, ready])

  useEffect(() => {
    if (initialPanel === 'contributions' && status === 'unauthenticated') {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`)
    }
  }, [initialPanel, pathname, router, status])

  usePanelSwipe(gridRef, activePanel ?? initialPanel, panelIds, (panel) => {
    setMountedPanels((current) => new Set([...current, panel]))
    setActivePanel(panel)
    playFeedbackSound('swipe')
    return true
  }, !!activePanel && ready && (minimal || layoutTier === 'single'))

  const historyVisible = activePanel !== 'marks' && ((!minimal && (layoutTier === 'wide' || (layoutTier === 'paired' && activePanel !== 'contributions'))) || activePanel === 'history')

  return (
    <AppLayout workspaceHeader={
        <nav data-vocabulary-nav aria-label="词库栏目">
          {visiblePanels.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-label={label} aria-pressed={activePanel === id} onClick={() => setActivePanel(id)}>
              <Icon aria-hidden="true" />{id === 'contributions' ? <><span data-vocabulary-label-full>{label}</span><span data-vocabulary-label-compact>贡献榜</span></> : label}
            </button>
          ))}
        </nav>
    }>
      <main data-workspace-page data-vocabulary-workspace data-vocabulary-active={activePanel} data-vocabulary-entry={initialPanel} className="flex min-h-0 flex-col gap-3 bg-background p-4 pb-6 md:p-6 xl:pb-6">
        {minimal && <Link href="/me#minimal-features" className="text-sm text-muted-foreground underline">显示功能设置</Link>}
        {!ready && <p role="status" className="p-6 text-sm text-muted-foreground">正在恢复词库设置…</p>}
        {ready && !activePanel && <p role="status" className="p-6 text-sm text-muted-foreground">词库栏目已隐藏，可在设置中恢复。</p>}
        <div ref={gridRef} data-vocabulary-grid className={styles.swipeViewport}>
          {ready && visible('vocabulary', 'history') && (!minimal || activePanel === 'history') && <section data-vocabulary-panel="history" data-panel-swipe-active={activePanel === 'history'} aria-label="生词本">{mountedPanels.has('history') && <HistoryWorkspacePanel key={accountScope} embedded active={historyVisible} />}</section>}
          {ready && visible('vocabulary', 'history') && <section data-vocabulary-panel="marks" data-panel-swipe-active={activePanel === 'marks'} aria-label="标记查询">{mountedPanels.has('marks') && (session?.user?.id ? <ReadingMarksPanel key={accountScope} accountId={session.user.id} active={activePanel === 'marks'} /> : <div data-vocabulary-login className="flex flex-col items-center justify-center gap-3 p-6"><p>登录后查询题目标记</p><Link href="/auth/signin?callbackUrl=%2Fhistory%3Fview%3Dmarks">登录</Link></div>)}</section>}
          {ready && visible('vocabulary', 'public') && (!minimal || activePanel === 'public') && <section data-vocabulary-panel="public" data-panel-swipe-active={activePanel === 'public'} aria-label="公共词库">{mountedPanels.has('public') && <PublicVocabularyWorkspacePanel key={accountScope} embedded />}</section>}
          {ready && visible('vocabulary', 'contributions') && (!minimal || activePanel === 'contributions') && <section data-vocabulary-panel="contributions" data-panel-swipe-active={activePanel === 'contributions'} aria-label="单词贡献榜">
            {!mountedPanels.has('contributions') ? null : status === 'authenticated' ? <ContributionWorkspacePanel key={accountScope} embedded /> : (
              <div data-vocabulary-login className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
                <Award className="size-6 text-primary" />
                <p className="font-medium">登录后查看单词贡献榜</p>
                <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/auth/signin?callbackUrl=${encodeURIComponent('/contributions')}`}>登录</Link>
              </div>
            )}
          </section>}
        </div>
      </main>
    </AppLayout>
  )
}
