'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ReadingMark } from './examTypes'
import styles from './exam.module.css'

export default function ExamReviewAssistant({ attemptId, marks }: { attemptId: string; marks: ReadingMark[] }) {
  const [selection, setSelection] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function ask() {
    if (controller.current || !question.trim()) return
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(''); setAnswer(''); setProgress('正在连接 AI…')
    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: question.trim() }], examReview: { attemptId, question: question.trim(), selection: selection.trim() } }),
      })
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || '暂时无法答疑，请重试')
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取 AI 回复')
      const decoder = new TextDecoder()
      let buffer = '', text = '', finished = false
      const parse = (part: string) => {
        const lines = part.split('\n')
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim()
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
        if (!data) return
        const payload = JSON.parse(data)
        if (event === 'error') throw new Error(payload.error || 'AI 暂不可用')
        if (event === 'status') setProgress(payload.text)
        if (event === 'text') { text = payload.delta ? text + payload.text : payload.text; setAnswer(text); setProgress('正在生成回答…') }
        if (event === 'done') finished = payload.success === true
      }
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n')
          let boundary
          while ((boundary = buffer.indexOf('\n\n')) >= 0) { parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2) }
        }
        buffer += decoder.decode()
        if (buffer.trim()) parse(buffer)
        if (!finished || !text.trim()) throw new Error('回答中断，已生成内容保留，可重新提问')
      } finally { await reader.cancel().catch(() => {}) }
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : '请求失败，请重试')
    } finally {
      if (controller.current === request) controller.current = null
      if (!request.signal.aborted) setBusy(false)
    }
  }
  return <details className={styles.feedback}>
    <summary>练习后 AI 答疑</summary>
    <p className={styles.note}>本次练习已提交。只发送你的问题和主动填写的片段，不附带文章上下文。</p>
    {!!marks.length && <div className={styles.actions} aria-label="选用已标记片段">{marks.map(mark => <Button key={`${mark.passageId}:${mark.start}:${mark.end}`} variant="outline" size="sm" disabled={busy} onClick={() => setSelection(mark.text.slice(0, 2000))} title={mark.text}>{mark.text.length > 26 ? `${mark.text.slice(0, 26)}…` : mark.text}</Button>)}</div>}
    <label className={styles.textAnswer}>原文片段（可选）<textarea value={selection} disabled={busy} maxLength={2000} onChange={event => setSelection(event.target.value)} placeholder="粘贴需要讲解的原文，或选择上方标记" /></label>
    <label className={styles.textAnswer}>你的问题<textarea value={question} disabled={busy} maxLength={500} onChange={event => setQuestion(event.target.value)} placeholder="想理解哪个词义、句式或解题思路？" /></label>
    <Button disabled={busy || !question.trim()} onClick={() => void ask()}>{busy ? '正在答疑…' : '询问 AI'}</Button>
    {busy && <p role="status" className="text-sm font-medium text-primary">{progress}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {answer && <div className={styles.helpAnswer} aria-busy={busy}>{answer}</div>}
  </details>
}
