'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { studyRequest } from './client'
import type { SessionView, StudyArchivePage } from './types'
import styles from './study.module.css'

const StudyEventHistory = dynamic(() => import('./StudyEventHistory'), { loading: () => <p role="status">正在读取操作记录…</p> })

export default function StudyArchive({ accountId, onClose, onPick }: { accountId: string; onClose: () => void; onPick: (session: SessionView) => void }) {
  const [data, setData] = useState<StudyArchivePage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [eventSession, setEventSession] = useState<string | null>(null)
  const alive = useRef(true)
  const sending = useRef(false)
  const load = async (cursor?: string) => {
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      const result = await studyRequest<StudyArchivePage>(accountId, `/api/study/archive${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
      if (alive.current) setData((old) => ({ ...result, items: cursor && old ? [...old.items, ...result.items] : result.items }))
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '记录暂不可用') }
    finally { sending.current = false; if (alive.current) setBusy(false) }
  }
  useEffect(() => {
    alive.current = true
    void load()
    return () => { alive.current = false }
    // This component is mounted separately for each account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId])
  const pick = async (id: string) => {
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      const result = await studyRequest<SessionView>(accountId, `/api/study/sessions/${id}`)
      if (alive.current) onPick(result)
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '文章暂不可用') }
    finally { sending.current = false; if (alive.current) setBusy(false) }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className={`${styles.workspace} max-h-[85dvh] overflow-y-auto sm:max-w-xl`}>
    <DialogTitle>我的备考档案</DialogTitle><DialogDescription>阅读、首次答案、生词和有效用时随账号保存。点开一篇继续或回看。</DialogDescription>
    {error && <div className={styles.error} role="alert">{error}<button className={styles.textButton} disabled={busy} onClick={() => void load()}>重新加载</button></div>}
    {!data && !error && <p role="status">正在读取档案…</p>}
    {data?.items.length === 0 && <p className={styles.empty}>先读第一篇，档案会自动建立。</p>}
    <div className={styles.archive}>{data?.items.map((entry) => <article key={entry.id} className={styles.archiveEntry}><button disabled={busy} onClick={() => void pick(entry.id)}>
      <span><strong>{entry.passage.title}</strong><small>{entry.passage.level === 'CET4' ? '四级' : '六级'} · {new Date(entry.startedAt).toLocaleDateString('zh-CN')} · {entry.assisted ? '查词辅助' : '未查词'}</small></span>
      <span>{entry.status === 'COMPLETE' ? `${entry.correct}/${entry.answered} 题` : '继续学习'}</span>
    </button><button className={styles.textButton} aria-expanded={eventSession === entry.id} aria-controls={`study-events-${entry.id}`} onClick={() => setEventSession(old => old === entry.id ? null : entry.id)}>{eventSession === entry.id ? '收起操作记录' : '查看操作记录'}</button>
      <div id={`study-events-${entry.id}`}>{eventSession === entry.id && <StudyEventHistory key={entry.id} accountId={accountId} sessionId={entry.id} />}</div>
    </article>)}</div>
    {data?.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void load(data.nextCursor!)}>{busy ? '加载中…' : '更早的记录'}</Button>}
  </DialogContent></Dialog>
}
