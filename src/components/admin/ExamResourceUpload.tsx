'use client'

import { useEffect, useRef, useState } from 'react'
import { studyRequest } from '@/features/study/client'
import { Button } from '@/components/ui/button'
import styles from './study-content.module.css'

type UploadedResource = { url: string; sha256: string; bytes: number }
export default function ExamResourceUpload({ accountId }: { accountId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState<UploadedResource[]>([])
  const active = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => { controller.current?.abort() }, [])
  async function upload() {
    if (!file || active.current) return
    active.current = true; setBusy(true); setError('')
    const request = new AbortController()
    controller.current = request
    try {
      const extension = file.name.split('.').at(-1)?.toLowerCase()
      if (!['mp3', 'm4a'].includes(extension || '') || file.size < 16 || file.size > 80 * 1024 * 1024)
        throw new Error('请选择80 MiB以内的MP3或M4A音频')
      const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const sha256 = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, '0')).join('')
      if (request.signal.aborted) return
      const result = await studyRequest<UploadedResource>(accountId, '/api/admin/study/resources', {
        method: 'POST', signal: request.signal, body: file,
        headers: { 'Content-Type': 'application/octet-stream', 'X-Resource-Extension': extension!, 'X-Resource-SHA256': sha256 },
      })
      if (request.signal.aborted) return
      setUploaded((old) => [result, ...old.filter((r) => r.url !== result.url)])
      setFile(null)
      if (input.current) input.current.value = ''
    } catch (e) {
      if (!request.signal.aborted) setError(`${e instanceof Error ? e.message : '上传失败'}。可重新上传同一文件，已完成的相同资源不会重复保存。`)
    } finally {
      active.current = false
      if (!request.signal.aborted) setBusy(false)
    }
  }
  return <section className={styles.panel}>
    <h2 className="font-semibold">上传听力资源</h2>
    <p className={styles.muted}>选择JSON预览后，上传其中引用的原始MP3或M4A（每个不超过80 MiB），再导入试卷。资源按内容校验并命名，不会覆盖已有文件；仅上传资源不会让用户看到新试卷。</p>
    <div className={styles.row}><input ref={input} aria-label="听力音频" type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError('') }} /><Button disabled={busy || !file} onClick={() => void upload()}>{busy ? '校验并上传中…' : '上传音频'}</Button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {uploaded.map((r) => <div key={r.url} className={styles.record}><p role="status">已上传 · {(r.bytes / 1024 / 1024).toFixed(1)} MiB</p><div className={styles.hash}>{r.url}</div><div className={styles.hash}>SHA-256 {r.sha256}</div><p className={styles.muted}>请确认此地址与内容包中的音频URL完全一致。</p></div>)}
  </section>
}
