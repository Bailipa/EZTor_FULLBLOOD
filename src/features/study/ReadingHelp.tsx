'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ReadingMark } from './examTypes'
import styles from './exam.module.css'

export default function ReadingHelp({ mark, onClose, onPrepare }: {
  mark: ReadingMark
  onClose: () => void; onPrepare: () => Promise<boolean | void>
}) {
  const [answer, setAnswer] = useState('')
  const [answerSource, setAnswerSource] = useState<'PUBLIC' | 'AI' | null>(null)
  const [contributionNotice, setContributionNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const controller = useRef<AbortController | null>(null)
  const sending = useRef(false)
  const sendRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    const timer = window.setTimeout(() => void sendRef.current(), 0)
    return () => window.clearTimeout(timer)
  }, [])
  async function send() {
    if (busy || sending.current) return
    sending.current = true
    const request = new AbortController()
    controller.current = request
    setBusy(true); setProgress('正在准备翻译…'); setError(''); setAnswer(''); setAnswerSource(null); setContributionNotice('')
    try {
      if (!await onPrepare()) throw new Error('辅助使用记录未保存，请先同步练习进度后重试。')
      if (request.signal.aborted) return
      const candidate = mark.text.trim().replace(/’/g, "'")
      const singleWord = /^[\p{Script=Latin}\p{M}]+(?:['-][\p{Script=Latin}\p{M}]+)*$/u.test(candidate)
      if (singleWord) {
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
      setProgress('正在翻译所选文字…')
      const response = await fetch('/api/translate-only', {
        method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: mark.text }),
      })
      {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error || '暂时无法获取翻译，请重试')
        const translation = body.data.translation as string
        setAnswer(translation)
        {
          setAnswerSource('AI')
          if (singleWord) {
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
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : '请求失败，请重试')
    } finally { sending.current = false; if (!request.signal.aborted) setBusy(false) }
  }
  sendRef.current = send
  return <Dialog open onOpenChange={(open) => { if (!open) { controller.current?.abort(); onClose() } }}><DialogContent className={styles.helpDialog}>
    <DialogTitle>翻译</DialogTitle>
    <DialogDescription>仅翻译你选中的文字。本次使用翻译会记录到练习档案。</DialogDescription>
    <blockquote className={styles.selectedText}>{mark.text}</blockquote>
    {busy && <p role="status" className="text-sm font-medium text-primary">{progress}</p>}
    {error && <div role="alert" className={styles.error}>{error}<Button variant="outline" size="sm" disabled={busy} onClick={() => void send()}>重试翻译</Button></div>}
    {answer && <div className={styles.helpAnswer} aria-busy={busy}>{answer}{answerSource && <small className={styles.helpSource}>{answerSource === 'PUBLIC' ? '公共词库' : 'AI 翻译'}</small>}</div>}
    {contributionNotice && <p role="status" className="rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{contributionNotice}</p>}
  </DialogContent></Dialog>
}
