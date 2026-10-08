'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { chinaDay } from './domain'
import type { GoalView } from './types'
import { studyRequest } from './client'
import styles from './study.module.css'
import inputStyles from './study-input.module.css'

export default function GoalEditor({ accountId, goal, onClose, onSaved }: { accountId: string; goal: GoalView | null; onClose: () => void; onSaved: () => void }) {
  const [level, setLevel] = useState(goal?.level ?? 'CET4')
  const [examDate, setDate] = useState(goal?.examDate ?? '')
  const [score, setScore] = useState(String(goal?.targetScore ?? 425))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<{ level: string; examDate: string; targetScore: number; clientId: string } | null>(null)
  const sending = useRef(false)
  const composing = useRef(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (sending.current || composing.current) return
    sending.current = true; setBusy(true); setError('')
    const input = { level, examDate, targetScore: Number(score) }
    if (!pending.current || pending.current.level !== level || pending.current.examDate !== examDate || pending.current.targetScore !== input.targetScore) pending.current = { ...input, clientId: crypto.randomUUID() }
    try {
      await studyRequest(accountId, '/api/study/goal', { method: 'PUT', body: JSON.stringify(pending.current) })
      onSaved()
    } catch (failure) { setError(failure instanceof Error ? failure.message : '目标未保存，请重试') }
    finally { sending.current = false; setBusy(false) }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}><DialogContent className={`${styles.workspace} ${inputStyles.goalDialog}`}>
    <DialogTitle>{goal ? '调整备考目标' : '从你的目标开始'}</DialogTitle>
    <DialogDescription>设置一次，自动安排阅读。考试日期请按你的报名安排填写。</DialogDescription>
    <form className={styles.form} onSubmit={save} onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }} onKeyDown={(event) => {
      if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault()
    }}>
      <label>备考级别<select value={level} disabled={busy} onChange={(event) => setLevel(event.target.value as GoalView['level'])}><option value="CET4">大学英语四级</option><option value="CET6">大学英语六级</option></select></label>
      <label>考试日期<input type="date" required min={chinaDay()} value={examDate} disabled={busy} onChange={(event) => setDate(event.currentTarget.value)} onInput={(event) => setDate(event.currentTarget.value)} /></label>
      <label>目标分数<input type="number" inputMode="numeric" enterKeyHint="done" min={220} max={710} required value={score} disabled={busy} onChange={(event) => setScore(event.target.value)} /></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? '保存中…' : goal ? '保存目标' : '开始备考'}</Button>
      {goal && <p className={styles.subtle}>调整目标不会改写已有学习档案。进行中的文章保留开始时的目标。</p>}
    </form>
  </DialogContent></Dialog>
}
