'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { useInputDraft } from '@/hooks/useInputDraft'
import { englishTokens, type StudyAction } from './domain'
import { studyRequest, useStudyClock } from './client'
import type { SessionView, StudyWork } from './types'
import { adoptMatchingPracticeRevision, hasPracticeDraftConflict, practiceDraftCodec, rebasePracticeDraft, type PracticeDraft } from './practiceDraft'
import styles from './study.module.css'
import inputStyles from './study-input.module.css'

const WorkGrade = dynamic(() => import('./WorkGrade'), { loading: () => <p role="status">正在读取评分…</p> })

export default function StudyPractice({ accountId, session, onSession }: { accountId: string; session: SessionView; onSession: (session: SessionView) => void }) {
  const [kind, setKind] = useState<'TRANSLATION' | 'WRITING'>('TRANSLATION')
  if (!session.practice) return null
  return <section className={styles.work} aria-label="翻译与写作训练">
    <h3>把读懂，变成会表达</h3>
    <div className={styles.tabs}><button aria-pressed={kind === 'TRANSLATION'} onClick={() => setKind('TRANSLATION')}>汉译英</button><button aria-pressed={kind === 'WRITING'} onClick={() => setKind('WRITING')}>写一段</button></div>
    <PracticeWork key={`${session.id}:${kind}`} accountId={accountId} session={session} kind={kind} onSession={onSession} />
  </section>
}

function PracticeWork({ accountId, session, kind, onSession }: { accountId: string; session: SessionView; kind: 'TRANSLATION' | 'WRITING'; onSession: (session: SessionView) => void }) {
  const router = useRouter()
  const practice = session.practice!
  const initialWork = session.works[kind]
  const [initial] = useState(() => () => ({ text: initialWork?.text ?? '', revision: initialWork?.revision ?? null }))
  const [draft, setDraft, draftKey] = useInputDraft<PracticeDraft>(`cet-work:${session.id}:${kind}`, initial, practiceDraftCodec)
  const text = draft.text
  const [saved, setSaved] = useState<StudyWork | undefined>(initialWork)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [edited, setEdited] = useState(false)
  const active = useRef(true)
  const sending = useRef(false)
  const pending = useRef<StudyAction | null>(null)
  const takeTime = useStudyClock(true)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const live = useRef({ draft, takeTime, edited, saved, draftKey })
  live.current = { draft, takeTime, edited, saved, draftKey }
  const conflict = hasPracticeDraftConflict(draft, saved)

  useEffect(() => {
    const matching = adoptMatchingPracticeRevision(draft, saved)
    if (matching !== draft) setDraft(matching)
  }, [draft, saved, setDraft])

  useEffect(() => {
    active.current = true
    const flush = () => {
      const current = live.current
      if (!current.edited || !current.draftKey || current.draft.text === current.saved?.text || hasPracticeDraftConflict(current.draft, current.saved) || sending.current || pending.current) return
      void studyRequest(accountId, `/api/study/sessions/${session.id}`, { method: 'POST', keepalive: true, body: JSON.stringify({
        type: 'WORK_DRAFT', clientId: crypto.randomUUID(), kind, text: current.draft.text, revision: current.draft.revision, activeMs: current.takeTime(),
      }) }).catch(() => { /* Account-scoped local draft is retained for recovery. */ })
    }
    window.addEventListener('pagehide', flush)
    return () => { flush(); active.current = false; window.removeEventListener('pagehide', flush) }
  }, [accountId, kind, session.id])

  async function save(submitted: boolean, retry = false, draftToSave = draft) {
    if (sending.current || (!retry && pending.current)) return false
    if (!retry && hasPracticeDraftConflict(draftToSave, saved)) return false
    const action = retry ? pending.current : { type: submitted ? 'WORK_SUBMIT' : 'WORK_DRAFT', clientId: crypto.randomUUID(), kind, text: draftToSave.text, revision: draftToSave.revision, activeMs: takeTime() } as StudyAction
    if (!action) return false
    sending.current = true; pending.current = action; setBusy(true); setError('')
    try {
      const result = await studyRequest<{ session: SessionView; receipt: { work: StudyWork } }>(accountId, `/api/study/sessions/${session.id}`, { method: 'POST', body: JSON.stringify(action) })
      if (!active.current) return false
      pending.current = null
      setDraft((current) => ({ ...current, revision: result.receipt.work.revision }))
      setSaved(result.receipt.work); onSession(result.session)
      return true
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : '无法确认保存结果，草稿仍保留在本机'); return false }
    finally { sending.current = false; if (active.current) setBusy(false) }
  }
  async function sync() {
    if (sending.current) return
    sending.current = true; setBusy(true)
    try {
      const result = await studyRequest<SessionView>(accountId, `/api/study/sessions/${session.id}`)
      if (!active.current) return
      pending.current = null
      setSaved(result.works[kind]); setDraft((current) => adoptMatchingPracticeRevision(current, result.works[kind])); setError(''); onSession(result)
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : '无法同步') }
    finally { sending.current = false; if (active.current) setBusy(false) }
  }
  useEffect(() => {
    if (!edited || !draftKey || busy || error || conflict || text === saved?.text) return
    const timer = window.setTimeout(() => void save(false), 5000)
    return () => window.clearTimeout(timer)
    // Only a settled edit schedules a save; the request uses the current render's text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, edited, draftKey, busy, error, saved?.text, conflict])

  const wordCount = englishTokens(text).length
  const submitted = saved?.submitted && saved.text === text
  const discardLocal = () => {
    setDraft(adoptMatchingPracticeRevision({ text: saved?.text ?? '', revision: draft.revision }, saved))
    setEdited(false); setError('')
  }
  const keepLocal = () => {
    const rebased = rebasePracticeDraft(draftRef.current, saved)
    setDraft(rebased); setEdited(true); setError('')
    void save(false, false, rebased)
  }
  const analyze = async () => {
    const submittedText = draftRef.current.text
    if (submittedText !== (saved?.text ?? '') && !(await save(false))) return
    if (draftRef.current.text !== submittedText) return
    router.push(`/ai?study=${encodeURIComponent(session.id)}&practice=${kind.toLowerCase()}#assistant`)
  }

  return <div className={`${styles.form} ${inputStyles.editor}`}>
    <p>{kind === 'TRANSLATION' ? practice.translation.source : practice.writing.prompt}</p>
    {kind === 'WRITING' && <p className={styles.subtle}>{practice.writing.minimumWords}–{practice.writing.maximumWords} 词 · {practice.writing.rubric}</p>}
    <label>{kind === 'TRANSLATION' ? '你的译文' : '你的英文短文'}<textarea maxLength={12000} value={text} onChange={(event) => { setDraft((current) => ({ ...current, text: event.target.value })); setEdited(true) }} placeholder="直接写在这里，草稿会自动保存。" /></label>
    <p className={styles.subtle} role="status">{wordCount} 词 · {busy ? '正在同步草稿…' : saved?.text === text ? submitted ? '作品已提交并归档' : '草稿已同步' : '本机保留草稿，编辑结束后自动同步'}{kind === 'WRITING' && wordCount > 0 && (wordCount < practice.writing.minimumWords || wordCount > practice.writing.maximumWords) ? ' · 词数尚不符合要求' : ''}</p>
    {conflict && <div className={styles.error} role="alert"><strong>本机草稿与已同步版本冲突</strong><p>本机草稿基于 {draft.revision ?? '未知'}，当前已同步版本为 {saved?.revision ?? '无'}。保存、提交、自动保存和 AI 分析已暂停。</p><div className={styles.actions}><Button type="button" variant="outline" disabled={busy} onClick={discardLocal}>使用已同步版本</Button><Button type="button" disabled={busy} onClick={keepLocal}>保留本机草稿，作为新版本保存</Button><button className={styles.textButton} disabled={busy} onClick={() => void sync()}>刷新已同步版本</button></div></div>}
    {error && !conflict && <div className={styles.error} role="alert">{error}<div className={styles.row}><button className={styles.textButton} disabled={busy} onClick={() => void save(false, true)}>重试原保存</button><button className={styles.textButton} disabled={busy} onClick={() => void sync()}>同步版本，保留本机编辑</button></div></div>}
    <div className={`${styles.actions} ${inputStyles.inputActions}`}>
      <Button disabled={busy || !!error || conflict || !text.trim() || submitted} onClick={() => void save(true)}>{submitted ? '已提交' : kind === 'TRANSLATION' ? '提交，看看参考表达' : '提交作品'}</Button>
      {!edited && text !== (saved?.text ?? '') && !conflict && <button className={styles.textButton} disabled={busy || !!error} onClick={() => { setEdited(true); void save(false) }}>同步恢复的草稿</button>}
      <button className={styles.textButton} disabled={busy || !!error || conflict} onClick={() => void analyze()}>请 AI 帮我分析</button>
    </div>
    {submitted && <aside className={styles.feedback}>
      <strong>{kind === 'TRANSLATION' ? '参考表达' : '自查要点'}</strong>
      <p>{kind === 'TRANSLATION' ? practice.translation.reference : practice.writing.rubric}</p>
      <p className={styles.subtle}>{kind === 'TRANSLATION' ? practice.translation.notes : '检查是否切题、论证清楚、句子连贯；词数符合要求不代表达到考试评分标准。'}</p>
    </aside>}
    {submitted && saved && <WorkGrade key={`${session.id}:${kind}:${saved.revision}`} accountId={accountId} source="STUDY" id={session.id} kind={kind} revision={saved.revision} />}
  </div>
}
