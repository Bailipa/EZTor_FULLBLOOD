'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type AudioHTMLAttributes } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useInputDraft } from '@/hooks/useInputDraft'
import { studyRequest, StudyRequestError } from './client'
import type { StudyLevel } from './domain'
import { examMinutes } from './examDomain'
import { isCurrentPaper } from './paperAvailability'
import { ExamClock, ExamClockReadout } from './ExamClock'
import { EXAM_MODE_LABELS } from './examTypes'
import type { ExamAction, ExamDraft, ExamMode, ExamPaperMetadata, ExamSessionView, ExamStage, ReadingMark } from './examTypes'
import ReadingPassage from './ReadingPassage'
import type { ReadingMarkSource } from './readingMarkTypes'
import ExamDivider from './ExamDivider'
import ExamPaperPicker from './ExamPaperPicker'
import PracticeTimer from './PracticeTimer'
import ExamAnalysisPanel from './ExamAnalysisPanel'
import { sameExamDraft, canFlushExamDraft } from './examDraft'
import { examAudioProgressKey, restorableAudioPosition } from './examAudioProgress'
import styles from './exam.module.css'
import inputStyles from './study-input.module.css'

const WorkGrade = dynamic(() => import('./WorkGrade'), { loading: () => <p className={styles.note}>正在读取评分…</p> })
const ReadingHelp = dynamic(() => import('./ReadingHelp'), { loading: () => <p role="status">正在打开阅读助手…</p> })
const STAGES: ExamStage[] = ['WRITING', 'LISTENING', 'READING', 'TRANSLATION']
const LABEL: Record<ExamStage, string> = { WRITING: '写作', LISTENING: '听力', READING: '阅读', TRANSLATION: '翻译' }
const LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
type Props = { accountId: string; level: StudyLevel; mode: ExamMode; initialSession?: ExamSessionView; onInteraction?: () => void; readingSource?: ReadingMarkSource; onSessionSwitch?: (session: ExamSessionView) => void; onClose?: () => void }
type LocalDraft = ExamDraft & { revision: number }
type Page<T> = { items: T[]; nextCursor: string | null }
type EventResult = { session: ExamSessionView; receipt: unknown }
type ExamAudioProps = AudioHTMLAttributes<HTMLAudioElement> & {
  audioId: string
  onAttach: (audioId: string, node: HTMLAudioElement) => void
  onDetach: (audioId: string) => void
}

function storageKey(accountId: string, mode: ExamMode) { return `study-exam:${accountId}:${mode}` }
function freshDraft(session: ExamSessionView, stage: ExamStage): ExamDraft {
  return session.drafts[stage] ?? { answers: {}, text: '' }
}
function reuseReadingMarks(previous: ReadingMark[] | undefined, next: ReadingMark[] | undefined) {
  return previous && next && previous.length === next.length && previous.every((mark, index) => {
    const other = next[index]
    return mark.passageId === other.passageId && mark.start === other.start && mark.end === other.end && mark.text === other.text
  }) ? previous : next
}

function ExamAudio({ audioId, onAttach, onDetach, ...audioProps }: ExamAudioProps) {
  const refActions = useRef({ onAttach, onDetach })
  useEffect(() => { refActions.current = { onAttach, onDetach } }, [onAttach, onDetach])
  const setRef = useCallback((node: HTMLAudioElement | null) => {
    if (node) refActions.current.onAttach(audioId, node)
    else refActions.current.onDetach(audioId)
  }, [audioId])

  return <div className={styles.audio}><audio ref={setRef} {...audioProps} aria-label="听力音频" /></div>
}
const localDraftCodec = {
  encode: (draft: LocalDraft) => draft.text || Object.keys(draft.answers).length ? JSON.stringify(draft) : null,
  decode: (raw: string): LocalDraft => {
    try {
      const value = JSON.parse(raw) as Partial<LocalDraft>
      if (typeof value.text === 'string' && value.answers && typeof value.answers === 'object' && Number.isInteger(value.revision))
        return { text: value.text.slice(0, 20000), answers: value.answers, revision: value.revision as number }
    } catch { /* Ignore invalid local drafts. */ }
    return { text: '', answers: {}, revision: 0 }
  },
  isEmpty: (draft: LocalDraft) => !draft.text && !Object.keys(draft.answers).length,
}

export default function StudyExam({ accountId, level, mode, initialSession, onInteraction, readingSource, onSessionSwitch }: Props) {
  const [papers, setPapers] = useState<ExamPaperMetadata[] | null>(null)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [switchPapers, setSwitchPapers] = useState<ExamPaperMetadata[] | null>(null)
  const [switchLoading, setSwitchLoading] = useState(false)
  const switching = useRef(false)
  const [session, setSession] = useState<ExamSessionView | null>(initialSession ?? null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [timingSavedId, setTimingSavedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [clockOffset, setClockOffset] = useState(0)
  const [audioError, setAudioError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [passageId, setPassageId] = useState(readingSource?.passageId ?? '')
  const [questionId, setQuestionId] = useState(readingSource?.questionId ?? '')
  const [wordBankQuestionId, setWordBankQuestionId] = useState<string | null>(null)
  const [wordBankNotice, setWordBankNotice] = useState<{ questionId: string; text: string } | null>(null)
  const passagePane = useRef<HTMLDivElement>(null)
  const answerPane = useRef<HTMLDivElement>(null)
  const [help, setHelp] = useState<{ mark: ReadingMark; mode: 'translate' | 'ask' } | null>(null)
  const alive = useRef(true)
  const pending = useRef<ExamAction | null>(null)
  const sending = useRef(false)
  const serverOffset = useRef(0)
  const audioRefs = useRef(new Map<string, HTMLAudioElement>())
  const programmaticPlay = useRef(new Set<string>())
  const audioPosition = useRef(new Map<string, number>())
  const audioLastSavedAt = useRef(new Map<string, number>())
  const restoringAudioSeek = useRef(new Set<string>())
  const adjustmentLogged = useRef(new Set<string>())
  const queuedAudio = useRef<ExamAction[]>([])
  const postActionRef = useRef<(action?: ExamAction) => Promise<boolean | void>>(async () => {})
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composing = useRef(false)
  const loadingPapers = useRef(false)
  const startOperation = useRef<{ paperId: string; clientId: string } | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const readingReview = !!readingSource && session?.status !== 'READING'
  const readingReviewRef = useRef(readingReview)
  readingReviewRef.current = readingReview
  const stage = readingReview ? 'READING' : session?.status !== 'COMPLETE' ? session?.status : undefined
  const [localDraft, setDraft, draftKey] = useInputDraft<LocalDraft>(
    `${readingReview ? 'cet-review' : 'cet-exam'}:${session?.id ?? `pending:${mode}`}:${stage ?? 'complete'}`,
    () => ({ ...(session && stage ? freshDraft(session, stage) : { text: '', answers: {} }), revision: session?.revision ?? 0 }),
    localDraftCodec,
  )
  const draft = useMemo(() => readingReview && session ? { ...freshDraft(session, 'READING'), revision: session.revision } : localDraft, [readingReview, session, localDraft])
  const draftRef = useRef(draft)
  draftRef.current = draft
  const serverDraft = session && stage ? freshDraft(session, stage) : null
  const hasConflict = !readingReview && !!session && !!stage && draft.revision !== session.revision && !!serverDraft && !sameExamDraft(draft, serverDraft)
  const liveDraftRef = useRef({ session, draft, savedDraft: serverDraft, stage })
  liveDraftRef.current = { session, draft, savedDraft: serverDraft, stage }
  const saveAudioProgress = useCallback((audioId: string, audio?: HTMLAudioElement, force = true) => {
    const currentSession = sessionRef.current
    const player = audio ?? audioRefs.current.get(audioId)
    if (!currentSession || !player || player.src === '') return
    const currentTime = player.currentTime
    if (!Number.isFinite(currentTime) || currentTime < 0) return
    const now = Date.now()
    const previousSave = audioLastSavedAt.current.get(audioId) ?? 0
    if (!force && now - previousSave < 10_000) return
    audioLastSavedAt.current.set(audioId, now)
    try {
      localStorage.setItem(examAudioProgressKey(accountId, currentSession.id, audioId), String(currentTime))
    } catch { /* Local playback recovery is optional. */ }
  }, [accountId])
  const saveAllAudioProgress = useCallback(() => {
    audioRefs.current.forEach((audio, audioId) => saveAudioProgress(audioId, audio))
  }, [saveAudioProgress])
  const flushExamDraft = useRef<() => void>(() => {})
  flushExamDraft.current = () => {
    const live = liveDraftRef.current
    if (switching.current || readingReview || !live.session || !live.stage || !live.savedDraft || sending.current || (pending.current && pending.current.type !== 'DRAFT')) return
    if (!canFlushExamDraft(live.draft, live.savedDraft, live.session.revision)) return
    const payload: ExamAction = pending.current?.type === 'DRAFT' ? pending.current : {
      clientId: crypto.randomUUID(), revision: live.draft.revision, type: 'DRAFT', stage: live.stage,
      ...(live.stage === 'WRITING' || live.stage === 'TRANSLATION' ? { text: live.draft.text } : { answers: live.draft.answers }),
    }
    void studyRequest(accountId, `/api/study/exams/attempts/${live.session.id}/events`, { method: 'POST', keepalive: true, body: JSON.stringify(payload) }).catch(() => { /* The account-scoped local draft remains available after interruption. */ })
  }
  useEffect(() => {
    const flush = () => { flushExamDraft.current(); saveAllAudioProgress() }
    window.addEventListener('pagehide', flush)
    return () => { flush(); window.removeEventListener('pagehide', flush) }
  }, [saveAllAudioProgress])

  const acceptSession = useCallback((next: ExamSessionView) => {
    const previous = sessionRef.current
    const accepted = previous?.id === next.id ? { ...next,
      readingMarks: reuseReadingMarks(previous.readingMarks, next.readingMarks),
      readingHighlights: reuseReadingMarks(previous.readingHighlights, next.readingHighlights),
    } : next
    sessionRef.current = accepted
    setSession(accepted)
    serverOffset.current = Date.parse(next.serverNow) - Date.now()
    setClockOffset(serverOffset.current)
    try { if (!readingReviewRef.current) localStorage.setItem(storageKey(accountId, mode), next.id) } catch { /* Storage is optional. */ }
  }, [accountId, mode])

  useEffect(() => {
    if (!session || !stage || !serverDraft) return
    if (draft.revision !== session.revision && sameExamDraft(draft, serverDraft))
      setDraft((current) => ({ ...current, revision: session.revision }))
  }, [session, stage, serverDraft, draft, setDraft])

  const loadPapers = useCallback(async (targetLevel?: 'ALL' | StudyLevel) => {
    if (loadingPapers.current) return
    loadingPapers.current = true
    if (targetLevel) setSwitchLoading(true)
    setBusy(true)
    setError('')
    try {
      const query = new URLSearchParams({ mode })
      if (targetLevel !== 'ALL') query.set('level', targetLevel ?? level)
      const items: ExamPaperMetadata[] = []
      let cursor: string | null = null
      do {
        if (cursor) query.set('cursor', cursor)
        const result = await studyRequest<Page<ExamPaperMetadata>>(accountId, `/api/study/exams?${query}`)
        if (!alive.current) return
        items.push(...result.items)
        cursor = result.nextCursor
      } while (cursor)
      if (targetLevel) setSwitchPapers(items)
      else setPapers(items)
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '模拟材料暂不可用') }
    finally { loadingPapers.current = false; if (alive.current) { setBusy(false); if (targetLevel) setSwitchLoading(false) } }
  }, [accountId, level, mode])

  useEffect(() => {
    alive.current = true
    let cancelled = false
    if (initialSession) { acceptSession(initialSession); return () => { alive.current = false; if (draftTimer.current) clearTimeout(draftTimer.current) } }
    void (async () => {
      try {
        const id = localStorage.getItem(storageKey(accountId, mode))
        if (id) {
          const restored = await studyRequest<ExamSessionView>(accountId, `/api/study/exams/attempts/${encodeURIComponent(id)}`)
          if (!cancelled && isCurrentPaper(restored.paper.slug) && restored.mode === mode && restored.paper.level === level) {
            acceptSession(restored)
            return
          }
        }
      } catch { /* A missing or expired attempt falls through to the paper list. */ }
      if (!cancelled) await loadPapers()
    })()
    return () => {
      cancelled = true
      alive.current = false
      saveAllAudioProgress()
      if (draftTimer.current) clearTimeout(draftTimer.current)
    }
  }, [accountId, level, mode, initialSession, acceptSession, loadPapers, saveAllAudioProgress])

  const postAction = useCallback(async (action?: ExamAction) => {
    const currentSession = sessionRef.current
    if (sending.current) { if (action?.type === 'AUDIO_PLAY' && queuedAudio.current.length < 12) queuedAudio.current.push(action); return }
    if (!currentSession || (readingReview && (pending.current ?? action)?.type !== 'READING_HIGHLIGHT')) return
    if (pending.current && action?.type === 'READING_HELP' && pending.current.clientId !== action.clientId) return false
    if (pending.current && action?.type === 'AUDIO_PLAY' && queuedAudio.current.length < 12) { queuedAudio.current.push(action); return }
    const payload = pending.current ?? action
    if (!payload) return
    pending.current = payload
    sending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    setConflict(false)
    try {
      const result = await studyRequest<EventResult>(accountId, `/api/study/exams/attempts/${currentSession.id}/events`, { method: 'POST', body: JSON.stringify(payload) })
      if (!alive.current) return
      pending.current = null
      acceptSession(result.session)
      if (payload.type === 'DRAFT' || payload.type === 'AUDIO_PLAY' || payload.type === 'READING_MARK' || payload.type === 'READING_HIGHLIGHT' || payload.type === 'READING_HELP') setDraft((current) => ({ ...current, revision: result.session.revision }))
      if (payload.type === 'AUDIO_PLAY') {
        const audio = audioRefs.current.get(payload.audioId)
        if (audio) {
          programmaticPlay.current.add(payload.audioId)
          void audio.play().catch(() => { programmaticPlay.current.delete(payload.audioId); setAudioError('播放记录已保存，请再次点击播放继续收听。') })
        }
      }
      if (payload.type === 'SUBMIT_STAGE' && draftKey) { try { localStorage.removeItem(draftKey) } catch { /* Storage is optional. */ } }
      onInteraction?.()
      return true
    } catch (failure) {
      if (alive.current) {
        setConflict(failure instanceof StudyRequestError && failure.status === 409)
        setError(failure instanceof StudyRequestError && failure.status === 409 ? '另一处页面已更新这份模拟，请同步后再继续。' : failure instanceof Error ? failure.message : '没有保存，请重试原操作')
      }
      return false
    }
    finally {
      sending.current = false
      if (alive.current) setBusy(false)
      if (alive.current && !pending.current && queuedAudio.current.length) {
        const queued = queuedAudio.current.shift()!
        const latest = sessionRef.current
        if (latest?.status === 'LISTENING') window.setTimeout(() => void postActionRef.current({ ...queued, revision: sessionRef.current?.revision ?? queued.revision }), 0)
        else setNotice('阶段已推进，尚未记录的额外音频操作已停止。')
      }
    }
  }, [accountId, acceptSession, draftKey, onInteraction, setDraft, readingReview])
  postActionRef.current = postAction

  const syncConflict = async () => {
    if (!session || busy) return
    const previous = pending.current
    setBusy(true)
    try {
      const currentSession = sessionRef.current
      if (!currentSession) return
      const latest = readingReview && readingSource
        ? (await studyRequest<ReadingMarkSource>(accountId, `/api/study/marks?${new URLSearchParams({ attemptId: currentSession.id, passageId: readingSource.passageId, start: String(readingSource.start), end: String(readingSource.end) })}`)).session
        : await studyRequest<ExamSessionView>(accountId, `/api/study/exams/attempts/${currentSession.id}`)
      if (!alive.current) return
      pending.current = null
      acceptSession(latest)
      const latestStage = latest.status === 'COMPLETE' ? null : latest.status
      const latestDraft = latestStage ? freshDraft(latest, latestStage) : null
      const previousStage = previous?.stage ?? session.status
      if (latestStage === previousStage && latestDraft && sameExamDraft(draftRef.current, latestDraft))
        setDraft({ ...draftRef.current, revision: latest.revision })
      setConflict(false)
      setError('')
      setNotice(readingReview ? '荧光标记状态已同步，可以再次点按。' : latestStage === previousStage ? '服务器进度已恢复。若本机草稿与服务器不同，请选择保留哪一份。' : '阶段已在另一处页面推进，已恢复最新服务器进度。未提交的本机草稿仍保存在本机。')
    } catch (failure) { setError(failure instanceof Error ? failure.message : '同步失败，请重试') }
    finally { if (alive.current) setBusy(false) }
  }

  const start = async (paperId: string) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    if (startOperation.current?.paperId !== paperId) startOperation.current = { paperId, clientId: crypto.randomUUID() }
    try {
      const next = await studyRequest<ExamSessionView>(accountId, '/api/study/exams', { method: 'POST', body: JSON.stringify({ paperId, mode, clientId: startOperation.current.clientId }) })
      if (alive.current) { startOperation.current = null; resetAudioSessionState(); acceptSession(next); onInteraction?.() }
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '试卷未能打开，请重试') }
    finally { if (alive.current) setBusy(false) }
  }

  const switchPaper = async (paperId: string) => {
    if (!onSessionSwitch || busy || sending.current || loadingPapers.current || switching.current || conflict || hasConflict || paperId === sessionRef.current?.paper.id) return
    switching.current = true
    if (draftTimer.current) clearTimeout(draftTimer.current)
    const local = draftRef.current
    const previousStage = sessionRef.current?.status
    let switched = false
    try {
      if (pending.current && !(await postAction())) return
      const current = sessionRef.current
      if (!readingReview && current && current.status !== 'COMPLETE') {
        if (current.status !== previousStage) { setError('阶段已更新，请关闭切换窗口并确认当前进度。'); return }
        if (!sameExamDraft(local, freshDraft(current, current.status))) {
          const saved = await postAction({ clientId: crypto.randomUUID(), revision: current.revision, type: 'DRAFT', stage: current.status, ...(current.status === 'WRITING' || current.status === 'TRANSLATION' ? { text: local.text } : { answers: local.answers }) })
          if (!saved) return
        }
      }
      if (!alive.current) return
      setBusy(true); setError('')
      if (startOperation.current?.paperId !== paperId) startOperation.current = { paperId, clientId: crypto.randomUUID() }
      const next = await studyRequest<ExamSessionView>(accountId, '/api/study/exams', { method: 'POST', body: JSON.stringify({ paperId, mode, clientId: startOperation.current.clientId }) })
      if (!alive.current) return
      saveAllAudioProgress()
      resetAudioSessionState()
      startOperation.current = null
      try { localStorage.setItem(storageKey(accountId, mode), next.id) } catch { /* Storage is optional. */ }
      liveDraftRef.current = { ...liveDraftRef.current, session: null }
      onSessionSwitch(next)
      switched = true
      onInteraction?.()
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '切换失败，当前进度已保留，请重试') }
    finally { if (alive.current && !switched) { switching.current = false; setBusy(false) } }
  }

  const openSwitch = () => {
    saveAllAudioProgress()
    audioRefs.current.forEach((audio) => audio.pause())
    setSwitchPapers(null)
    setSwitchOpen(true)
    void loadPapers('ALL')
  }

  const updateDraft = (next: ExamDraft) => {
    const current = sessionRef.current
    if (readingReview || !current || current.status === 'COMPLETE') return
    if (current.status === 'WRITING' || current.status === 'TRANSLATION') next = { text: next.text.slice(0, 20000), answers: {} }
    else next = { answers: next.answers, text: '' }
    setDraft({ ...next, revision: current.revision })
    if (draftTimer.current) clearTimeout(draftTimer.current)
    if (composing.current) return
    const stage = current.status
    const save = () => {
      const live = sessionRef.current
      if (!alive.current || !live || live.status !== stage) return
      if (sending.current) { draftTimer.current = setTimeout(save, 650); return }
      if (pending.current) return
      void postAction({ clientId: crypto.randomUUID(), revision: live.revision, type: 'DRAFT', stage, ...(stage === 'WRITING' || stage === 'TRANSLATION' ? { text: next.text } : { answers: next.answers }) })
    }
    // Choice changes must be recorded individually, before a second answer can replace them.
    if (stage === 'LISTENING' || stage === 'READING') save()
    else draftTimer.current = setTimeout(save, 650)
  }

  const stageStarted = session?.stageStartedAt ? Date.parse(session.stageStartedAt) : 0
  const deadline = !readingReview && session?.deadlineAt ? Date.parse(session.deadlineAt) : null
  const sessionId = session?.id
  const syncExpiredStage = async () => {
    if (readingReview || !sessionId || !stage) return
    try {
      const latest = await studyRequest<ExamSessionView>(accountId, `/api/study/exams/attempts/${sessionId}`)
      if (!alive.current) return
      acceptSession(latest)
      if (latest.status !== stage) setNotice('阶段时间已到，已按服务器进度切换。尚未提交的本机草稿不会作为答案提交。')
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : '计时结束，无法同步阶段进度，请重试')
    }
  }

  const logAudioPlay = (audioId: string) => {
    if (programmaticPlay.current.has(audioId)) { programmaticPlay.current.delete(audioId); return }
    const player = audioRefs.current.get(audioId)
    player?.pause()
    const current = sessionRef.current
    if (!current || current.status !== 'LISTENING' || !current.stageContent?.audio.some((item) => item.id === audioId)) return
    const action: ExamAction = { clientId: crypto.randomUUID(), revision: current.revision, type: 'AUDIO_PLAY', stage: 'LISTENING', audioId }
    void postAction(action)
  }

  const markAudioAdjustment = (audioId: string) => {
    if (adjustmentLogged.current.has(audioId)) return
    adjustmentLogged.current.add(audioId)
    logAudioPlay(audioId)
  }

  const resetAudioSessionState = () => {
    audioRefs.current.forEach((audio) => audio.pause())
    audioRefs.current.clear()
    programmaticPlay.current.clear()
    audioPosition.current.clear()
    audioLastSavedAt.current.clear()
    restoringAudioSeek.current.clear()
    adjustmentLogged.current.clear()
    queuedAudio.current = []
    setAudioError('')
  }

  const submitStage = () => {
    if (!session || !stage || busy || error || hasConflict) return
    if (draftTimer.current) clearTimeout(draftTimer.current)
    const payload = stage === 'WRITING' || stage === 'TRANSLATION' ? { text: draft.text } : { answers: draft.answers }
    void postAction({ clientId: crypto.randomUUID(), revision: session.revision, type: 'SUBMIT_STAGE', stage, ...payload })
  }

  const useServerDraft = () => {
    if (!session || !stage || !serverDraft) return
    setDraft({ ...serverDraft, revision: session.revision })
    setError(''); setConflict(false)
  }
  const keepLocalDraft = () => {
    if (!session || !stage) return
    const local = draftRef.current
    setDraft({ ...local, revision: session.revision })
    setError(''); setConflict(false)
    const payload = stage === 'WRITING' || stage === 'TRANSLATION' ? { text: local.text } : { answers: local.answers }
    void postAction({ clientId: crypto.randomUUID(), revision: session.revision, type: 'DRAFT', stage, ...payload })
  }

  const modeLabel = EXAM_MODE_LABELS[mode]
  const timingNote = mode === 'FULL' ? `标准时长 ${STAGES.reduce((total, name) => total + examMinutes(level, name), 0)} 分钟，刷新不会暂停。` : `不限时 · ${LABEL[mode]}参考时长 ${examMinutes(level, mode)} 分钟`
  const switchBusy = busy || switchLoading
  const switchDialog = <Dialog open={switchOpen} onOpenChange={(open) => { if (!switchBusy && !switching.current) setSwitchOpen(open) }}>
    <DialogContent className={styles.switchDialog} showCloseButton={!switchBusy} onEscapeKeyDown={(event) => { if (switchBusy) event.preventDefault() }} onPointerDownOutside={(event) => { if (switchBusy) event.preventDefault() }}>
      <DialogTitle>切换试卷</DialogTitle>
      <DialogDescription>可在四级、六级之间切换，当前练习模式为{modeLabel}。先保存当前作答，再打开所选试卷。未完成的试卷会恢复原进度。{mode === 'FULL' && '整卷模拟切走后仍会继续计时。'}</DialogDescription>
      <p className={styles.note}>当前：{session?.paper.title}</p>
      {error && <div className={styles.error} role="alert">{error}{switchPapers === null && <Button variant="outline" disabled={switchBusy} onClick={() => void loadPapers('ALL')}>重新加载</Button>}</div>}
      {switchPapers === null && !error && <p role="status">正在读取试卷…</p>}
      {switchPapers !== null && <ExamPaperPicker papers={switchPapers} currentPaperId={session?.paper.id} busy={switchBusy} blocked={conflict || hasConflict} actionLabel="保存并切换" busyLabel="正在保存并切换…" onConfirm={(id) => void switchPaper(id)} onCancel={() => setSwitchOpen(false)} />}
      {switchPapers === null && <Button variant="outline" disabled={switchBusy} onClick={() => setSwitchOpen(false)}>继续当前试卷</Button>}
    </DialogContent>
  </Dialog>

  if (!session) return <section className={styles.panel} aria-label={modeLabel}>
    <div className={styles.header}><div><span className={styles.eyebrow}>{level === 'CET4' ? '四级' : '六级'} · {modeLabel}</span><h3>选择试卷</h3></div></div>
    {error && <div className={styles.error} role="alert">{error}<button disabled={busy} onClick={() => startOperation.current ? void start(startOperation.current.paperId) : void loadPapers()}>重试</button></div>}
    {papers === null && !error && <p role="status" className={styles.note}>正在读取材料…</p>}
    {papers?.length === 0 && <div className={styles.empty}><strong>暂时没有试卷可用</strong></div>}
    {!!papers?.length && <>
      <p className={styles.note}>{timingNote}</p>
      <ExamPaperPicker papers={papers!} busy={busy} actionLabel={`开始${modeLabel}`} busyLabel="正在打开…" onConfirm={(id) => void start(id)} />
    </>}
  </section>

  if (session.status === 'COMPLETE' && !readingReview) {
    const result = session.result
    return <section className={styles.panel} aria-label="模拟完成">
      <div className={styles.header}><div><span className={styles.eyebrow}>{session.paper.title} · 已完成</span><h3>本次{modeLabel}已提交</h3></div></div>
      <PracticeTimer accountId={accountId} session={session} onSaved={() => setTimingSavedId(session.id)} />
      <ExamAnalysisPanel key={session.id} accountId={accountId} attemptId={session.id} completedEligible timingReady={!!session.practiceTiming || timingSavedId === session.id} />
      {!!result?.objective.total && <div className={styles.score}><strong>{result?.objective.earnedWeight ?? 0}</strong><span>/ {result?.objective.totalWeight ?? 0} 客观题加权得分</span><span>{result?.objective.correct ?? 0}/{result?.objective.total ?? 0} 题正确</span>{result?.objective.firstAnswered !== undefined && <span>首次作答 {result.objective.firstCorrect}/{result.objective.firstAnswered} 正确</span>}</div>}
      {!!result?.objective.ungraded && <p className={styles.note}>有 {result.objective.ungraded} 题缺少已核对答案或对应录音，未计入得分；作答已保存。</p>}
      {!!result?.objective.limitations?.length && <p className={styles.note}>本卷材料说明：{result.objective.limitations.join(' ')}</p>}
      <p className={styles.note}>{result?.subjectiveSubmissions.length ? '答案已保存，可在下方获取AI估分。' : '作答结果已保存。'}</p>
      <div className={styles.actions}><Button variant="outline" onClick={() => { try { localStorage.removeItem(storageKey(accountId, mode)) } catch { /* Storage is optional. */ }; resetAudioSessionState(); pending.current = null; setSession(null); setPapers(null); void loadPapers() }}>再做一份</Button></div>
      {result?.feedback.map((item) => <details className={styles.feedback} key={item.questionId}><summary>题目解析 · {item.choice === null ? '未作答' : `选择 ${LETTERS[item.choice]}`}</summary><p>{item.answerIndex < 0 ? '本题暂不计分' : `正确答案：${LETTERS[item.answerIndex]}`}</p><p>{item.explanation}</p></details>)}
      {result?.transcripts.map((item) => <details className={styles.feedback} key={item.id}><summary>听力原文</summary><p>{item.transcript}</p></details>)}
      {result?.referenceTranslation && <details className={styles.feedback}><summary>参考译文</summary><p>{result.referenceTranslation}</p></details>}
      {!!session.readingMarks?.length && <details className={styles.feedback}><summary>我的阅读标记 · {session.readingMarks.length} 处</summary>{session.readingMarks.map((mark) => <blockquote className={styles.selectedText} key={`${mark.passageId}:${mark.start}:${mark.end}`}>{mark.text}</blockquote>)}</details>}
      {result?.subjectiveSubmissions.map((work) => <div className={styles.work} key={`${session.id}:${work.kind}:${work.revision}`}><h4>{work.kind === 'WRITING' ? '写作提交' : '翻译提交'}</h4><p className={styles.note}>{work.prompt}</p><div className={styles.submission}>{work.text}</div><WorkGrade accountId={accountId} source="EXAM" id={session.id} kind={work.kind} revision={work.revision} /></div>)}
    </section>
  }

  const content = readingReview ? readingSource?.readingContent : session.stageContent
  if (!content || !stage) return <section className={styles.panel}><div className={styles.error} role="alert">当前阶段内容暂不可用<button onClick={() => void syncConflict()}>恢复服务器进度</button></div></section>
  const activePassage = content.passages.find((p) => p.id === passageId) ?? content.passages[0]
  const passageQuestions = content.questions.filter((q) => q.passageId === activePassage?.id)
  const questionIndex = Math.max(0, passageQuestions.findIndex((q) => q.id === questionId))
  const currentQuestion = passageQuestions[questionIndex]
  const subjective = stage === 'WRITING' || stage === 'TRANSLATION'
  const questionFields = content.questions.map((question, index) => {
    if (stage === 'READING' && question.passageId !== activePassage?.id) return null
    const className = `${styles.question} ${stage === 'READING' && question.id !== currentQuestion?.id ? styles.inactiveQuestion : ''} ${question.type === 'WORD_BANK' ? styles.wordBankQuestion : ''}`
    if (question.type === 'WORD_BANK') {
      const selected = draft.answers[question.id]
      const pickerOpen = wordBankQuestionId === question.id
      const bankQuestions = content.questions.filter((item) => item.type === 'WORD_BANK')
      const usedIn = (choiceIndex: number) => bankQuestions.filter((item) => draft.answers[item.id] === choiceIndex)
      return <fieldset className={className} key={question.id} disabled={busy || !!error || hasConflict}>
        <legend><span>{index + 1}.</span> {question.prompt}</legend>
        <button type="button" className={styles.wordBankTrigger} aria-expanded={pickerOpen} onClick={() => {
          setWordBankQuestionId(pickerOpen ? null : question.id)
          setWordBankNotice(null)
        }}>{selected === undefined ? readingReview ? '点击查看选项' : '点击选择选项' : `${LETTERS[selected]}. ${question.choices[selected]}`}</button>
        <Dialog open={pickerOpen} onOpenChange={(open) => { if (!open) setWordBankQuestionId(null) }}>
          <DialogContent className={styles.wordBankDialog} overlayClassName={styles.wordBankOverlay}>
            <DialogTitle>选词填空 · 第 {bankQuestions.indexOf(question) + 1} 题</DialogTitle>
            <p className={styles.wordBankPrompt}>{question.prompt}</p>
            <DialogDescription className={styles.wordBankHint}>{readingReview ? '查看选项和已保存的作答。' : '选择一个选项填入本题；已选标记仅作提示，仍可重复使用。'}</DialogDescription>
          <div className={styles.wordBankOptions}>{question.choices.map((choice, choiceIndex) => {
            const useQuestions = usedIn(choiceIndex)
            return <button type="button" key={choiceIndex} className={styles.wordBankOption} aria-pressed={selected === choiceIndex} disabled={readingReview || busy || !!error || hasConflict} onClick={() => {
              const otherUses = useQuestions.filter((item) => item.id !== question.id)
              updateDraft({ answers: { ...draft.answers, [question.id]: choiceIndex }, text: draft.text })
              setWordBankQuestionId(null)
              setWordBankNotice(otherUses.length ? {
                questionId: question.id,
                text: `选项 ${LETTERS[choiceIndex]} 已填入第 ${otherUses.map((item) => bankQuestions.indexOf(item) + 1).join('、')} 题，仍可重复使用。`,
              } : null)
            }}>
              <span>{LETTERS[choiceIndex]}. {choice}</span>
              {useQuestions.length > 0 && <small className={styles.wordBankUsed}>{useQuestions.some((item) => item.id === question.id) ? '本题已选' : '已选'} · 第 {useQuestions.map((item) => bankQuestions.indexOf(item) + 1).join('、')} 题</small>}
            </button>
          })}</div>
          </DialogContent>
        </Dialog>
        {wordBankNotice?.questionId === question.id && <p role="status" className={styles.wordBankNotice}>{wordBankNotice.text}</p>}
      </fieldset>
    }
    return <fieldset className={className} key={question.id} disabled={readingReview || busy || !!error || hasConflict}><legend><span>{index + 1}.</span> {question.prompt}</legend>{question.choices.map((choice, choiceIndex) => <label key={choiceIndex}><input type="radio" name={`${session.id}-${question.id}`} checked={draft.answers[question.id] === choiceIndex} onChange={() => updateDraft({ answers: { ...draft.answers, [question.id]: choiceIndex }, text: draft.text })} /><span>{LETTERS[choiceIndex]}. {choice}</span></label>)}</fieldset>
  })
  const stageActions = !readingReview && <div className={`${styles.actions} ${inputStyles.inputActions}`}><Button disabled={readingReview || busy || !!error || hasConflict} onClick={submitStage}>{busy ? '正在保存…' : mode !== 'FULL' ? `提交${modeLabel}` : stage === 'TRANSLATION' ? '提交整卷' : '保存并进入下一阶段'}</Button><span>阶段已用时 <ExamClockReadout elapsed /></span></div>
  return <section className={`${styles.panel} ${inputStyles.editor} ${stage === 'READING' || subjective ? styles.readingPanel : ''}`} aria-label="考试作答" aria-busy={busy}><ExamClock key={`${sessionId}:${stage}:${deadline}`} deadline={deadline} stageStartedAt={stageStarted} serverOffset={clockOffset} expiryKey={`${sessionId}:${stage}:${deadline}`} onExpire={() => { void syncExpiredStage() }}>
    <div className={`${styles.header} ${styles.stickyHeader}`}><div><span className={styles.eyebrow}>{readingReview ? '阅读回看' : modeLabel} · {LABEL[stage]}</span><h3 title={session.paper.title}>{session.paper.title}</h3></div><div className={styles.headerActions}>{!readingReview && <ExamClockReadout className={styles.clock} />}{onSessionSwitch && <Button variant="outline" size="sm" disabled={busy || !!error || hasConflict} onClick={openSwitch}>切换试卷</Button>}</div></div>
    {!readingReview && <PracticeTimer accountId={accountId} session={session} />}
    {switchDialog}
    {mode === 'FULL' && !readingReview && <nav className={styles.stages} aria-label="考试进度">{STAGES.map((name, index) => <span className={name === stage ? styles.currentStage : ''} key={name}>{index + 1}. {LABEL[name as ExamStage]}</span>)}</nav>}
    <details className={styles.source}><summary>练习说明</summary><p>{readingReview ? '查看已标记的阅读内容，可查词或问 AI。' : timingNote}</p>{stage === 'READING' && <p>{content.instructions}</p>}</details>
    {notice && <p role="status" className={styles.note}>{notice}</p>}
    {content.sourceNotice && <p className={styles.note} role="status">{content.sourceNotice}</p>}
    {[content.unavailableReason, content.audioUnavailableReason, content.wordBankUnavailableReason, content.matchingUnavailableReason].some(Boolean) && <p className={styles.note} role="status">{[content.unavailableReason, content.audioUnavailableReason, content.wordBankUnavailableReason, content.matchingUnavailableReason].filter(Boolean).join(' ')} 可保存作答并继续下一阶段。</p>}
    {content.instructions && stage !== 'READING' && !subjective && <p className={styles.instructions}>{content.instructions}</p>}
    {error && <div className={styles.error} role="alert">{error}<div>{conflict ? <button disabled={busy} onClick={() => void syncConflict()}>恢复服务器进度</button> : <><button disabled={busy} onClick={() => pending.current ? void postAction() : void syncConflict()}>{pending.current ? '重试原操作' : '重新同步进度'}</button><button disabled={busy} onClick={() => void syncConflict()}>恢复服务器进度</button></>}</div></div>}
    {hasConflict && <div className={styles.error} role="alert"><strong>本机草稿与服务器版本不同</strong><p>选择使用已同步进度，或以本机草稿作为新保存覆盖。</p><div><button disabled={busy} onClick={useServerDraft}>使用服务器版本</button><button disabled={busy} onClick={keepLocalDraft}>保留本机草稿并保存</button></div></div>}
    {stage === 'READING' && <nav className={styles.passageTabs} aria-label="阅读篇章">{content.passages.map((passage, index) => {
      const questions = content.questions.filter((q) => q.passageId === passage.id)
      const type = questions[0]?.type
      const label = type === 'WORD_BANK' ? '选词填空' : type === 'MATCHING' ? '长篇匹配' : `仔细阅读 · ${index + 1}`
      return <button key={passage.id} aria-pressed={passage.id === activePassage?.id} onClick={() => { setPassageId(passage.id); setQuestionId(''); setWordBankQuestionId(null); setWordBankNotice(null); passagePane.current?.scrollTo(0, 0); answerPane.current?.scrollTo(0, 0) }}>{label}<small>{questions.filter((q) => draft.answers[q.id] !== undefined).length}/{questions.length}</small></button>
    })}</nav>}
    <div className={stage === 'READING' || subjective ? styles.readingWorkbench : styles.stageBody} data-exam-stage={stage}>
      {stage === 'READING' ? <>
        <div ref={passagePane} className={styles.readingPassages} aria-label="阅读文章">
          <div className={styles.columnHeading}><span>阅读材料</span><small>点词查义 · 长按选段标记</small></div>
          {activePassage && <ReadingPassage key={activePassage.id} passage={activePassage} readOnly={readingReview} focusMark={readingSource?.passageId === activePassage.id ? readingSource : undefined} marks={session.readingMarks ?? []} highlights={session.readingHighlights ?? []} onHighlight={(mark, marked) => postAction({ clientId: crypto.randomUUID(), revision: sessionRef.current?.revision ?? session.revision, stage: 'READING', type: 'READING_HIGHLIGHT', mark, marked })} disabled={busy || !!error || hasConflict} onMark={(mark, marked) => { void postAction({ clientId: crypto.randomUUID(), revision: session.revision, stage: 'READING', type: 'READING_MARK', mark, marked }) }} onHelp={(mark, mode) => setHelp({ mark, mode })} />}
        </div>
        <ExamDivider />
        <div ref={answerPane} className={styles.readingAnswers} aria-label="阅读作答">
          {!!passageQuestions.length && <div className={styles.questionPager} aria-label="题目切换">
            <button disabled={questionIndex === 0} onClick={() => { setQuestionId(passageQuestions[questionIndex - 1].id); setWordBankQuestionId(null); setWordBankNotice(null); answerPane.current?.scrollTo(0, 0) }}>上一题</button>
            <span>{questionIndex + 1}/{passageQuestions.length} 题 · {draft.answers[currentQuestion?.id] === undefined ? '未作答' : '已选择'}</span>
            <button disabled={questionIndex >= passageQuestions.length - 1} onClick={() => { setQuestionId(passageQuestions[questionIndex + 1].id); setWordBankQuestionId(null); setWordBankNotice(null); answerPane.current?.scrollTo(0, 0) }}>下一题</button>
          </div>}
          <div className={styles.columnHeading}><span>当前题目</span><small>{readingReview ? '已保存的作答' : '选择后自动保存'}</small></div>
          {questionFields}
          {stageActions}
        </div>
      </> : subjective ? <>
        <div className={styles.readingPassages} aria-label="题目材料">
          {content.instructions && <p className={styles.instructions}>{content.instructions}</p>}
          {content.passages.map((passage) => <article className={styles.passage} key={passage.id}>{passage.text}</article>)}
          {content.prompt && <div className={styles.prompt}><strong>{stage === 'WRITING' ? '写作要求' : '待翻译内容'}</strong><p>{content.prompt}</p>{content.promptImageUrl && <a href={content.promptImageUrl} target="_blank" rel="noopener noreferrer"><Image className={styles.promptImage} src={content.promptImageUrl} alt="原卷写作题及图表，点击查看大图" width={1273} height={1100} unoptimized /></a>}{stage === 'WRITING' && <small>{content.minimumWords ?? 0}–{content.maximumWords ?? 0} 词</small>}</div>}
        </div>
        <ExamDivider />
        <div className={styles.readingAnswers} aria-label="输入答案">
          <label className={styles.textAnswer}>{stage === 'WRITING' ? '你的作文' : '你的译文'}<textarea maxLength={20000} value={draft.text} onChange={(event) => updateDraft({ ...draft, text: event.currentTarget.value })} onCompositionStart={() => {
            composing.current = true
            if (draftTimer.current) clearTimeout(draftTimer.current)
          }} onCompositionEnd={(event) => {
            composing.current = false
            updateDraft({ ...draftRef.current, text: event.currentTarget.value })
          }} readOnly={(busy && pending.current?.type !== 'DRAFT') || !!error || hasConflict} placeholder="输入答案…" /><span>{draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0} 词 · {busy ? '正在保存…' : '草稿自动保留'}</span></label>
          {stageActions}
        </div>
      </> : <>
        {stage === 'LISTENING' && <>
          {session.assisted && mode === 'FULL' && <p className={styles.assist}>本次有额外播放、回放或音频调整记录，已标记听力辅助。</p>}
          {audioError && <div className={styles.error} role="alert">{audioError}<button onClick={() => { setAudioError(''); audioRefs.current.forEach((audio) => audio.load()) }}>重试音频</button></div>}
          {content.audio.map((audio) => <ExamAudio key={audio.id} audioId={audio.id} onAttach={(audioId, node) => audioRefs.current.set(audioId, node)} onDetach={(audioId) => {
            const previous = audioRefs.current.get(audioId)
            if (previous) saveAudioProgress(audioId, previous)
            audioRefs.current.delete(audioId)
          }} controls preload="metadata" src={audio.url} onLoadedMetadata={(event) => {
            const player = event.currentTarget
            audioPosition.current.set(audio.id, player.currentTime)
            try {
              const position = restorableAudioPosition(localStorage.getItem(examAudioProgressKey(accountId, session.id, audio.id)), player.duration)
              if (position === null || position <= 0) return
              restoringAudioSeek.current.add(audio.id)
              player.currentTime = position
              audioPosition.current.set(audio.id, position)
            } catch { /* Local playback recovery is optional. */ }
          }} onPlay={() => logAudioPlay(audio.id)} onPause={(event) => saveAudioProgress(audio.id, event.currentTarget)} onTimeUpdate={(event) => {
            audioPosition.current.set(audio.id, event.currentTarget.currentTime)
            saveAudioProgress(audio.id, event.currentTarget, false)
          }} onSeeking={(event) => {
            if (restoringAudioSeek.current.delete(audio.id)) { audioPosition.current.set(audio.id, event.currentTarget.currentTime); return }
            if (event.currentTarget.currentTime + 1 < (audioPosition.current.get(audio.id) ?? 0)) markAudioAdjustment(audio.id)
          }} onRateChange={(event) => { if (event.currentTarget.playbackRate !== 1) markAudioAdjustment(audio.id) }} onError={() => setAudioError('音频暂时无法播放，请检查网络后重试。')} />)}
        </>}
        {content.passages.map((passage) => <article className={styles.passage} key={passage.id}>{passage.text}</article>)}
        {questionFields}
        {stageActions}
      </>}
    </div>
    {help && activePassage && <ReadingHelp key={`${session.id}:${help.mark.start}:${help.mode}`} mark={help.mark} mode={help.mode} title={session.paper.title} context={activePassage.text.slice(Math.max(0, help.mark.start - 500), help.mark.end + 500)} onClose={() => setHelp(null)} onPrepare={() => readingReview ? Promise.resolve(true) : postAction({ clientId: crypto.randomUUID(), revision: sessionRef.current?.revision ?? session.revision, stage: 'READING', type: 'READING_HELP', mark: help.mark })} />}
  </ExamClock></section>
}
