'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { studyRequest } from './client'
import type { ExamSessionView, ExamStage } from './examTypes'
import { emptyPracticeTiming, formatPracticeTime, parsePracticeTiming, settlePracticeTiming, TIMING_LABELS, TIMING_STAGES, type LocalPracticeTiming, type PracticeTiming } from './practiceTiming'
import styles from './practice-timer.module.css'

type TimingSnapshot = PracticeTiming & { owner?: string }
// Tab-local fallback survives module and completion-view remounts, but not reloads.
const memorySnapshots = new Map<string, TimingSnapshot>()
const memoryOnlyKeys = new Set<string>()

type Props = { accountId: string; session: ExamSessionView & { practiceTiming?: PracticeTiming | null }; onSaved?: (timing: PracticeTiming) => void }
export default function PracticeTimer(props: Props) {
  return <Timer key={`${props.accountId}:${props.session.id}`} {...props} />
}
function Timer({ accountId, session, onSaved }: Props) {
  const key = `cet-practice-timing:v1:${accountId}:${session.id}`
  const stage: ExamStage | null = session.status === 'COMPLETE' ? null : session.status
  const [clock, setClock] = useState<LocalPracticeTiming>({ ...emptyPracticeTiming(), stage, runningSince: null })
  const ref = useRef(clock)
  const owner = useRef('')
  const ownsCache = useRef(false)
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState<PracticeTiming | null>(session.practiceTiming ?? null)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [retry, setRetry] = useState(0)
  const callback = useRef(onSaved)
  callback.current = onSaved
  const adopt = (value: PracticeTiming) => {
    const paused = { ...value, stage: ref.current.stage, runningSince: null }
    ref.current = paused
    setClock(paused)
  }
  const readSnapshot = (): TimingSnapshot | null => {
    if (memoryOnlyKeys.has(key)) { setStorageError(true); return memorySnapshots.get(key) ?? null }
    try {
      const raw = localStorage.getItem(key)
      const cached = raw ? JSON.parse(raw) : null
      const parsed = parsePracticeTiming(cached)
      if (!parsed) { memorySnapshots.delete(key); return null }
      const snapshot = { ...parsed, owner: typeof cached.owner === 'string' ? cached.owner : undefined }
      memorySnapshots.set(key, snapshot)
      return snapshot
    } catch {
      memoryOnlyKeys.add(key)
      setStorageError(true)
      return memorySnapshots.get(key) ?? null
    }
  }
  const writeSnapshot = (snapshot: TimingSnapshot) => {
    memorySnapshots.set(key, snapshot)
    if (memoryOnlyKeys.has(key)) return
    try { localStorage.setItem(key, JSON.stringify(snapshot)) }
    catch { memoryOnlyKeys.add(key); setStorageError(true) }
  }
  const commit = (value: LocalPracticeTiming, claim = false) => {
    // Only the tab that last started the timer may write. A passive tab must not
    // overwrite another tab's progress when it becomes hidden or unmounts.
    if (claim) ownsCache.current = true
    if (ownsCache.current && !claim) {
      const cached = readSnapshot()
      if (cached?.owner !== owner.current) {
        ownsCache.current = false
        adopt(cached ?? emptyPracticeTiming())
        return
      }
    }
    if (ownsCache.current) writeSnapshot({ ...settlePracticeTiming(value, Date.now()), owner: owner.current })
    ref.current = value
    setClock(value)
  }
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    owner.current = crypto.randomUUID()
    const parsed = readSnapshot()
    if (parsed) { const value = { ...parsed, stage, runningSince: null }; ref.current = value; setClock(value) }
    setReady(true)
    // Account and attempt changes remount this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!ready) return
    const current = ref.current
    if (current.stage !== stage) {
      const transitionAt = Date.parse(session.stageStartedAt)
      const stoppedAt = current.runningSince === null ? Date.now() : Math.max(current.runningSince, Math.min(Date.now(), transitionAt || Date.now()))
      commitRef.current({ ...settlePracticeTiming(current, stoppedAt), stage })
    }
  }, [ready, stage, session.stageStartedAt])

  useEffect(() => {
    if (!ready) return
    const pause = () => commitRef.current(settlePracticeTiming(ref.current, Date.now()))
    const hidden = () => { if (document.visibilityState === 'hidden') pause() }
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== key) return
      ownsCache.current = false
      const cached = readSnapshot()
      if (cached?.owner === owner.current) { ownsCache.current = true; return }
      adopt(cached ?? emptyPracticeTiming())
    }
    const timer = window.setInterval(() => {
      const current = ref.current
      if (current.runningSince !== null) {
        const now = Date.now()
        commitRef.current({ ...settlePracticeTiming(current, now), runningSince: now })
      }
    }, 1000)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', pause)
    window.addEventListener('storage', sync)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('storage', sync)
      // Flush the fractional final second before the completed view restores it.
      commitRef.current(settlePracticeTiming(ref.current, Date.now()))
    }
    // Helpers read mutable refs; the subscription follows only this mounted attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  useEffect(() => {
    if (!ready || session.status !== 'COMPLETE') return
    if (saved) { callback.current?.(saved); return }
    let active = true
    const timing = parsePracticeTiming(settlePracticeTiming(ref.current, Date.now()))!
    studyRequest<PracticeTiming>(accountId, `/api/study/exams/attempts/${session.id}/timing`, { method: 'PUT', body: JSON.stringify(timing) })
      .then(value => { if (active) { setSaved(value); setError(''); callback.current?.(value) } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '用时保存失败，请重试') })
    return () => { active = false }
  }, [accountId, ready, session.id, session.mode, session.status, saved, retry])

  const display = saved ?? clock
  const complete = session.status === 'COMPLETE'
  return <section className={styles.timer} aria-label="自主计时">
    <div className={styles.heading}>
      <div><strong>{complete ? '本套用时' : '自主计时'}</strong><span className={styles.total}>{formatPracticeTime(display.totalMs)}</span></div>
      {!complete && <Button size="sm" variant="outline" disabled={!ready} onClick={() => {
        let current = ref.current
        const now = Date.now()
        if (current.runningSince !== null) {
          commit(settlePracticeTiming(current, now))
          return
        }
        const latest = readSnapshot()
        if (latest) current = { ...latest, stage, runningSince: null }
        commit({ ...current, tracked: true, runningSince: now }, true)
      }}>{clock.runningSince !== null ? '暂停计时' : clock.tracked ? '继续计时' : '开始计时'}</Button>}
    </div>
    <div className={styles.modules}>{TIMING_STAGES.filter(item => session.mode === 'FULL' || item === session.mode).map(item => <span key={item} data-active={!complete && item === stage}>{TIMING_LABELS[item]} <b>{formatPracticeTime(display.modules[item])}</b></span>)}</div>
    <p className={styles.note}>{complete ? display.tracked ? saved ? '用时已保存至本次试卷记录。' : '正在保存用时…' : '本次未开启计时。' : '手动开始或暂停；切换模块、切到后台或刷新后暂停。完成本次练习后保存用时。'}</p>
    {storageError && <p className={styles.note} role="alert">浏览器无法持久缓存用时，当前标签内仍会保留；刷新或关闭前请完成本次练习并保存用时。</p>}
    {error && <p role="alert" className={styles.note}>{error} <Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>重试保存</Button></p>}
  </section>
}
