'use client'

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BookOpen, ChevronRight, Settings2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { studyRequest } from './client'
import type { SessionView, StudyHomeData } from './types'
import StudyReader from './StudyReader'
import styles from './study.module.css'

const GoalEditor = lazy(() => import('./GoalEditor'))

export default function StudyHome({ onInteraction }: { onInteraction?: () => void }) {
  const { data: session, status } = useSession()
  if (status === 'loading') return <p role="status" className={styles.empty}>正在载入今日学习…</p>
  if (!session?.user?.id) return <section className={`${styles.workspace} ${styles.panel}`}>
    <p className={styles.eyebrow}>CET-4 / CET-6</p><h3>每天，读懂一篇真题</h3>
    <p className={styles.subtle}>点词看释义，一键继续。登录后保存生词与阅读进度。</p>
    <Button asChild><Link href="/auth/signin">登录，开始阅读</Link></Button>
    <Link className={styles.textButton} href="/study">查看四六级备考</Link>
  </section>
  return <StudyAccountHome key={session.user.id} accountId={session.user.id} onInteraction={onInteraction} />
}

function StudyAccountHome({ accountId, onInteraction }: { accountId: string; onInteraction?: () => void }) {
  const [data, setData] = useState<StudyHomeData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editGoal, setEditGoal] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const alive = useRef(true)
  const startId = useRef<string | null>(null)
  const startBusy = useRef(false)
  const request = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setError('')
    try {
      const result = await studyRequest<StudyHomeData>(accountId, '/api/study', { signal: controller.signal })
      if (alive.current && !controller.signal.aborted) setData(result)
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : '暂不可用')
    }
  }, [accountId])
  useEffect(() => {
    alive.current = true; void refresh()
    return () => { alive.current = false; request.current?.abort() }
  }, [refresh])
  const start = async () => {
    if (startBusy.current) return
    startBusy.current = true; setBusy(true); setError('')
    startId.current ??= crypto.randomUUID()
    try {
      const session = await studyRequest<SessionView>(accountId, '/api/study/sessions', { method: 'POST', body: JSON.stringify({ clientId: startId.current }) })
      if (!alive.current) return
      startId.current = null
      setData((old) => old ? { ...old, session } : old)
      onInteraction?.()
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '文章未打开，请重试') }
    finally { startBusy.current = false; if (alive.current) setBusy(false) }
  }
  const update = (session: SessionView) => {
    const finished = data?.session?.status !== 'COMPLETE' && session.status === 'COMPLETE'
    setData((old) => old ? { ...old, session } : old)
    onInteraction?.()
    if (finished) void refresh()
  }
  return <div className={`${styles.workspace} ${styles.daily}`} data-study-home>
    <header className={styles.toolbar}><h2><BookOpen size={18} />今日学习</h2><Link className={styles.textButton} href="/study">全部练习与试卷</Link></header>
    {error && <div className={styles.error} role="alert">{error}<button className={styles.textButton} disabled={busy} onClick={() => void (startId.current ? start() : refresh())}>重试</button></div>}
    {!data && !error && <p className={styles.empty} role="status">正在读取学习进度…</p>}
    {data && !data.goal && <section className={styles.goal}>
      <div><strong>给这次备考定一个目标</strong><p className={styles.subtle}>设置一次，自动安排每日阅读。</p></div>
      <Button onClick={() => setEditGoal(true)}>设置目标</Button>
    </section>}
    {data?.goal && <>
      <button className={styles.studyContext} onClick={() => setContextOpen(true)} aria-label="查看备考目标与进度">
        <span>{data.goal.level === 'CET4' ? '四级' : '六级'} · {data.goal.targetScore} 分 · {data.daysLeft ? `剩 ${data.daysLeft} 天` : '考试日已到'}</span>
        <span>{data.assessment?.status === 'observed' ? `达标参考 ${Math.round(data.assessment.observedRate * 100)}%` : `模考 ${Math.min(5, data.assessment?.sampleCount ?? 0)}/5`}<ChevronRight size={14} /></span>
      </button>
      {contextOpen && <Dialog open onOpenChange={setContextOpen}><DialogContent className={`${styles.workspace} ${styles.resourceDialog}`}>
        <DialogTitle>备考目标与进度</DialogTitle>
        <DialogDescription>{data.goal.level === 'CET4' ? '大学英语四级' : '大学英语六级'} · 目标 {data.goal.targetScore} 分 · {data.daysLeft ? `距离考试 ${data.daysLeft} 天` : '考试日已到'}</DialogDescription>
        <button className={styles.textButton} onClick={() => { setContextOpen(false); setEditGoal(true) }}><Settings2 size={16} />调整目标</button>
        <p className={styles.subtle}>今日已完成 {data.todayCompleted} 篇 · 累计阅读 {data.reading.completed} 篇</p>
        <Link className={styles.textButton} href="/study?view=evidence">{data.assessment?.status === 'observed' ? `近期模考达标 ${Math.round(data.assessment.observedRate * 100)}% · 查看参考依据` : `达标参考：还需 ${Math.max(0, 5 - (data.assessment?.sampleCount ?? 0))} 次完整模考成绩`}</Link>
      </DialogContent></Dialog>}
      {data.session ? <StudyReader key={data.session.id} compact accountId={accountId} session={data.session} onSession={update} onNext={() => void start()} hasNext={data.contentReady} /> : <section className={`${styles.panel} ${styles.startPanel}`}>
        <h3>{data.contentReady ? '今天，从一篇文章开始' : '你的目标已保存'}</h3>
        <p className={styles.subtle}>{data.contentReady ? '不认识的词点一下，读完做 5 道题。' : '这个级别暂时没有阅读材料。'}</p>
        {data.contentReady && <Button disabled={busy} onClick={() => void start()}>{busy ? '正在打开…' : '开始今天的学习'}</Button>}
      </section>}
    </>}
    {editGoal && <Suspense fallback={<p role="status">正在打开目标设置…</p>}><GoalEditor accountId={accountId} goal={data?.goal ?? null} onClose={() => setEditGoal(false)} onSaved={() => { setEditGoal(false); startId.current = null; void refresh() }} /></Suspense>}
  </div>
}
