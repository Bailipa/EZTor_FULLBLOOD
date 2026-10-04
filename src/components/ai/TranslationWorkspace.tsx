'use client'

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { useReducedInterfaceMotion } from '@/hooks/useReducedInterfaceMotion'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { WordTranslationPanel } from '@/components/home/WordTranslationPanel'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import type { ReviewGroup } from '@/types/api'
import { readExperiencePreferences } from '@/lib/experiencePreferences'
import styles from './translation-workspace.module.css'

const ZhEnAssistant = dynamic(
  () => import('./ZhEnAssistant').then((module) => module.ZhEnAssistant),
  { loading: () => <div className="p-6 text-sm text-muted-foreground" role="status">正在打开翻译功能…</div> },
)

type TranslationTask = 'realtime' | 'supplement'
type AssistantView = 'zh-en' | 'text' | 'ai' | 'chat'
type TranslationMode = 'realtime' | AssistantView

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
  const indicatorId = useId()
  const reducedMotion = useReducedInterfaceMotion()
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const isAuthenticated = status === 'authenticated' && !!userId
  const navigationScope = status === 'loading' ? null : userId ? `user:${userId}` : 'guest'
  const [task, setTask] = useState<TranslationTask>('realtime')
  const [assistantView, setAssistantView] = useState<AssistantView>('zh-en')
  const assistantFullHeight = assistantView === 'ai' || assistantView === 'chat'
  const [hasOpenedSupplement, setHasOpenedSupplement] = useState(false)
  const [loadedNavigationScope, setLoadedNavigationScope] = useState<string | null>(null)
  const navigationReady = !!navigationScope && loadedNavigationScope === navigationScope
  const mainRef = useRef<HTMLElement>(null)
  const [showPhonetic, setShowPhonetic] = useState(true)
  const [showPos, setShowPos] = useState(true)
  const [showExample, setShowExample] = useState(true)
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState('none')
  const [pendingRealtimeWord, setPendingRealtimeWord] = useState<{ word: string; requestId: number } | null>(null)
  const [autoSaveWords, setAutoSaveWords] = useState(true)
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [preferencesLoadError, setPreferencesLoadError] = useState(false)
  const realtimeWordRequestId = useRef(0)
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
    try {
      const raw = localStorage.getItem(getTranslationNavigationStorageKey(navigationScope))
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.task === 'supplement') savedTask = 'supplement'
        if (saved?.view === 'text' || saved?.view === 'ai' || saved?.view === 'chat') savedView = saved.view
      }
    } catch {
      // Keep the first-visit defaults when browser storage is unavailable or invalid.
    }

    setTask(savedTask)
    setAssistantView(savedView)
    setHasOpenedSupplement(savedTask === 'supplement')
    setLoadedNavigationScope(navigationScope)
  }, [navigationScope])

  useEffect(() => {
    if (!navigationReady || window.location.hash !== '#chat') return

    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    if (!isAuthenticated) {
      promptLogin('聊天室')
      return
    }

    setHasOpenedSupplement(true)
    setTask('supplement')
    setAssistantView('chat')
  }, [isAuthenticated, navigationReady, promptLogin])

  useEffect(() => {
    if (!navigationReady || !navigationScope) return
    try {
      localStorage.setItem(getTranslationNavigationStorageKey(navigationScope), JSON.stringify({ task, view: assistantView }))
    } catch {
      // Navigation still works for this visit if browser storage is unavailable.
    }
  }, [assistantView, navigationReady, navigationScope, task])

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
    if (!isAuthenticated) {
      setGroups([])
      setPreferencesReady(true)
      return
    }

    let cancelled = false
    setPreferencesReady(false)
    fetch('/api/review-groups')
      .then((response) => response.json())
      .then((groupResult) => {
        if (!cancelled && groupResult?.success && Array.isArray(groupResult.data)) {
          setGroups(groupResult.data)
        }
      })
      .catch(() => {})

    fetch('/api/preferences')
      .then((response) => response.json())
      .catch(() => null)
      .then((preferenceResult) => {
      if (cancelled) return
      if (preferenceResult?.success && typeof preferenceResult.data?.autoSaveWords === 'boolean') {
        setAutoSaveWords(preferenceResult.data.autoSaveWords)
        setSoundEffectsEnabled(preferenceResult.data.soundEffectsEnabled ?? true)
        setPreferencesLoadError(false)
      } else {
        setAutoSaveWords(true)
        setSoundEffectsEnabled(true)
        setPreferencesLoadError(true)
      }
      setPreferencesReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, status, userId])

  const tabClass = (active: boolean) =>
    `${styles.taskTab} ${active ? styles.activeTab : ''}`

  const selectedMode: TranslationMode = task === 'realtime' ? 'realtime' : assistantView
  const modeAtPointer = (clientX: number, bounds: { left: number; width: number }) => {
    const position = Math.max(0, Math.min(0.9999, (clientX - bounds.left) / bounds.width))
    return translationModes[Math.floor(position * translationModes.length)].value
  }
  const lineShiftAtPointer = (clientX: number, bounds: { left: number; width: number }) => {
    const offset = Math.max(1, Math.min(81, ((clientX - bounds.left) / bounds.width) * 100 - 9))
    return ((offset - 1) / 18) * 100
  }

  const carryToRealtime = (word: string) => {
    const value = word.trim()
    if (!value) return
    realtimeWordRequestId.current += 1
    setPendingRealtimeWord({ word: value, requestId: realtimeWordRequestId.current })
    setTask('realtime')
  }

  const selectMode = (nextMode: TranslationMode) => {
    if (nextMode === 'chat') {
      if (!isAuthenticated) {
        promptLogin('聊天室')
        return
      }
      setHasOpenedSupplement(true)
      setTask('supplement')
      setAssistantView('chat')
      return
    }
    if (nextMode === 'realtime') {
      setTask('realtime')
      return
    }
    if (nextMode === 'text' && !isAuthenticated) {
      promptLogin('文本翻译')
      return
    }
    if (nextMode === 'ai' && !isAuthenticated) {
      promptLogin('AI询问')
      return
    }
    setHasOpenedSupplement(true)
    setTask('supplement')
    setAssistantView(nextMode)
  }

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
      <header className={styles.translationHeader}>
        <div className={styles.translationHeading}>
          <button
            type="button"
            className={styles.navigationLine}
            disabled={!navigationReady}
            aria-label={`滑动或点击导航线选择翻译功能；当前为${translationModes.find((mode) => mode.value === selectedMode)?.label}`}
            data-mode={selectedMode}
            onPointerDown={handleLinePointerDown}
            onPointerMove={handleLinePointerMove}
            onPointerUp={handleLinePointerUp}
            onPointerCancel={(event) => handleLinePointerUp(event, true)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const currentIndex = translationModes.findIndex((mode) => mode.value === selectedMode)
              const offset = event.key === 'ArrowRight' ? 1 : -1
              const nextIndex = (currentIndex + offset + translationModes.length) % translationModes.length
              selectMode(translationModes[nextIndex].value)
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
              {translationModes.map(({ value, label }) => {
                const active = selectedMode === value
                return (
                  <button key={value} type="button" disabled={!navigationReady} aria-pressed={active} className={tabClass(active)} onClick={() => selectMode(value)}>
                    {label}{active && <motion.span aria-hidden className={styles.tabIndicator} layoutId={reducedMotion ? undefined : indicatorId} initial={false} transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <main ref={mainRef} className={`min-h-0 flex-1 overflow-y-auto ${styles.canvas}`}>
        {!navigationReady ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />正在恢复翻译界面…
          </div>
        ) : (
          <>
        <section className={task === 'realtime' ? styles.taskPanel : 'hidden'} aria-label="实时翻译">
          <div className={styles.translationPage}>
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
                  pendingRealtimeWord={pendingRealtimeWord}
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
        </section>

        {hasOpenedSupplement && (
          <section className={task === 'supplement' ? `${assistantFullHeight ? styles.fillPanel : 'min-h-full'} ${styles.taskPanel}` : 'hidden'} aria-label="中译英、译句子、AI 助手与聊天室">
            <div className={`${styles.translationPage} ${assistantFullHeight ? styles.assistantPage : ''}`}>
              {assistantView === 'chat' ? (
                <ChatRoom />
              ) : (
                <ZhEnAssistant key={navigationScope} view={assistantView} onViewChange={setAssistantView} onCarryToRealtime={carryToRealtime} groups={groupOptions} />
              )}
            </div>
          </section>
        )}
          </>
        )}
      </main>
      <LoginPromptDialog />
    </div>
  )
}
