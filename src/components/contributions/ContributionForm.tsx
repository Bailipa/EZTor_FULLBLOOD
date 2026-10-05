'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Plus } from 'lucide-react'

type Kind = 'NEW' | 'CORRECTION'
type Receipt = {
  id: string; kind: Kind; word: string; translation: string; question: string | null
  status: string; reason: string | null; points: number; retryable: boolean
}
const labels: Record<string, string> = {
  PROCESSING: '审核中', APPROVED: '已通过', REJECTED: '未通过', DUPLICATE: '已有记录',
  STALE: '词条已更新', ERROR: '等待重试', VOID: '已作废',
}

export default function ContributionForm({ onUpdated, correctionWord, compact = false, inDialog = false }: { onUpdated: () => Promise<void>; correctionWord?: string; compact?: boolean; inDialog?: boolean }) {
  const searchCorrect = useSearchParams().get('correct') || ''
  const correct = correctionWord ?? searchCorrect
  const [open, setOpen] = useState(Boolean(correct || inDialog))
  const [kind, setKind] = useState<Kind>(correct ? 'CORRECTION' : 'NEW')
  const [word, setWord] = useState(correct)
  const [translation, setTranslation] = useState('')
  const [question, setQuestion] = useState('')
  const [current, setCurrent] = useState<{ word: string; translation: string } | null>(null)
  const [lookupMessage, setLookupMessage] = useState('')
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [result, setResult] = useState<Receipt | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const request = useRef<{ key: string; id: string } | null>(null)
  const lookupSequence = useRef(0)

  useEffect(() => {
    if (correct) { setOpen(true); setKind('CORRECTION'); setWord(correct) }
  }, [correct])

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/contributions/submissions')
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.error || '提交记录加载失败')
    setReceipts(json.data)
    return json.data as Receipt[]
  }, [])

  useEffect(() => { void loadHistory().catch(() => setError('提交记录加载失败，请重试')) }, [loadHistory])

  const pending = receipts.some((row) => row.status === 'PROCESSING' && !row.retryable)
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => {
      void loadHistory().then((rows) => {
        if (result?.status === 'PROCESSING') {
          const latest = rows.find((row) => row.id === result.id)
          if (latest && latest.status !== 'PROCESSING') { setResult(latest); void onUpdated() }
        }
        if (!rows.some((row) => row.status === 'PROCESSING')) void onUpdated()
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [pending, loadHistory, result, onUpdated])

  useEffect(() => {
    const sequence = ++lookupSequence.current
    setCurrent(null)
    setLookupMessage('')
    if (!open || kind !== 'CORRECTION' || !word.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLookupMessage('正在查找原释义…')
      void fetch(`/api/contributions/submissions?word=${encodeURIComponent(word)}`, { signal: controller.signal })
        .then(async (res) => {
          const json = await res.json()
          if (!res.ok || !json.success) throw new Error(json.error || '查找失败')
          if (sequence !== lookupSequence.current) return
          setCurrent(json.data)
          setLookupMessage(json.data ? '' : '公共词库未找到此词条，可改为新增词条。')
        }).catch((cause) => {
          if (!controller.signal.aborted && sequence === lookupSequence.current) setLookupMessage(cause instanceof Error ? cause.message : '查找失败')
        })
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [word, kind, open, result?.status])

  const send = async (payload: { id: string; kind: Kind; word: string; translation: string; question: string | null }) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/contributions/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.data) setResult(json.data)
      if (!json.data && (!res.ok || !json.success)) throw new Error(json.error || '提交失败')
      await loadHistory()
      if (json.data?.status === 'APPROVED') await onUpdated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '连接中断，内容已保留。请刷新提交记录查看结果后重试。')
    } finally { setBusy(false) }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const data = { kind, word: word.trim(), translation: translation.trim(), question: kind === 'CORRECTION' ? question.trim() : null }
    const key = JSON.stringify(data)
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
    void send({ ...data, id: request.current.id })
  }

  return (
    <Card className={compact || inDialog ? 'border-0 bg-transparent py-0 shadow-none' : undefined}>
      <CardContent className={compact || inDialog ? 'space-y-4 p-0' : 'space-y-4 p-4 sm:p-6'}>
        {!compact && !inDialog && <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">{kind === 'CORRECTION' ? '说说你的疑问' : '一起完善词库'}</h2><p className="mt-1 text-sm text-muted-foreground">{kind === 'CORRECTION' ? '先看看当前释义，再告诉我们哪里让你困惑，以及你认为正确的内容。' : '新增词条或完善释义，通过审核后贡献 +1'}</p></div>
          <Button onClick={() => setOpen((value) => !value)} aria-expanded={open}><Plus className="size-4" />{open ? '收起表单' : '我要贡献'}</Button>
        </div>}
        {open && (
          <form onSubmit={submit} className={compact || inDialog ? 'space-y-4' : 'space-y-4 border-t pt-4'}>
            {!compact && <div className="flex gap-2" role="group" aria-label="贡献类型">
              {([['NEW', '新增词条'], ['CORRECTION', '释义疑问']] as const).map(([value, label]) => (
                <Button key={value} type="button" variant={kind === value ? 'default' : 'outline'} aria-pressed={kind === value} disabled={busy} onClick={() => { setKind(value); setResult(null) }}>{label}</Button>
              ))}
            </div>}
            {!compact && <label className="block space-y-2 text-sm font-medium"><span>英文单词 / 词组</span>
              <Input required maxLength={80} value={word} disabled={busy} onChange={(event) => { setWord(event.target.value); setResult(null) }} placeholder="例如 serendipity" />
            </label>}
            {kind === 'CORRECTION' && (
              <div className="space-y-2">
                {current && <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="mb-1 text-xs text-muted-foreground">当前释义 · {current.word}</p><p className="whitespace-pre-wrap break-words">{current.translation}</p></div>}
                {lookupMessage && <p className="text-sm text-muted-foreground">{lookupMessage}</p>}
                <label className="block space-y-2 text-sm font-medium"><span>哪里有疑问？</span><textarea required minLength={4} maxLength={1000} rows={3} value={question} disabled={busy} onChange={(event) => setQuestion(event.target.value)} className="w-full rounded-md border bg-background p-3" placeholder="例如：这个词在例句中的意思，似乎与这里的释义不同……" /></label>
              </div>
            )}
            <label className="block space-y-2 text-sm font-medium"><span>{kind === 'NEW' ? '中文释义' : '你认为正确的释义'}</span><textarea required minLength={2} maxLength={1500} rows={3} value={translation} disabled={busy} onChange={(event) => setTranslation(event.target.value)} className="w-full rounded-md border bg-background p-3" placeholder={kind === 'NEW' ? '填写准确的中文释义' : '写下你认为正确的完整释义，保留原有的正确义项'} /></label>
            <Button type="submit" disabled={busy || (kind === 'CORRECTION' && !current)}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? '正在审核…' : kind === 'CORRECTION' ? '提交疑问' : '提交审核'}</Button>
          </form>
        )}
        {result && <div role="status" className="space-y-1 rounded-lg border p-3 text-sm"><p className="font-medium">{labels[result.status] || result.status}{result.points > 0 && result.status === 'APPROVED' ? ` · 贡献 +${result.points}` : ''}</p><p className="break-words text-muted-foreground">{result.reason || '审核完成后会保存在提交记录中。'}</p></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!compact && <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}>{showHistory ? '收起提交记录' : '我的提交'}</Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setError(''); void loadHistory().then(() => onUpdated()).catch(() => setError('记录加载失败，请稍后重试')) }}>刷新记录</Button>
        </div>}
        {showHistory && (
          <ul className="max-h-96 space-y-3 overflow-y-auto border-t pt-4" aria-label="最近 20 次提交">
            {!receipts.length && <li className="text-sm text-muted-foreground">还没有提交记录。</li>}
            {receipts.map((row) => <li key={row.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-medium break-words">{row.word} · {row.kind === 'NEW' ? '新增' : '纠错'}</span><span>{labels[row.status] || row.status}{row.status === 'APPROVED' && row.points ? ' · +1' : ''}</span></div>
              <p className="break-words text-muted-foreground">{row.reason || '审核中，可离开页面，稍后查看结果。'}</p>
              {row.retryable && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void send({ id: row.id, kind: row.kind, word: row.word, translation: row.translation, question: row.question }) }}>重试审核</Button>}
            </li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
