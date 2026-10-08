'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { studyRequest } from './client'
import { studyEventDescription } from './eventDescription'
import styles from './study.module.css'

type EventPage = { items: { id: string; type: string; data: unknown; activeMs: number; createdAt: string }[]; nextCursor: string | null }

export default function StudyEventHistory({ accountId, sessionId }: { accountId: string; sessionId: string }) {
  const [page, setPage] = useState<EventPage | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  const load = useCallback(async (cursor?: string) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError('')
    try {
      const result = await studyRequest<EventPage>(accountId, `/api/study/sessions/${encodeURIComponent(sessionId)}/events${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: controller.signal })
      if (!controller.signal.aborted) setPage(old => ({ ...result, items: cursor && old ? [...old.items, ...result.items] : result.items }))
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '操作记录暂不可用')
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }, [accountId, sessionId])
  useEffect(() => {
    void load()
    return () => { request.current?.abort(); request.current = null }
  }, [load])

  return <section aria-label="学习操作记录">
    <p className={styles.subtle}>最近操作在前；有效用时只累计可见且聚焦的学习时间。</p>
    {error && <div className={styles.error} role="alert">{error}<button className={styles.textButton} disabled={busy} onClick={() => void load(page?.nextCursor ?? undefined)}>重试</button></div>}
    {!page && !error && <p role="status">正在读取操作记录…</p>}
    <ol className={styles.eventHistory}>{page?.items.map(event => <li key={event.id}>
      <span>{studyEventDescription(event)}</span>
      <small><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('zh-CN')}</time>{event.activeMs > 0 && ` · 有效用时 ${Math.round(event.activeMs / 1000)} 秒`}</small>
    </li>)}</ol>
    {page?.nextCursor && <Button variant="outline" disabled={busy} onClick={() => void load(page.nextCursor!)}>{busy ? '加载中…' : '更早的操作'}</Button>}
  </section>
}
