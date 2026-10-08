'use client'

import { ThemedSelect, SelectItem } from '@/components/ui/themed-select'

import { lazy, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Files, History, Settings2, ChartNoAxesCombined } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { studyRequest } from './client'
import { EXAM_MODE_LABELS, type ExamMode, type ExamSessionView } from './examTypes'
import type { StudyLevel } from './domain'
import type { StudyHomeData, SessionView } from './types'
import type { ReadingMarkSource } from './readingMarkTypes'
import type { StudyMaterialCatalogue } from './materialTypes'
import styles from './study-workspace.module.css'

const StudyExam = lazy(() => import('./StudyExam'))
const MaterialCatalogue = lazy(() => import('./MaterialCatalogue'))
const GoalEditor = lazy(() => import('./GoalEditor'))
const ExamHistory = lazy(() => import('./ExamHistory'))
const StudyArchive = lazy(() => import('./StudyArchive'))
const StudyReader = lazy(() => import('./StudyReader'))
const ScoreEvidencePanel = lazy(() => import('./ScoreEvidencePanel'))
type MarkTarget = { attemptId: string; passageId: string; start: string; end: string }
const MODES: ExamMode[] = ['LISTENING', 'READING', 'TRANSLATION', 'WRITING', 'FULL']

export default function StudyWorkspace({ showMaterials = false, showEvidence = false, markTarget, examId }: { showMaterials?: boolean; showEvidence?: boolean; markTarget?: MarkTarget; examId?: string }) {
  const { data: session, status } = useSession()
  if (status === 'loading') return <p className={styles.empty} role="status">正在载入备考工作台…</p>
  if (!session?.user?.id) return <main className={styles.workspace}><h1>四六级备考</h1><p className={styles.empty}>登录后选择真题练习，并保存进度与成绩。</p><Button asChild><Link href={markTarget || examId ? `/auth/signin?callbackUrl=${encodeURIComponent(`/study?${new URLSearchParams(markTarget ?? { examId: examId! })}`)}` : '/auth/signin'}>登录，开始备考</Link></Button></main>
  return <AccountWorkspace key={`${session.user.id}:${markTarget ? new URLSearchParams(markTarget) : examId ?? ''}`} accountId={session.user.id} showMaterials={showMaterials} showEvidence={showEvidence} markTarget={markTarget} examId={examId} />
}
function AccountWorkspace({ accountId, showMaterials, showEvidence, markTarget, examId }: { accountId: string; showMaterials: boolean; showEvidence: boolean; markTarget?: MarkTarget; examId?: string }) {
  const router = useRouter()
  const [home, setHome] = useState<StudyHomeData | null>(null)
  const [catalogue, setCatalogue] = useState<Pick<StudyMaterialCatalogue, 'totalSets'> | null>(null)
  const [mode, setMode] = useState<ExamMode | null>('READING')
  const [level, setLevel] = useState<StudyLevel>('CET4')
  const [materials, setMaterials] = useState(showMaterials)
  const [goal, setGoal] = useState(false)
  const [records, setRecords] = useState<'exams' | 'reading' | 'analysis' | null>(null)
  const [reading, setReading] = useState<SessionView | null>(null)
  const [attempt, setAttempt] = useState<ExamSessionView | undefined>()
  const [evidence, setEvidence] = useState(showEvidence)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [markedSource, setMarkedSource] = useState<ReadingMarkSource | null>(null)
  const [markLoading, setMarkLoading] = useState(!!markTarget || !!examId)
  const [markError, setMarkError] = useState('')
  const [markReload, setMarkReload] = useState(0)
  useEffect(() => {
    if (!markTarget && !examId) return
    const controller = new AbortController()
    setMarkLoading(true); setMarkError(''); setMarkedSource(null); setAttempt(undefined)
    const load = markTarget
      ? studyRequest<ReadingMarkSource>(accountId, `/api/study/marks?${new URLSearchParams(markTarget)}`, { signal: controller.signal }).then((source) => ({ source, session: source.session }))
      : studyRequest<ExamSessionView>(accountId, `/api/study/exams/attempts/${encodeURIComponent(examId!)}`, { signal: controller.signal }).then((session) => ({ source: null, session }))
    void load.then(({ source, session }) => {
        if (controller.signal.aborted) return
        setMarkedSource(source); setAttempt(session); setLevel(session.paper.level); setMode(session.mode); setReading(null)
      })
      .catch((failure) => { if (!controller.signal.aborted) setMarkError(failure instanceof Error ? failure.message : '试卷暂时无法打开') })
      .finally(() => { if (!controller.signal.aborted) setMarkLoading(false) })
    return () => controller.abort()
  }, [accountId, markTarget, examId, markReload])
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    void Promise.all([
      studyRequest<StudyHomeData>(accountId, '/api/study', { signal: controller.signal }),
      studyRequest<Pick<StudyMaterialCatalogue, 'totalSets'>>(accountId, '/api/study/materials?summary=1', { signal: controller.signal }),
    ]).then(([data, library]) => {
      if (controller.signal.aborted) return
      setHome(data); setCatalogue(library)
      if (data.goal && !markTarget && !examId) setLevel(data.goal.level)
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '工作台暂不可用') })
    return () => controller.abort()
  }, [accountId, reload, markTarget, examId])
  const pickMode = (next: ExamMode) => { setMarkedSource(null); setMarkError(''); setAttempt(undefined); setReading(null); setMode(next) }
  return <>
    <nav className={styles.modeTabs} aria-label="备考专项">{MODES.map((item) => <button key={item} disabled={markLoading} onClick={() => pickMode(item)} aria-pressed={mode === item && !reading}>{item === 'FULL' ? '整卷' : EXAM_MODE_LABELS[item].replace('练习', '')}</button>)}</nav>
    <main className={styles.workspace} data-workspace-page data-workspace-study>
    <div className={styles.meta}>
      <ThemedSelect disabled={markLoading} aria-label="练习级别" value={level} onValueChange={(value) => { setLevel(value as StudyLevel); setMarkedSource(null); setMarkError(''); setAttempt(undefined); setReading(null) }}><SelectItem value="CET4">四级</SelectItem><SelectItem value="CET6">六级</SelectItem></ThemedSelect>
      <button className={styles.utility} onClick={() => setMaterials(true)}><Files size={16} />{catalogue ? `试卷目录 · ${catalogue.totalSets} 套` : '试卷目录'}</button>
      <button className={styles.utility} onClick={() => setGoal(true)}><Settings2 size={14} />{home?.goal ? `目标 ${home.goal.targetScore} 分` : '设置目标'}</button>
      <button className={styles.utility} disabled={markLoading} onClick={() => setRecords('analysis')}><ChartNoAxesCombined size={14} />试卷分析</button>
      <button className={styles.utility} disabled={markLoading} onClick={() => setRecords('exams')}><History size={14} />记录</button>
    </div>
    {error && <p role="alert" className={styles.empty}>{error}<button className={styles.utility} onClick={() => setReload((old) => old + 1)}>重试</button></p>}
    <div className={styles.practice}>
      {markedSource && <Button asChild variant="outline"><Link href="/history?view=marks">返回标记查询</Link></Button>}
      <Suspense fallback={<p className={styles.empty} role="status">正在打开练习…</p>}>
        {markLoading ? <p role="status" className={styles.empty}>正在打开试卷…</p> : markError ? <div role="alert" className={styles.empty}>{markError}<Button onClick={() => setMarkReload((old) => old + 1)}>重试</Button><Button asChild variant="outline"><Link href={markTarget ? "/history?view=marks" : "/study"}>{markTarget ? "返回标记查询" : "返回备考"}</Link></Button></div> : reading ? <><button className={styles.utility} onClick={() => setReading(null)}>收起阅读记录 ×</button><StudyReader accountId={accountId} session={reading} onSession={setReading} hasNext={false} onNext={() => {}} /></> : mode ? <StudyExam key={`${accountId}:${level}:${mode}:${attempt?.id ?? 'new'}:${markedSource?.start ?? ''}:${markedSource?.end ?? ''}`} accountId={accountId} level={level} mode={mode} initialSession={attempt} readingSource={markedSource ?? undefined} onSessionSwitch={(next) => router.replace(`/study?${new URLSearchParams({ examId: next.id })}`, { scroll: false })} /> : <p className={styles.empty}>选择上方专项，继续你的练习。</p>}
      </Suspense>
    </div>
    <footer className={styles.footer}>
      <button className={styles.utility} disabled={markLoading} onClick={() => setRecords('reading')}>阅读档案</button>
      <button className={styles.utility} onClick={() => setEvidence((old) => !old)} aria-expanded={evidence}>目标达成参考</button>
    </footer>
    {evidence && <Suspense fallback={<p role="status">读取参考记录…</p>}><ScoreEvidencePanel accountId={accountId} level={level} onChanged={() => setReload((old) => old + 1)} /></Suspense>}
    <Suspense fallback={<p role="status">正在打开…</p>}>
      {materials && <MaterialCatalogue accountId={accountId} onClose={() => setMaterials(false)} />}
      {goal && <GoalEditor accountId={accountId} goal={home?.goal ?? null} onClose={() => setGoal(false)} onSaved={() => { setGoal(false); setReload((old) => old + 1) }} />}
      {(records === 'exams' || records === 'analysis') && <ExamHistory accountId={accountId} purpose={records === 'analysis' ? 'analysis' : 'records'} onClose={() => setRecords(null)} onPick={(session) => { setMarkedSource(null); setMarkError(''); setAttempt(session); setLevel(session.paper.level); setMode(session.mode); setReading(null); setRecords(null) }} />}
      {records === 'reading' && <StudyArchive accountId={accountId} onClose={() => setRecords(null)} onPick={(session) => { setReading(session); setRecords(null) }} />}
    </Suspense>
  </main></>
}
