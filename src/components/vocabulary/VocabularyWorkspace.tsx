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
import { playFeedbackSound } from '@/lib/feedbackSounds'
import styles from './vocabulary-workspace.module.css'

const HistoryWorkspacePanel = dynamic(() => import('@/components/vocabulary/HistoryWorkspacePanel').then((module) => module.HistoryWorkspacePanel), {
  loading: () => <PanelLoading />,
})
const PublicVocabularyWorkspacePanel = dynamic(() => import('@/components/vocabulary/PublicVocabularyWorkspacePanel').then((module) => module.PublicVocabularyWorkspacePanel), {
  loading: () => <PanelLoading />,
})
const ContributionWorkspacePanel = dynamic(() => import('@/components/vocabulary/ContributionWorkspacePanel').then((module) => module.ContributionWorkspacePanel), {
  loading: () => <PanelLoading />,
})

type VocabularyPanel = 'history' | 'public' | 'contributions'
const panels: { id: VocabularyPanel; label: string; icon: typeof BookOpen }[] = [
  { id: 'history', label: '生词本', icon: BookOpen },
  { id: 'public', label: '公共词库', icon: Database },
  { id: 'contributions', label: '单词贡献榜', icon: Award },
]

const panelIds = panels.map((panel) => panel.id)

function PanelLoading() {
  return <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground" role="status">正在载入…</div>
}

export default function VocabularyWorkspace({ initialPanel }: { initialPanel: VocabularyPanel }) {
  const [activePanel, setActivePanel] = useState(initialPanel)
  const gridRef = useRef<HTMLDivElement>(null)
  const [layoutTier, setLayoutTier] = useState<'single' | 'paired' | 'wide' | null>(null)
  const [mountedPanels, setMountedPanels] = useState<Set<VocabularyPanel>>(() => new Set([initialPanel]))
  const { data: session, status } = useSession()
  const accountScope = session?.user?.id ?? status
  const pathname = usePathname()
  const router = useRouter()
  usePageView(initialPanel === 'public' ? 'Public Vocabulary' : initialPanel === 'contributions' ? 'Contributions' : 'Vocabulary')

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1440px)')
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
    let visiblePanels: VocabularyPanel[] = [activePanel]
    if (layoutTier === 'wide') {
      visiblePanels = ['history', 'public', 'contributions']
    } else if (layoutTier === 'paired') {
      visiblePanels = activePanel === 'contributions'
        ? ['public', 'contributions']
        : ['history', 'public']
    }
    setMountedPanels((current) => visiblePanels.every((panel) => current.has(panel))
      ? current
      : new Set([...current, ...visiblePanels]))
  }, [activePanel, layoutTier])

  useEffect(() => {
    if (initialPanel === 'contributions' && status === 'unauthenticated') {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`)
    }
  }, [initialPanel, pathname, router, status])

  usePanelSwipe(gridRef, activePanel, panelIds, (panel) => {
    setMountedPanels((current) => new Set([...current, panel]))
    setActivePanel(panel)
    playFeedbackSound('swipe')
    return true
  }, layoutTier === 'single')

  const historyVisible = layoutTier === 'wide' || (layoutTier === 'paired' && activePanel !== 'contributions') || activePanel === 'history'

  return (
    <AppLayout>
      <main data-workspace-page data-vocabulary-workspace data-vocabulary-active={activePanel} data-vocabulary-entry={initialPanel} className="flex min-h-0 flex-col gap-3 bg-background p-4 pb-6 md:p-6 xl:pb-6">
        <nav data-vocabulary-nav aria-label="词库栏目">
          {panels.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={activePanel === id} onClick={() => setActivePanel(id)}>
              <Icon aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
        <div ref={gridRef} data-vocabulary-grid className={styles.swipeViewport}>
          <section data-vocabulary-panel="history" data-panel-swipe-active={activePanel === 'history'} aria-label="生词本">{mountedPanels.has('history') && <HistoryWorkspacePanel key={accountScope} embedded active={historyVisible} />}</section>
          <section data-vocabulary-panel="public" data-panel-swipe-active={activePanel === 'public'} aria-label="公共词库">{mountedPanels.has('public') && <PublicVocabularyWorkspacePanel key={accountScope} embedded />}</section>
          <section data-vocabulary-panel="contributions" data-panel-swipe-active={activePanel === 'contributions'} aria-label="单词贡献榜">
            {!mountedPanels.has('contributions') ? null : status === 'authenticated' ? <ContributionWorkspacePanel key={accountScope} embedded /> : (
              <div data-vocabulary-login className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
                <Award className="size-6 text-primary" />
                <p className="font-medium">登录后查看单词贡献榜</p>
                <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/auth/signin?callbackUrl=${encodeURIComponent('/contributions')}`}>登录</Link>
              </div>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  )
}
