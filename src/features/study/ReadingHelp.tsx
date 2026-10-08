'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ReadingMark } from './examTypes'
import styles from './exam.module.css'

export default function ReadingHelp({ mark, mode, title, context, onClose, onPrepare }: {
  mark: ReadingMark; mode: 'translate' | 'ask'; title: string; context: string
  onClose: () => void; onPrepare: () => Promise<boolean | void>
}) {
  const [question, setQuestion] = useState('这段话在文中是什么意思？')
  const [answer, setAnswer] = useState('')
  const [answerSource, setAnswerSource] = useState<'PUBLIC' | 'AI' | null>(null)
  const [contributionNotice, setContributionNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const sending = useRef(false)
  const sendRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (mode !== 'translate') return
    const timer = window.setTimeout(() => void sendRef.current(), 0)
    return () => window.clearTimeout(timer)
  }, [mode])
  async function send() {
    if (busy || sending.current) return
    sending.current = true
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(''); setAnswer(''); setAnswerSource(null); setContributionNotice('')
    try {
      if (!await onPrepare()) throw new Error('辅助使用记录未保存，请先同步练习进度后重试。')
      if (request.signal.aborted) return
      if (mode === 'translate') {
        const publicResponse = await fetch('/api/public-translate', {
          method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words: [mark.text] }),
        })
        const publicBody = await publicResponse.json()
        if (!publicResponse.ok || !publicBody.success) throw new Error(publicBody.error || '公共词库暂时无法查询，请重试')
        const publicMeaning = publicBody.data?.results?.[0]?.translation
        if (typeof publicMeaning === 'string' && publicMeaning.trim()) {
          setAnswer(publicMeaning)
          setAnswerSource('PUBLIC')
          return
        }
      }
      const response = await fetch(mode === 'translate' ? '/api/translate-only' : '/api/ai/ask', {
        method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'translate' ? { input: mark.text } : { messages: [{ role: 'user', content: `我在练习英语阅读，请结合上下文解答。试卷：${title}\n选中文字：${mark.text}\n上下文：${context}\n问题：${question}` }] }),
      })
      if (mode === 'translate' || !response.ok) {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || '暂时无法获取解释，请重试')
        const translation = body.data.translation as string
        setAnswer(translation)
        if (mode === 'translate') {
          setAnswerSource('AI')
          const candidate = mark.text.trim().replace(/’/g, "'")
          if (/^[\p{Script=Latin}\p{M}]+(?:['-][\p{Script=Latin}\p{M}]+)*$/u.test(candidate)) {
            setContributionNotice('正在登记贡献…')
            try {
              const contribution = await fetch('/api/contributions/submissions', {
                method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: crypto.randomUUID(), kind: 'NEW', word: candidate.toLowerCase(), translation, question: null }),
              })
              const result = await contribution.json()
              if (!contribution.ok || !result.success) throw new Error(result.error || '提交失败')
              const submission = result.data
              if (submission?.status === 'APPROVED' && submission.points > 0) {
                setContributionNotice('恭喜你找到了一个当前公共词库没有的单词！贡献值+1')
              } else if (submission?.status === 'PROCESSING') {
                setContributionNotice('恭喜你找到了一个当前公共词库没有的单词！正在审核，审核通过后贡献值+1。')
              } else if (submission?.status === 'DUPLICATE' || submission?.status === 'APPROVED') {
                setContributionNotice('这个单词已被收录，本次没有新增贡献值。')
              } else {
                setContributionNotice('已发现词库缺词，但自动审核未通过，本次未获得贡献值。')
              }
            } catch {
              if (!request.signal.aborted) setContributionNotice('释义已显示，但贡献登记未成功。')
            }
          }
        }
        return
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取 AI 解答，请重试')
      const decoder = new TextDecoder()
      let buffer = '', text = '', finished = false
      const parse = (part: string) => {
        const event = part.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim()
        const data = part.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
        if (!data) return
        const payload = JSON.parse(data)
        if (event === 'error') throw new Error(payload.error || 'AI 暂不可用，请重试')
        if (event === 'text') text = payload.delta ? text + payload.text : payload.text
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
        if (buffer.trim()) parse(buffer)
        if (!finished || !text.trim()) throw new Error('解答中断，请重试')
        if (!request.signal.aborted) setAnswer(text)
      } finally { await reader.cancel().catch(() => {}) }
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : '请求失败，请重试')
    } finally { sending.current = false; if (!request.signal.aborted) setBusy(false) }
  }
  sendRef.current = send
  return <Dialog open onOpenChange={(open) => { if (!open) { controller.current?.abort(); onClose() } }}><DialogContent className={styles.helpDialog}>
    <DialogTitle>{mode === 'translate' ? '查看释义' : '阅读提问'}</DialogTitle>
    <DialogDescription>保留阅读位置；本次使用辅助会记录到练习档案。</DialogDescription>
    <blockquote className={styles.selectedText}>{mark.text}</blockquote>
    {mode === 'ask' && <label className={styles.textAnswer}>你的问题<textarea value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} placeholder="哪里不理解？" /></label>}
    {(mode === 'ask' || !answer) && <Button disabled={busy || (mode === 'ask' && !question.trim())} onClick={() => void send()}>{busy ? contributionNotice.startsWith('正在登记') ? '正在登记贡献…' : '正在获取解释…' : answer ? '重新解答' : mode === 'translate' ? '查看翻译' : '提问'}</Button>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {answer && <div className={styles.helpAnswer}>{answer}{answerSource && <small className={styles.helpSource}>{answerSource === 'PUBLIC' ? '公共词库' : 'AI 补充释义'}</small>}</div>}
    {contributionNotice && <p role="status" className="text-sm text-muted-foreground">{contributionNotice}</p>}
  </DialogContent></Dialog>
}
