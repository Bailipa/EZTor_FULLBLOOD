'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { studyRequest } from './client'
import { chinaDay } from './domain'
import { scoreEvidence, type ScoreEvidenceLevel, type ScoreEvidenceRecord } from './scoreEvidence'
import styles from './study.module.css'

type SavedScore = ScoreEvidenceRecord & { id: string; paper: string }
type ScoresResponse = { records: SavedScore[]; evidence: ReturnType<typeof scoreEvidence> }
type Mutation = { clientId: string; type: 'ADD'; score: number; takenDateISO: string; level: ScoreEvidenceLevel; source: 'MOCK' | 'OFFICIAL'; assisted: boolean; paper: string }
  | { clientId: string; type: 'RETRACT'; id: string }

export default function ScoreEvidencePanel({ accountId, level, onChanged }: {
  accountId: string
  level: ScoreEvidenceLevel
  onChanged(): void
}) {
  const [data, setData] = useState<ScoresResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [score, setScore] = useState('')
  const [takenDateISO, setTakenDateISO] = useState(() => chinaDay())
  const [source, setSource] = useState<'MOCK' | 'OFFICIAL'>('MOCK')
  const [assisted, setAssisted] = useState(false)
  const [paper, setPaper] = useState('')
  const [busy, setBusy] = useState(false)
  const [canRetry, setCanRetry] = useState(false)
  const accountRef = useRef(accountId)
  accountRef.current = accountId
  const mounted = useRef(false)
  const getController = useRef<AbortController | null>(null)
  const mutationController = useRef<AbortController | null>(null)
  const mutationBusy = useRef(false)
  const pendingMutation = useRef<Mutation | null>(null)

  const loadScores = useCallback(async () => {
    const owner = accountId
    if (!mounted.current || accountRef.current !== owner) return
    getController.current?.abort()
    const controller = new AbortController()
    getController.current = controller
    setError('')
    try {
      const result = await studyRequest<ScoresResponse>(owner, '/api/study/scores', { signal: controller.signal })
      if (mounted.current && accountRef.current === owner && !controller.signal.aborted) setData(result)
    } catch (failure) {
      if (mounted.current && accountRef.current === owner && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : '成绩记录暂不可用')
    } finally {
      if (mounted.current && accountRef.current === owner && !controller.signal.aborted) setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    mounted.current = true
    setData(null)
    setError('')
    setLoading(true)
    setDialogOpen(false)
    setBusy(false)
    setCanRetry(false)
    setScore('')
    setTakenDateISO(chinaDay())
    setSource('MOCK')
    setAssisted(false)
    setPaper('')
    void loadScores()
    return () => {
      mounted.current = false
      getController.current?.abort()
      mutationController.current?.abort()
      pendingMutation.current = null
      mutationBusy.current = false
    }
  }, [loadScores])

  const sendMutation = async (action?: Mutation) => {
    if (mutationBusy.current) return
    if (action) pendingMutation.current = action
    const pending = pendingMutation.current
    if (!pending || !mounted.current || accountRef.current !== accountId) return
    const owner = accountId
    mutationBusy.current = true
    setBusy(true)
    setError('')
    const controller = new AbortController()
    mutationController.current = controller
    try {
      await studyRequest<ScoresResponse>(owner, '/api/study/scores', {
        method: 'POST', body: JSON.stringify(pending), signal: controller.signal,
      })
      if (mounted.current && accountRef.current === owner && !controller.signal.aborted) {
        pendingMutation.current = null
        setCanRetry(false)
        setDialogOpen(false)
        setScore('')
        setTakenDateISO(chinaDay())
        setSource('MOCK')
        setAssisted(false)
        setPaper('')
        await loadScores()
        if (mounted.current && accountRef.current === owner && !controller.signal.aborted) onChanged()
      }
    } catch (failure) {
      if (mounted.current && accountRef.current === owner && !controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : '保存失败，请重试')
        setCanRetry(true)
      }
    } finally {
      if (mutationController.current === controller) {
        mutationBusy.current = false
        if (mounted.current && accountRef.current === owner) setBusy(false)
      }
    }
  }

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pendingMutation.current || busy) return
    const numericScore = Number(score)
    if (!Number.isInteger(numericScore) || numericScore < 0 || numericScore > 710 || !paper.trim() || paper.trim().length > 120) {
      setError('请填写 0–710 的整数总分和完整试卷名称（最多 120 字）')
      return
    }
    void sendMutation({ clientId: crypto.randomUUID(), type: 'ADD', score: numericScore, takenDateISO, level, source, assisted, paper: paper.trim() })
  }

  const displayedMocks = data?.evidence.sampleCount ?? 0
  const official = data?.evidence.officialHistory ?? []

  return <section className={`${styles.panel} ${styles.workspace}`} aria-label="模考分数证据">
    <div className={styles.toolbar}>
      <h3>目标达成参考</h3>
      <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>记录成绩</Button>
    </div>
    <p className={styles.subtle}>这里只显示自报完整模考的观察达标比例与样本范围，不是未来通过率。至少 5 次模考才显示比例（产品显示门槛，无官方背书）；官方成绩仅作历史记录。</p>
    {error && !dialogOpen && <div className={styles.error} role="alert">{error}{canRetry && <button className={styles.textButton} disabled={busy} onClick={() => void sendMutation()}>用原记录重试</button>}{!canRetry && !loading && <button className={styles.textButton} onClick={() => void loadScores()}>重试读取</button>}</div>}
    {loading && <p className={styles.empty} role="status">正在读取成绩记录…</p>}
    {!loading && data && <>
      {data.evidence.status === 'observed' ? <div className={styles.evidence}>
        <div><strong>{Math.round(data.evidence.observedRate * 100)}%</strong>观察达标比例</div>
        <div><strong>{data.evidence.sampleCount}</strong>近90天完整模考</div>
        <div><strong>{Math.round(data.evidence.wilson95.lower * 100)}–{Math.round(data.evidence.wilson95.upper * 100)}%</strong>Wilson 95% 区间</div>
        <div><strong>{Math.round(data.evidence.meanScore)}</strong>模考平均总分</div>
      </div> : <p className={styles.subtle}>当前有 {displayedMocks} 次符合条件的完整模考；至少记录 5 次后显示观察达标比例。</p>}
      {data.records.length > 0 && <div className={styles.archive}>
        {data.records.map((record) => <div key={record.id} className={styles.goal}>
          <div><strong>{record.source === 'OFFICIAL' ? '自报官方成绩' : '自报完整模考'} · {record.score} 分</strong><p className={styles.subtle}>{record.level === 'CET4' ? '四级' : '六级'} · {record.takenDateISO} · {record.paper}{record.assisted ? ' · 使用辅助' : ''}</p></div>
          <button className={styles.textButton} type="button" disabled={busy || canRetry} onClick={() => void sendMutation({ clientId: crypto.randomUUID(), type: 'RETRACT', id: record.id })}>撤回</button>
        </div>)}
      </div>}
      {official.length > 0 && <p className={styles.subtle}>官方历史成绩 {official.length} 条，未计入近期模考观察。</p>}
    </>}
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!busy) setDialogOpen(open) }}>
      <DialogContent className={`${styles.workspace} max-h-[85dvh] overflow-y-auto sm:max-w-xl`}>
        <DialogTitle>记录总分</DialogTitle>
        <DialogDescription>记录完整试卷的自报成绩。请按原试卷级别与日期填写。</DialogDescription>
        <form className={styles.form} onSubmit={add}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <label>总分（0–710）<input type="number" min="0" max="710" step="1" required value={score} disabled={busy || canRetry} onChange={(event) => setScore(event.target.value)} /></label>
          <label>考试日期<input type="date" required value={takenDateISO} disabled={busy || canRetry} onChange={(event) => setTakenDateISO(event.target.value)} /></label>
          <label>级别<select value={level} disabled><option value="CET4">CET4</option><option value="CET6">CET6</option></select></label>
          <label>成绩来源<select value={source} disabled={busy || canRetry} onChange={(event) => setSource(event.target.value as 'MOCK' | 'OFFICIAL')}><option value="MOCK">自报完整模考</option><option value="OFFICIAL">官方成绩</option></select></label>
          <label>完整试卷名称<input type="text" maxLength={120} required value={paper} disabled={busy || canRetry} onChange={(event) => setPaper(event.target.value)} placeholder="例如：2025年12月 CET4 第1套" /></label>
          <label><span><input type="checkbox" checked={assisted} disabled={busy || canRetry} onChange={(event) => setAssisted(event.target.checked)} /> 本次使用了查词、答案提示等辅助</span></label>
          <div className={styles.actions}><Button type="submit" disabled={busy || canRetry}>{busy ? '正在保存…' : '保存成绩'}</Button>{canRetry && <><Button type="button" variant="outline" disabled={busy} onClick={() => void sendMutation()}>用原记录重试</Button><button type="button" className={styles.textButton} disabled={busy} onClick={async () => { await loadScores(); pendingMutation.current = null; setCanRetry(false) }}>核对记录后重新填写</button></>}</div>
        </form>
      </DialogContent>
    </Dialog>
  </section>
}
