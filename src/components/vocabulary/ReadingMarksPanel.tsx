'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { studyRequest } from '@/features/study/client'
import type { ReadingMarkPage } from '@/features/study/readingMarkTypes'
import styles from './reading-marks.module.css'

export default function ReadingMarksPanel({ accountId, active }: { accountId: string; active: boolean }) {
  const [data, setData] = useState<ReadingMarkPage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setBusy(true); setError('')
    void studyRequest<ReadingMarkPage>(accountId, '/api/study/marks', { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result) })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '标记暂时无法加载') })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [accountId, active, reload])
  const more = useCallback(async () => {
    if (busy || !data?.nextCursor) return
    setBusy(true); setError('')
    try {
      const next = await studyRequest<ReadingMarkPage>(accountId, `/api/study/marks?cursor=${encodeURIComponent(data.nextCursor)}`)
      setData((old) => ({ ...next, items: [...(old?.items ?? []), ...next.items] }))
    } catch (failure) { setError(failure instanceof Error ? failure.message : '标记暂时无法加载') }
    finally { setBusy(false) }
  }, [accountId, busy, data])
  return <div className={styles.panel}>
    <header className={styles.heading}><h1>标记查询</h1><Button variant="outline" disabled={busy} onClick={() => setReload((old) => old + 1)}>刷新</Button></header>
    {error && <div role="alert" className={styles.empty}>{error}<Button variant="outline" disabled={busy} onClick={() => setReload((old) => old + 1)}>重试</Button></div>}
    {busy && !data && <p role="status" className={styles.empty}>正在查询标记…</p>}
    {!busy && !error && data && !data.items.length && <p className={styles.empty}>您还没有在题目中标记过单词或语句</p>}
    <div className={styles.list}>{data?.items.map((mark) => <article key={`${mark.attemptId}:${mark.passageId}:${mark.start}:${mark.end}`} className={styles.card}>
      <blockquote>{mark.text}</blockquote><p>{mark.paperLevel === 'CET6' ? '六级' : '四级'} · {mark.paperTitle}</p><p>{mark.source}</p>
      <Button asChild variant="outline"><Link href={`/study?${new URLSearchParams({ attemptId: mark.attemptId, passageId: mark.passageId, start: String(mark.start), end: String(mark.end) })}`}>跳转到标记题目</Link></Button>
    </article>)}</div>
    {data?.nextCursor && <Button className={styles.more} variant="outline" disabled={busy} onClick={() => void more()}>{busy ? '正在加载…' : '加载更多'}</Button>}
  </div>
}
