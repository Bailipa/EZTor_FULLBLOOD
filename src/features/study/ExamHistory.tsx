'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { studyRequest } from './client'
import { EXAM_MODE_LABELS } from './examTypes'
import type { ExamSessionView, ExamPaperMetadata, ExamMode, ExamStage } from './examTypes'
import styles from './study.module.css'

type ArchivePage = { items: { id: string; mode: ExamMode; status: ExamStage | 'COMPLETE'; startedAt: string; assisted: boolean; paper: ExamPaperMetadata }[]; nextCursor: string | null }

export default function ExamHistory({ accountId, onClose, onPick, purpose = 'records' }: { purpose?: 'records' | 'analysis'; accountId: string; onClose: () => void; onPick: (session: ExamSessionView) => void }) {
  const [data, setData] = useState<ArchivePage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(true)
  const sending = useRef(false)
  const load = async (cursor?: string) => {
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      const result = await studyRequest<ArchivePage>(accountId, `/api/study/exams/attempts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
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
      const result = await studyRequest<ExamSessionView>(accountId, `/api/study/exams/attempts/${id}`)
      if (alive.current) onPick(result)
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '模拟记录暂不可用') }
    finally { sending.current = false; if (alive.current) setBusy(false) }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className={`${styles.workspace} max-h-[85dvh] overflow-y-auto sm:max-w-xl`}>
    <DialogTitle>{purpose === 'analysis' ? '试卷分析' : '练习与模考记录'}</DialogTitle><DialogDescription>{purpose === 'analysis' ? '选择一条已完成记录查看分析。完成同一套试卷的写作、听力、阅读和翻译后可生成分析，也支持四个专项分次完成。' : '阶段答案、首次选择、回放和用时随账号保存。未完成的整卷模拟继续计时，点开可继续或回看。'}</DialogDescription>
    {error && <div className={styles.error} role="alert">{error}<button className={styles.textButton} disabled={busy} onClick={() => void load()}>重新加载</button></div>}
    {!data && !error && <p role="status">正在读取档案…</p>}
    {data?.items.length === 0 && <p className={styles.empty}>{purpose === 'analysis' ? '暂无试卷记录。完成同一套试卷的四个模块后，可在这里查看分析。' : '完成一次专项练习或整卷模拟，记录会自动建立。'}</p>}
    <div className={styles.archive}>{data?.items.map((entry) => <button key={entry.id} disabled={busy || (purpose === 'analysis' && entry.status !== 'COMPLETE')} onClick={() => void pick(entry.id)}>
      <span><strong>{entry.paper.title}</strong><small>{entry.paper.level === 'CET4' ? '四级' : '六级'} · {new Date(entry.startedAt).toLocaleDateString('zh-CN')} · {EXAM_MODE_LABELS[entry.mode]}</small></span>
      <span>{entry.status === 'COMPLETE' ? purpose === 'analysis' ? '查看分析' : '查看结果与分析' : purpose === 'analysis' ? '完成后可分析' : '继续作答'}</span>
    </button>)}</div>
    {data?.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void load(data.nextCursor!)}>{busy ? '加载中…' : '更早的记录'}</Button>}
  </DialogContent></Dialog>
}
