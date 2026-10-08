'use client'
import { useEffect, useRef, useState } from 'react'
import { studyRequest } from './client'
import { formatPracticeTime, TIMING_STAGES } from './practiceTiming'
import type { ExamAnalysisView } from './examAnalysis'
import { localExamAnalysisKey, readLocalExamAnalysis, saveLocalExamAnalysis, type LocalExamAnalysis } from './localExamAnalysis'
import styles from './study.module.css'
const labels: Record<string, string> = { WRITING: '写作', LISTENING: '听力', READING: '阅读', TRANSLATION: '翻译' }
export default function ExamAnalysisPanel({ accountId, attemptId, completedEligible, timingReady = true }: { accountId: string; attemptId: string; completedEligible: boolean; timingReady?: boolean }) {
  const [local, setLocal] = useState<LocalExamAnalysis | null>(null)
  const localRef = useRef<LocalExamAnalysis | null>(null)
  const [view, setView] = useState<ExamAnalysisView | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const scope = `${accountId}:${attemptId}`, active = useRef(scope), sending = useRef(false), requestVersion = useRef(0)
  active.current = scope
  const path = `/api/study/exams/attempts/${encodeURIComponent(attemptId)}/analysis`
  async function receive(result: ExamAnalysisView, version: number) {
    if (active.current !== scope || version !== requestVersion.current) return
    setView(result)
    const key = localExamAnalysisKey(accountId, result.paperKey)
    let saved = readLocalExamAnalysis(localStorage, key)
    if (result.report && result.deliveryToken) {
      saved = { report: result.report, token: result.deliveryToken }
      // Keep the received report in memory if storage fails; retry persistence, not the model.
      localRef.current = saved; setLocal(saved)
      saveLocalExamAnalysis(localStorage, key, saved)
    }
    saved ??= localRef.current
    localRef.current = saved; setLocal(saved)
    if (saved?.token && !['EXHAUSTED', 'LOCKED'].includes(result.status)) {
      saveLocalExamAnalysis(localStorage, key, saved)
      const confirmed = await studyRequest<ExamAnalysisView>(accountId, path, { method: 'PATCH', body: JSON.stringify({ token: saved.token }) })
      if (active.current !== scope || version !== requestVersion.current) return
      saved = { report: saved.report }
      saveLocalExamAnalysis(localStorage, key, saved)
      localRef.current = saved; setLocal(saved); setView(confirmed)
    }
  }
  useEffect(() => {
    const version = ++requestVersion.current
    setView(null); setError(''); setBusy(false); sending.current = false
    localRef.current = null; setLocal(null)
    if (!completedEligible) return
    const controller = new AbortController()
    void studyRequest<ExamAnalysisView>(accountId, path, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) return receive(result, version) })
      .catch(failure => { if (!controller.signal.aborted && version === requestVersion.current) setError(failure instanceof Error ? failure.message : '分析记录未加载') })
    return () => controller.abort()
    // receive operates on this effect's account/attempt; async results are version checked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, path, completedEligible, timingReady])
  async function run() {
    if (sending.current || !completedEligible || !timingReady || !view) return
    const version = ++requestVersion.current
    sending.current = true; setBusy(true); setError('')
    try {
      if (localRef.current?.token) { await receive(view, version); return }
      const checking = ['RUNNING', 'AWAITING_ACK', 'COMPLETE', 'EXHAUSTED'].includes(view.status)
      if (!checking) {
        const probe = `${localExamAnalysisKey(accountId, view.paperKey)}:probe`
        localStorage.setItem(probe, '1')
        if (localStorage.getItem(probe) !== '1') throw new Error('请先允许浏览器使用本地存储，再生成分析')
        localStorage.removeItem(probe)
      }
      const result = await studyRequest<ExamAnalysisView>(accountId, path, checking ? {} : { method: 'POST' })
      await receive(result, version)
    } catch (failure) { if (active.current === scope && version === requestVersion.current) setError(failure instanceof Error ? failure.message : '分析暂未成功') }
    finally { if (active.current === scope && version === requestVersion.current) { sending.current = false; setBusy(false) } }
  }
  return <section className={styles.feedback} aria-label="整卷学习分析">
    <strong>整卷学习分析</strong>
    <p className={styles.subtle}>同一套试卷的四个模块全部作答后可分析，支持分次完成专项练习。AI 建议仅供学习参考。</p>
    {!completedEligible ? <p>请完成写作、听力、阅读和翻译的全部作答。</p> : <>
      {view && view.status !== 'LOCKED' && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {view.stats.modules.map(item => <p key={item.stage}><strong>{labels[item.stage]}</strong> · {item.total ? `${item.correct}/${item.total} 正确（${Math.round(item.correct / item.total * 100)}%）` : item.words ? `${item.words} 词` : '暂无可评分题目'}{item.ungraded > 0 && ` · ${item.ungraded} 题缺少评分依据`}</p>)}
        <p>客观题合计：{view.stats.correct}/{view.stats.total}{view.stats.total > 0 && `（${Math.round(view.stats.correct / view.stats.total * 100)}%）`}</p>
      </div>}
      {view?.timing && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="整套试卷用时汇总">
        {TIMING_STAGES.map(stage => <p key={stage}>{labels[stage]}用时：{view.timing!.modules[stage] > 0 ? formatPracticeTime(view.timing!.modules[stage]) : '未计时'}</p>)}
        <p><strong>总用时：{view.timing.tracked ? formatPracticeTime(view.timing.totalMs) : '未计时'}</strong></p>
        <p className={styles.subtle}>自主计时，仅统计已记录的用时。</p>
      </div>}
      {local?.report && <><p>{local.report.summary}</p><h4>薄弱点</h4><ul>{local.report.weaknesses.map((item, i) => <li key={i}>{item}</li>)}</ul><h4>练习建议</h4><ul>{local.report.suggestions.map((item, i) => <li key={i}>{item}</li>)}</ul><p className={styles.subtle}>已保存分析 · {new Date(local.report.generatedAt).toLocaleString('zh-CN')}</p></>}
      {(error || view?.error) && <p role="alert">{error || view?.error}</p>}
      {!timingReady && <p>请先保存本套试卷的计时记录。</p>}
      <p className={styles.subtle}>每个账号每套试卷成功分析一次；失败或中断最多尝试三次。正文仅保存在当前浏览器，清除数据或换设备后可能无法查看。</p>
      {view && <p>已使用 {view.attempts} / {view.maxAttempts} 次机会</p>}
      {view?.status === 'COMPLETE' && !local && <p>这套试卷已完成分析，当前浏览器没有分析正文，请在原浏览器查看。</p>}
      {view?.status === 'AWAITING_ACK' && !local && <p>分析结果尚未在本地确认。如请求中断，请稍后查看状态，系统会恢复剩余尝试机会。</p>}
      {view?.status !== 'LOCKED' && view?.status !== 'EXHAUSTED' && (view?.status !== 'COMPLETE' || !!local?.token) && <button className={styles.textButton} disabled={busy || !timingReady || !view} onClick={() => void run()}>{busy ? '处理中…' : local?.token ? '重试保存分析' : ['RUNNING', 'AWAITING_ACK'].includes(view?.status ?? '') ? '查看分析状态' : view?.status === 'FAILED' ? '重试分析' : '生成学习分析'}</button>}

    </>}
  </section>
}
