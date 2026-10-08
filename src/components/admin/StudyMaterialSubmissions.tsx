'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import styles from './study-content.module.css'

type Submission = { id: string; name: string; yearSet: string; level: string; sourceUrl: string; description: string; answers: string; files: { id: string; name: string; size: number; type: string }[]; status: string; reviewNote?: string; createdAt: string }

export default function StudyMaterialSubmissions() {
  const [rows, setRows] = useState<Submission[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  async function load() {
    setBusy(true); setError('')
    try { const response = await fetch('/api/admin/study/material-submissions', { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setRows(body.submissions || []) }
    catch (e) { setError(e instanceof Error ? e.message : '加载失败') } finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  async function review(row: Submission, status: 'APPROVED' | 'REJECTED') {
    if (note.trim().length < 3) { setError('请先填写至少 3 个字的审核说明'); return }
    setBusy(true); setError('')
    try { const response = await fetch('/api/admin/study/material-submissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, status, reviewNote: note }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setNote(''); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '审核失败') } finally { setBusy(false) }
  }
  return <main className={styles.page}><div className={styles.inner}>
    <header className={styles.header}><h1 className={styles.title}>资料贡献审核</h1><p className={styles.muted}>上传文件保持私有。审核通过只表示资料已核验，仍需管理员整理成内容包后导入资源目录。</p></header>
    <section className={styles.panel}><div className={styles.row}><h2 className="font-semibold">最近提交</h2><Button variant="outline" disabled={busy} onClick={() => void load()}>{busy ? '加载中…' : '刷新'}</Button></div>
      {rows.length === 0 && !busy && <p className={styles.muted}>暂无提交</p>}
      {rows.map((row) => <article key={row.id} className={styles.record}>
        <div className={styles.row}><strong>{row.name}</strong><span>{row.yearSet} · {row.level}</span><span>{row.status}</span><span>{new Date(row.createdAt).toLocaleString('zh-CN')}</span></div>
        <div className={styles.muted}>来源：<a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceUrl}</a></div>
        {row.description && <p>{row.description}</p>}{row.answers && <details><summary>查看提交的答案</summary><pre className={styles.preview}>{row.answers}</pre></details>}
        <ul>{row.files.map((file) => <li key={file.id}><a href={`/api/study/material-submissions/files/${file.id}`}>{file.name} ({Math.ceil(file.size / 1024)} KB)</a></li>)}</ul>
        {row.reviewNote && <p className={styles.muted}>审核说明：{row.reviewNote}</p>}
        {row.status === 'PENDING' && <div className={styles.row}><Button disabled={busy || note.trim().length < 3} onClick={() => void review(row, 'APPROVED')}>通过审核</Button><Button variant="outline" disabled={busy || note.trim().length < 3} onClick={() => void review(row, 'REJECTED')}>拒绝</Button></div>}
      </article>)}
    </section>
    <section className={styles.panel}><label className="font-semibold" htmlFor="material-review-note">审核说明（至少 3 个字）</label><textarea id="material-review-note" className={styles.field} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录来源核验、文件检查或拒绝原因" /></section>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div></main>
}
