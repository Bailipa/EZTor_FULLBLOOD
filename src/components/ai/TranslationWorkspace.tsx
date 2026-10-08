'use client'

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { useMinimalFeatures } from '@/components/interface-style-provider'
import { motion } from 'framer-motion'
import { useReducedInterfaceMotion } from '@/hooks/useReducedInterfaceMotion'
import { usePanelSwipe } from '@/hooks/usePanelSwipe'
import { playFeedbackSound } from '@/lib/feedbackSounds'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { WordTranslationPanel } from '@/components/home/WordTranslationPanel'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import type { ReviewGroup } from '@/types/api'
import { readExperiencePreferences } from '@/lib/experiencePreferences'
import { readUserPreferences, subscribeUserPreferences } from '@/lib/userPreferences'
import styles from './translation-workspace.module.css'

const ZhEnAssistant = dynamic(
  () => import('./ZhEnAssistant').then((module) => module.ZhEnAssistant),
  { loading: () => <div className="p-6 text-sm text-muted-foreground" role="status">正在打开翻译功能…</div> },
)

const ChatRoom = dynamic(
  () => import('@/components/chat/ChatRoom').then((module) => module.ChatRoom),
  { loading: () => <div className="p-6 text-sm text-muted-foreground" role="status">正在打开聊天室…</div> },
)

type TranslationTask = 'realtime' | 'supplement'
type AssistantView = 'zh-en' | 'text' | 'ai' | 'chat'
type TranslationMode = 'realtime' | AssistantView
type DeskLayout = 'single' | 'split' | 'full'

const translationModes: { value: TranslationMode; label: string }[] = [
  { value: 'realtime', label: '实时翻译' },
  { value: 'zh-en', label: '中译英' },
  { value: 'text', label: '译句子' },
  { value: 'ai', label: '问AI助手' },
  { value: 'chat', label: '聊天室' },
]


const translationNavigationStoragePrefix = 'eztor:translation-navigation:v1:'

function getTranslationNavigationStorageKey(scope: string) {
  return `${translationNavigationStoragePrefix}${encodeURIComponent(scope)}`
}

export function TranslationWorkspace() {
  const { minimal, ready: featuresReady, visible: featureVisible } = useMinimalFeatures()
  const visibleModes = translationModes.filter(({ value }) => featureVisible('translation', value))
  const panelModes = visibleModes.map(({ value }) => value)
  const indicatorId = useId()
  const reducedMotion = useReducedInterfaceMotion()
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const isAuthenticated = status === 'authenticated' && !!userId
  const navigationScope = status === 'loading' ? null : userId ? `user:${userId}` : 'guest'
  const [task, setTask] = useState<TranslationTask>('realtime')
  const [assistantView, setAssistantView] = useState<AssistantView>('zh-en')
  const [conversationView, setConversationView] = useState<'ai' | 'chat'>('ai')
  const [viewportLayout, setDeskLayout] = useState<DeskLayout>('single')
  const deskLayout = minimal ? 'single' : viewportLayout
  const [openedModes, setOpenedModes] = useState<AssistantView[]>([])
  const [loadedNavigationScope, setLoadedNavigationScope] = useState<string | null>(null)
  const navigationReady = featuresReady && !!navigationScope && loadedNavigationScope === navigationScope
  const mainRef = useRef<HTMLElement>(null)
  const [showPhonetic, setShowPhonetic] = useState(true)
  const [showPos, setShowPos] = useState(true)
  const [showExample, setShowExample] = useState(true)
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState('none')
  const [autoSaveWords, setAutoSaveWords] = useState(true)
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [preferencesLoadError, setPreferencesLoadError] = useState(false)
  const realtimeEnabled = featureVisible('translation', 'realtime')
  const lineGesture = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean; target: HTMLButtonElement; bounds: { left: number; width: number } } | null>(null)
  const lineMoveFrame = useRef<number | null>(null)
  const pendingLineShift = useRef<{ target: HTMLButtonElement; shift: number } | null>(null)
  const suppressLineClick = useRef(false)
  const { promptLogin, LoginPromptDialog } = useLoginPrompt()
  const groupOptions = useMemo(() => groups.map(({ id, name }) => ({ id, name })), [groups])

  useEffect(() => {
    if (!navigationScope) return

    let savedTask: TranslationTask = 'realtime'
    let savedView: AssistantView = 'zh-en'
    let savedConversation: 'ai' | 'chat' = 'ai'
    try {
      const raw = localStorage.getItem(getTranslationNavigationStorageKey(navigationScope))
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.task === 'supplement') savedTask = 'supplement'
        if (saved?.view === 'text' || saved?.view === 'ai' || saved?.view === 'chat') savedView = saved.view
        if (saved?.conversation === 'chat' || savedView === 'chat') savedConversation = 'chat'
      }
    } catch {
      // Keep the first-visit defaults when browser storage is unavailable or invalid.
    }

    setTask(savedTask)
    setAssistantView(savedView)
    setConversationView(savedConversation)
    setOpenedModes(savedTask === 'supplement' ? [savedView] : [])
    setLoadedNavigationScope(navigationScope)
  }, [navigationScope])

  useEffect(() => {
    if (!navigationReady || !['#chat', '#assistant'].includes(window.location.hash)) return

    const mode = window.location.hash === '#assistant' ? 'ai' : 'chat'

    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    if (!isAuthenticated) {
      promptLogin(mode === 'ai' ? 'AI 助手' : '聊天室')
      return
    }

    setOpenedModes((modes) => modes.includes(mode) ? modes : [...modes, mode])
    setTask('supplement')
    setAssistantView(mode)
    setConversationView(mode)
  }, [isAuthenticated, navigationReady, promptLogin])

  useEffect(() => {
    if (!navigationReady || !navigationScope) return
    try {
      localStorage.setItem(getTranslationNavigationStorageKey(navigationScope), JSON.stringify({ task, view: assistantView, conversation: conversationView }))
    } catch {
      // Navigation still works for this visit if browser storage is unavailable.
    }
  }, [assistantView, conversationView, navigationReady, navigationScope, task])

  useEffect(() => {
    const split = window.matchMedia('(min-width: 1100px)')
    const full = window.matchMedia('(min-width: 1280px)')
    const updateLayout = () => setDeskLayout(full.matches ? 'full' : split.matches ? 'split' : 'single')
    updateLayout()
    split.addEventListener('change', updateLayout)
    full.addEventListener('change', updateLayout)
    return () => {
      split.removeEventListener('change', updateLayout)
      full.removeEventListener('change', updateLayout)
    }
  }, [])

  useEffect(() => {
    if (!navigationReady || deskLayout === 'single') return
    const visibleModes: AssistantView[] = deskLayout === 'full' ? ['zh-en', 'text', conversationView] : [assistantView]
    setOpenedModes((modes) => [...new Set([...modes, ...visibleModes])])
  }, [assistantView, conversationView, deskLayout, navigationReady])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    let frame = 0
    const revealInput = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const input = document.activeElement
        if (!(input instanceof HTMLElement) || !main.contains(input) || !input.matches('input, textarea')) return
        const bounds = main.getBoundingClientRect()
        const field = input.getBoundingClientRect()
        const bottom = Math.min(bounds.bottom, (window.visualViewport?.height ?? window.innerHeight) + (window.visualViewport?.offsetTop ?? 0)) - 12
        if (field.bottom > bottom) main.scrollTop += field.bottom - bottom
        else if (field.top < bounds.top + 12) main.scrollTop -= bounds.top + 12 - field.top
      })
    }
    const observer = new ResizeObserver(revealInput)
    observer.observe(main)
    main.addEventListener('focusin', revealInput)
    window.visualViewport?.addEventListener('resize', revealInput)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); main.removeEventListener('focusin', revealInput); window.visualViewport?.removeEventListener('resize', revealInput) }
  }, [])

  useEffect(() => {
    const preferences = readExperiencePreferences()
    setShowPhonetic(preferences.showPhonetic)
    setShowPos(preferences.showPos)
    setShowExample(preferences.showExample)
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!isAuthenticated || !userId) {
      setGroups([])
      setAutoSaveWords(true)
      setSoundEffectsEnabled(true)
      setPreferencesLoadError(false)
      setPreferencesReady(true)
      return
    }

    let cancelled = false
    setPreferencesReady(false)
    const controller = new AbortController()
    const apply = (data: Awaited<ReturnType<typeof readUserPreferences>>) => {
      if (cancelled) return
      setAutoSaveWords(data.autoSaveWords)
      setSoundEffectsEnabled(data.soundEffectsEnabled ?? true)
      setPreferencesLoadError(false)
      setPreferencesReady(true)
    }
    const unsubscribe = subscribeUserPreferences(userId, ['autoSaveWords', 'soundEffectsEnabled'], apply)
    readUserPreferences(userId, controller.signal).then(apply).catch(() => {
      if (cancelled) return
      setAutoSaveWords(true)
      setSoundEffectsEnabled(true)
      setPreferencesLoadError(true)
      setPreferencesReady(true)
    })

    return () => {
      cancelled = true
      unsubscribe()
      controller.abort()
    }
  }, [isAuthenticated, status, userId])

  useEffect(() => {
    if (!isAuthenticated || !featuresReady || !realtimeEnabled) { setGroups([]); return }
    const controller = new AbortController()
    fetch('/api/review-groups', { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        if (!controller.signal.aborted && result?.success && Array.isArray(result.data)) setGroups(result.data)
      }).catch(() => {})
    return () => controller.abort()
  }, [isAuthenticated, featuresReady, realtimeEnabled, userId])

  const tabClass = (active: boolean) =>
    `${styles.taskTab} ${active ? styles.activeTab : ''}`

  const requestedMode: TranslationMode = task === 'realtime' ? 'realtime' : assistantView
  const selectedMode = panelModes.includes(requestedMode) ? requestedMode : panelModes[0]
  const modeAtPointer = (clientX: number, bounds: { left: number; width: number }) => {
    const position = Math.max(0, Math.min(0.9999, (clientX - bounds.left) / bounds.width))
    return visibleModes[Math.floor(position * visibleModes.length)]?.value
  }
  const lineShiftAtPointer = (clientX: number, bounds: { left: number; width: number }) => {
    const offset = Math.max(1, Math.min(81, ((clientX - bounds.left) / bounds.width) * 100 - 9))
    return ((offset - 1) / 18) * 100
  }

  const selectMode = (nextMode: TranslationMode | undefined) => {
    if (!nextMode || !featureVisible('translation', nextMode)) return false
    if (nextMode === 'chat') {
      if (!isAuthenticated) {
        promptLogin('聊天室')
        return false
      }
      setOpenedModes((modes) => modes.includes('chat') ? modes : [...modes, 'chat'])
      setTask('supplement')
      setAssistantView('chat')
      setConversationView('chat')
      return true
    }
    if (nextMode === 'realtime') {
      setTask('realtime')
      return true
    }
    if (nextMode === 'text' && !isAuthenticated) {
      promptLogin('文本翻译')
      return false
    }
    if (nextMode === 'ai' && !isAuthenticated) {
      promptLogin('AI询问')
      return false
    }
    setOpenedModes((modes) => modes.includes(nextMode) ? modes : [...modes, nextMode])
    setTask('supplement')
    setAssistantView(nextMode)
    if (nextMode === 'ai') setConversationView('ai')
    return true
  }

  usePanelSwipe(mainRef, selectedMode ?? 'realtime', panelModes, (mode) => {
    if (!selectMode(mode)) return false
    playFeedbackSound('swipe')
    return true
  }, !!selectedMode && navigationReady && deskLayout === 'single')

  const handleLinePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || lineGesture.current) return
    if (lineMoveFrame.current !== null) cancelAnimationFrame(lineMoveFrame.current)
    lineMoveFrame.current = null
    pendingLineShift.current = null
    const bounds = event.currentTarget.getBoundingClientRect()
    lineGesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, target: event.currentTarget, bounds }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.dragging = 'true'
    event.currentTarget.style.setProperty('--navigation-line-shift', `${lineShiftAtPointer(event.clientX, bounds)}%`)
  }

  const handleLinePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = lineGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    if (Math.hypot(deltaX, deltaY) > 8) gesture.moved = true
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return
    pendingLineShift.current = { target: gesture.target, shift: lineShiftAtPointer(event.clientX, gesture.bounds) }
    if (lineMoveFrame.current !== null) return
    lineMoveFrame.current = requestAnimationFrame(() => {
      const pending = pendingLineShift.current
      if (pending) pending.target.style.setProperty('--navigation-line-shift', `${pending.shift}%`)
      pendingLineShift.current = null
      lineMoveFrame.current = null
    })
  }

  const handleLinePointerUp = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const gesture = lineGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    lineGesture.current = null
    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY
    const moved = gesture.moved || Math.hypot(deltaX, deltaY) > 8
    if (lineMoveFrame.current !== null) cancelAnimationFrame(lineMoveFrame.current)
    lineMoveFrame.current = null
    pendingLineShift.current = null
    if (moved && Math.abs(deltaX) > Math.abs(deltaY)) {
      gesture.target.style.setProperty('--navigation-line-shift', `${lineShiftAtPointer(event.clientX, gesture.bounds)}%`)
    }
    if (!cancelled && moved) {
      suppressLineClick.current = true
      if (Math.abs(deltaX) >= 18 && Math.abs(deltaX) > Math.abs(deltaY)) selectMode(modeAtPointer(event.clientX, gesture.bounds))
    }
    lineMoveFrame.current = requestAnimationFrame(() => {
      delete gesture.target.dataset.dragging
      gesture.target.style.removeProperty('--navigation-line-shift')
      lineMoveFrame.current = null
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header data-workspace-translation-header className={styles.translationHeader}>
        <div data-workspace-translation-heading className={styles.translationHeading}>
          <button
            type="button"
            className={styles.navigationLine}
            disabled={!navigationReady || !selectedMode}
            aria-label={`滑动或点击导航线选择翻译功能；当前为${translationModes.find((mode) => mode.value === selectedMode)?.label}`}
            data-mode={selectedMode}
            onPointerDown={handleLinePointerDown}
            onPointerMove={handleLinePointerMove}
            onPointerUp={handleLinePointerUp}
            onPointerCancel={(event) => handleLinePointerUp(event, true)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const currentIndex = visibleModes.findIndex((mode) => mode.value === selectedMode)
              const offset = event.key === 'ArrowRight' ? 1 : -1
              const nextIndex = (currentIndex + offset + visibleModes.length) % visibleModes.length
              selectMode(visibleModes[nextIndex]?.value)
            }}
            onClick={(event) => {
              if (suppressLineClick.current) {
                suppressLineClick.current = false
                event.preventDefault()
                return
              }
              if (event.detail === 0) {
                selectMode(selectedMode)
                return
              }
              selectMode(modeAtPointer(event.clientX, event.currentTarget.getBoundingClientRect()))
            }}
          >
            <span className={styles.navigationLineTrack} aria-hidden="true" />
          </button>
          <div className={styles.translationControls}>
            <div className={styles.taskTabs} role="group" aria-label="翻译与聊天">
              {visibleModes.map(({ value, label }) => {
                const active = selectedMode === value
                return (
                  <button key={value} type="button" disabled={!navigationReady || !selectedMode} aria-pressed={active} className={tabClass(active)} onClick={() => selectMode(value)}>
                    {label}{active && <motion.span aria-hidden className={styles.tabIndicator} layoutId={reducedMotion ? undefined : indicatorId} initial={false} transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
                  </button>
                )
              })}
            </div>
          </div>
          {minimal && <Link href="/me#minimal-features" className="text-xs text-muted-foreground underline">显示功能设置</Link>}
        </div>
      </header>

      <main ref={mainRef} data-translation-desk={deskLayout} className={`min-h-0 flex-1 overflow-y-auto ${styles.canvas}`}>
        {!navigationReady ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />正在恢复翻译界面…
          </div>
        ) : !selectedMode ? (
          <p role="status" className="p-6 text-sm text-muted-foreground">翻译栏目已隐藏，可在设置中恢复。</p>
        ) : (
          <div data-translation-panels className={styles.deskPanels}>
            {realtimeEnabled && (!minimal || selectedMode === 'realtime') && <section data-desk-mode="realtime" data-desk-active={selectedMode === 'realtime'} data-panel-swipe-active={selectedMode === 'realtime'} className={deskLayout !== 'single' || selectedMode === 'realtime' ? styles.taskPanel : 'hidden'} aria-label="实时翻译">
              <h2 className={styles.deskPanelHeading}>实时翻译</h2>
              <div data-workspace-translation-content className={styles.translationPage}>
                {status === 'loading' || (isAuthenticated && !preferencesReady) ? (
                  <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin" />正在载入翻译设置…
                  </div>
                ) : (
                  <>
                    <WordTranslationPanel
                      showPhonetic={showPhonetic}
                      showPos={showPos}
                      showExample={showExample}
                      groups={groups}
                      selectedTargetGroupId={selectedTargetGroupId}
                      setSelectedTargetGroupId={setSelectedTargetGroupId}
                      isGuest={!isAuthenticated}
                      autoSaveWords={autoSaveWords}
                      soundEffectsEnabled={soundEffectsEnabled}
                      onGuestFeatureClick={promptLogin}
                      showTitle={false}
                    />
                    {isAuthenticated && preferencesLoadError && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">
                        保存设置暂未同步，本次按默认自动保存处理。
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>}

            {(['zh-en', 'text', 'ai', 'chat'] as AssistantView[]).map((mode) => {
              if (!featureVisible('translation', mode)) return null
              const visible = deskLayout === 'full'
                ? mode === 'zh-en' || mode === 'text' || mode === conversationView
                : deskLayout === 'split' ? mode === assistantView : mode === selectedMode
              if (!visible && (minimal || !openedModes.includes(mode))) return null
              const conversation = mode === 'ai' || mode === 'chat'
              return (
                <section key={`${navigationScope}:${mode}`} data-desk-mode={mode} data-desk-active={selectedMode === mode} data-panel-swipe-active={selectedMode === mode} className={visible ? `${conversation ? styles.fillPanel : ''} ${styles.taskPanel}` : 'hidden'} aria-label={translationModes.find((item) => item.value === mode)?.label}>
                  {!conversation && <h2 className={styles.deskPanelHeading}>{mode === 'zh-en' ? '中译英' : '译句子'}</h2>}
                  <div data-workspace-translation-content data-chat-content={conversation} className={`${styles.translationPage} ${conversation ? styles.assistantPage : ''}`}>
                    {minimal && !isAuthenticated && mode !== 'zh-en' ? (
                      <div className="flex min-h-32 flex-col items-center justify-center gap-3 p-6 text-sm">
                        <p>登录后使用{translationModes.find((item) => item.value === mode)?.label}</p>
                        <button type="button" className="min-h-9 text-primary underline" onClick={() => promptLogin(translationModes.find((item) => item.value === mode)?.label ?? '翻译功能')}>登录</button>
                      </div>
                    ) : mode === 'chat' ? <ChatRoom active={visible} /> : (
                      <ZhEnAssistant view={mode} onViewChange={selectMode} groups={groupOptions} />
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
      <LoginPromptDialog />
    </div>
  )
}
