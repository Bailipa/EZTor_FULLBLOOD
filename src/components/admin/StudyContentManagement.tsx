'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { studyRequest } from '@/features/study/client'
import { parsePassage, type PassageInput } from '@/features/study/domain'
import { parseExamContent } from '@/features/study/examDomain'
import { Button } from '@/components/ui/button'
import styles from './study-content.module.css'

type RecordRow = {
  id: string; slug: string; version: number; title: string; level: string; kind: string
  sourceName: string; sourceUrl: string | null; rightsHolder: string; rightsEvidence: string; originType?: string
  rightsStatus: string; contentHash: string; createdAt: string
}
const kindLabel: Record<string, string> = { PAST_EXAM: '历年真题', OFFICIAL_SAMPLE: '官方样题', ORIGINAL: '原创' }
const statusLabel: Record<string, string> = { PENDING: '待核验', APPROVED: '已批准', REJECTED: '已撤回/拒绝' }

export default function StudyContentManagement({ accountId }: { accountId: string }) {
  const [mode, setMode] = useState<'passages' | 'exams'>('passages')
  return <><div className={styles.row} style={{ padding: '16px' }}><Button variant={mode === 'passages' ? 'default' : 'outline'} onClick={() => setMode('passages')}>阅读内容</Button><Button variant={mode === 'exams' ? 'default' : 'outline'} onClick={() => setMode('exams')}>听力与整卷</Button></div><ContentManager key={`${accountId}:${mode}`} accountId={accountId} mode={mode} /></>
}
function ContentManager({ accountId, mode }: { accountId: string; mode: 'passages' | 'exams' }) {
  const endpoint = `/api/admin/study/${mode}`
  const maxBytes = mode === 'exams' ? 1_500_000 : 300_000
  const [records, setRecords] = useState<RecordRow[]>([])
  const [raw, setRaw] = useState<PassageInput | Record<string, unknown> | null>(null)
  const [detail, setDetail] = useState<{ id: string; content: unknown } | null>(null)
  const [fileName, setFileName] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const alive = useRef(false)
  const currentAccount = useRef(accountId)
  currentAccount.current = accountId
  const loadOperation = useRef(0)
  const fileOperation = useRef(0)
  const writeOperation = useRef(0)
  const writing = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    loadOperation.current += 1
    fileOperation.current += 1
    writeOperation.current += 1
    writing.current = false
    setRecords([]); setRaw(null); setReason(''); setSaving(false)
  }, [accountId])

  const load = useCallback(async () => {
    const operation = ++loadOperation.current
    setLoading(true); setError('')
    const current = () => alive.current && currentAccount.current === accountId && loadOperation.current === operation
    try {
      const result = await studyRequest<RecordRow[]>(accountId, endpoint)
      if (current()) setRecords(result)
    } catch (e) { if (current()) setError(e instanceof Error ? e.message : '记录加载失败') }
    finally { if (current()) setLoading(false) }
  }, [accountId, endpoint])
  useEffect(() => { void load() }, [load])

  async function selectFile(file?: File) {
    const operation = ++fileOperation.current
    const current = () => alive.current && currentAccount.current === accountId && fileOperation.current === operation
    setError(''); setNotice(''); setRaw(null); setFileName('')
    if (!file) return
    if (file.size > maxBytes) { setError(`文件超过 ${maxBytes.toLocaleString()} 字节限制`); return }
    try {
      const parsed = JSON.parse(await file.text())
      if (!current()) return
      if (mode === 'exams') {
        if (!parsed || typeof parsed !== 'object' || !['CET4', 'CET6'].includes(parsed.level) || !['FULL', 'LISTENING'].includes(parsed.kind)) throw new Error('请选择有效的CET试卷内容包')
        parseExamContent(parsed.content, parsed.level, parsed.kind)
        setRaw(parsed)
      } else setRaw(parsePassage(parsed))
      setFileName(file.name)
    } catch (e) { if (current()) setError(e instanceof Error ? `文件读取或格式校验失败：${e.message}` : '文件读取或格式校验失败') }
  }

  async function importContent() {
    if (!raw || writing.current) return
    writing.current = true
    const operation = ++writeOperation.current
    const current = () => alive.current && currentAccount.current === accountId && writeOperation.current === operation
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await studyRequest<{ id: string; rightsStatus: string; contentHash: string }>(accountId, endpoint, { method: 'POST', body: JSON.stringify(raw) })
      if (current()) setNotice(`已提交待核验 · SHA-256 ${result.contentHash}`)
      await load()
    } catch (e) { if (current()) setError(`${e instanceof Error ? e.message : '导入失败'}。可使用同一文件重试；相同标识和版本的内容不会另建版本。`) }
    finally { if (writeOperation.current === operation) writing.current = false; if (current()) setSaving(false) }
  }

  async function review(record: RecordRow, status: 'APPROVED' | 'REJECTED') {
    if (writing.current) return
    writing.current = true
    const operation = ++writeOperation.current
    const current = () => alive.current && currentAccount.current === accountId && writeOperation.current === operation
    const reviewReason = reason
    setSaving(true); setError(''); setNotice('')
    try {
      await studyRequest(accountId, `${endpoint}/${encodeURIComponent(record.id)}`, { method: 'PATCH', body: JSON.stringify(mode === 'exams' ? { rightsStatus: status, reviewEvidence: reviewReason } : { status, reason: reviewReason }) })
      if (current()) { setNotice(status === 'APPROVED' ? '已批准' : '已撤回'); setReason('') }
      await load()
    } catch (e) { if (current()) setError(`${e instanceof Error ? e.message : '审核请求失败'}。无法确认服务端是否已提交，请刷新记录核对后再操作。`) }
    finally { if (writeOperation.current === operation) writing.current = false; if (current()) setSaving(false) }
  }

  const passage = mode === 'passages' ? raw as PassageInput | null : null
  const sentences = passage?.content.sentences.length ?? 0
  const questions = passage?.content.questions.length ?? 0
  const paragraphs = passage ? new Set(passage.content.sentences.map((sentence) => sentence.paragraph)).size : 0
  const inspect = async (id: string) => {
    setError('')
    try {
      const result = await studyRequest<{ content: unknown }>(accountId, `${endpoint}/${encodeURIComponent(id)}`)
      if (alive.current) setDetail({ id, content: result.content })
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '内容未加载') }
  }

  return <main className={styles.page}><div className={styles.inner}>
    <header className={styles.header}><h1 className={styles.title}>CET 内容包管理</h1><p className={styles.muted}>上传内容包，核对题文、答案、音频与来源后再批准；使用说明如实记录。</p></header>
    <section className={styles.panel}>
      <h2 className="font-semibold">导入内容包</h2>
      <input type="file" accept="application/json,.json" onChange={(e) => void selectFile(e.currentTarget.files?.[0])} />
      <p className={styles.muted}>仅 JSON，文件不超过 {maxBytes.toLocaleString()} 字节。预览不替代服务端完整校验。</p>
      {raw && <><div className={styles.row}><strong>{fileName}</strong><span>{String(raw.title)}</span><span>{String(raw.level)} · {kindLabel[String(raw.kind)] || String(raw.kind)}</span></div>
        <div className={styles.muted}>标识 {String(raw.slug)} · 版本 {String(raw.version)} · 来源 {String(raw.sourceName)}{passage ? ` · ${sentences} 句 / ${paragraphs} 段 / ${questions} 题` : ' · CET 听力或完整试卷'}</div>
        <pre className={styles.preview}>{JSON.stringify({ sourceUrl: raw.sourceUrl, rightsHolder: raw.rightsHolder, rightsEvidence: raw.rightsEvidence, structure: { sentenceCount: sentences, paragraphCount: paragraphs, questionCount: questions, translationTask: true, writingTask: true } }, null, 2)}</pre>
        <details><summary>核对题文、答案与音频链接</summary><pre className={styles.preview}>{JSON.stringify(raw.content, null, 2)}</pre></details>
        <Button disabled={saving} onClick={() => void importContent()}>{saving ? '处理中…' : '导入待核验'}</Button>
      </>}
    </section>
    <section className={styles.panel}>
      <div className={styles.row}><h2 className="font-semibold">最近 50 条</h2><Button variant="outline" disabled={loading} onClick={() => void load()}>{loading ? '加载中…' : '刷新'}</Button></div>
      {loading && records.length === 0 && <p className={styles.muted}>正在加载记录…</p>}
      {!loading && records.length === 0 && <p className={styles.muted}>暂无记录</p>}
      {records.map((record) => <article key={record.id} className={styles.record}>
        <div className={styles.row}><strong>{record.title}</strong><span>{record.level} · {kindLabel[record.kind] || record.kind} · v{record.version}</span><span>{statusLabel[record.rightsStatus] || record.rightsStatus}</span></div>
        <div className={styles.muted}>标识 {record.slug} · 来源：{record.sourceName}{record.sourceUrl ? <> · <a href={record.sourceUrl} target="_blank" rel="noreferrer">来源链接</a></> : ''}</div>
        <div className={styles.muted}>权利人记录：{record.rightsHolder} · 来源与使用说明：{record.rightsEvidence}</div>
        <div className={styles.hash}>SHA-256: {record.contentHash}</div>
        <div className={styles.label}>{new Date(record.createdAt).toLocaleString('zh-CN')}</div>
        <button onClick={() => void inspect(record.id)}>查看题文与答案</button>
        {detail?.id === record.id && <pre className={styles.preview}>{JSON.stringify(detail.content, null, 2)}</pre>}
        {record.rightsStatus !== 'REJECTED' && <div className={styles.row}><Button disabled={saving || reason.trim().length < 6} onClick={() => void review(record, record.rightsStatus === 'APPROVED' ? 'REJECTED' : 'APPROVED')}>{record.rightsStatus === 'APPROVED' ? '撤回' : '批准'}</Button>{record.rightsStatus === 'PENDING' && <Button variant="outline" disabled={saving || reason.trim().length < 6} onClick={() => void review(record, 'REJECTED')}>拒绝</Button>}</div>}
      </article>)}
    </section>
    <section className={styles.panel}><label htmlFor="review-reason" className="font-semibold">审核说明（批准或撤回前必填，至少 6 字）</label><textarea id="review-reason" className={styles.field} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="记录核验依据或撤回原因" /></section>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
  </div></main>
}
