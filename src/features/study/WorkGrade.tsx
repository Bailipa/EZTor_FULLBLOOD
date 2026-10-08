'use client'

import { useEffect, useRef, useState } from 'react'
import { studyRequest } from './client'
import type { GradeInput, GradeView } from './grading'
import styles from './study.module.css'

export default function WorkGrade({ accountId, source, id, kind, revision }: GradeInput & { accountId: string }) {
  const [view, setView] = useState<GradeView>({ status: 'ABSENT' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true), sending = useRef(false), operation = useRef<string | null>(null)
  const query = new URLSearchParams({ source, id, kind, revision }).toString()
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    setView({ status: 'ABSENT' }); setError(''); operation.current = null
    void studyRequest<GradeView>(accountId, `/api/study/grades?${query}`, { signal: controller.signal }).then(result => { if (alive.current && !controller.signal.aborted) setView(result) }).catch(failure => { if (!controller.signal.aborted && alive.current) setError(failure instanceof Error ? failure.message : '评分记录未加载') })
    return () => { alive.current = false; controller.abort() }
  }, [accountId, query])
  const run = async (check = false) => {
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    operation.current ??= crypto.randomUUID()
    try {
      const result = await studyRequest<GradeView>(accountId, check ? `/api/study/grades?${query}` : '/api/study/grades', check ? {} : { method: 'POST', body: JSON.stringify({ source, id, kind, revision, clientId: operation.current }) })
      if (alive.current) setView(result)
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '暂未确认评分结果，请重试') }
    finally { sending.current = false; if (alive.current) setBusy(false) }
  }
  return <section className={styles.feedback} aria-label={`${kind === 'WRITING' ? '作文' : '翻译'}AI评分`}>
    <strong>{kind === 'WRITING' ? '作文' : '翻译'} · AI 估分</strong>
    <p className={styles.subtle}>按内容、语言和表达三个维度评估，满分15分。仅供学习参考，未经官方校准，不换算官方总分。</p>
    {view.grade && <><h4>{view.grade.score} / 15 · {view.grade.summary}</h4>
      <ul>{view.grade.dimensions.map(d => <li key={d.name}><strong>{d.name} {d.score}/5</strong> · {d.reason}</li>)}</ul>
      <ul>{view.grade.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
      {view.grade.corrections.length > 0 && <details><summary>具体改写建议</summary>{view.grade.corrections.map((c, i) => <div key={i}><p>原句：{c.original}</p><p>建议：{c.revised}</p><p className={styles.subtle}>{c.reason}</p></div>)}</details>}
      <p className={styles.subtle}>{new Date(view.grade.assessedAt).toLocaleString('zh-CN')} · {view.grade.model}</p></>}
    {(error || view.error) && <p role="alert">{error || view.error}</p>}
    {view.status !== 'COMPLETE' && <button className={styles.textButton} disabled={busy} onClick={() => void run(view.status === 'RUNNING')}>
      {busy ? '正在评估…' : view.status === 'RUNNING' ? '评分进行中，点击查看结果' : view.status === 'FAILED' ? '重试评分' : '获取 AI 评分'}
    </button>}
  </section>
}
