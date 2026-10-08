'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ExamPaperMetadata } from './examTypes'
import styles from './exam-paper-picker.module.css'

type Props = {
  papers: ExamPaperMetadata[]
  currentPaperId?: string
  busy: boolean
  blocked?: boolean
  actionLabel: string
  busyLabel: string
  onConfirm: (paperId: string) => void
  onCancel?: () => void
}

function paperYear(paper: ExamPaperMetadata) {
  return paper.slug.match(/^cet[46]-(\d{4})-/)?.[1] ?? paper.title.match(/\b(20\d{2})年/)?.[1] ?? ''
}

export default function ExamPaperPicker({ papers, currentPaperId, busy, blocked, actionLabel, busyLabel, onConfirm, onCancel }: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [year, setYear] = useState('ALL')
  const [level, setLevel] = useState('ALL')
  const [selectedId, setSelectedId] = useState('')
  const years = [...new Set(papers.map(paperYear).filter(Boolean))].sort().reverse()
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const visible = papers.filter((paper) => {
    const text = `${paper.title} ${paper.slug} ${paper.level === 'CET4' ? '四级' : '六级'}`.toLocaleLowerCase()
    return (year === 'ALL' || paperYear(paper) === year) && (level === 'ALL' || paper.level === level) && terms.every((term) => text.includes(term))
  }).sort((a, b) => paperYear(b).localeCompare(paperYear(a)) || a.title.localeCompare(b.title, 'zh-CN', { numeric: true }))
  const selected = visible.find((paper) => paper.id === selectedId && paper.id !== currentPaperId)
  const reset = () => { setQuery(''); setYear('ALL'); setLevel('ALL'); setSelectedId('') }

  return <div className={styles.picker} aria-busy={busy}>
    <div className={styles.filters}>
      <label className={styles.search} htmlFor={`${id}-search`}>搜索试卷<input id={`${id}-search`} type="search" placeholder="年份、月份、卷别，例如 2024 6月" value={query} disabled={busy} onChange={(event) => { setQuery(event.target.value); setSelectedId('') }} /></label>
      {currentPaperId && <label htmlFor={`${id}-level`}>级别<select id={`${id}-level`} value={level} disabled={busy} onChange={(event) => { setLevel(event.target.value); setSelectedId('') }}><option value="ALL">全部级别</option><option value="CET4">四级</option><option value="CET6">六级</option></select></label>}
      <label htmlFor={`${id}-year`}>年份<select id={`${id}-year`} value={year} disabled={busy} onChange={(event) => { setYear(event.target.value); setSelectedId('') }}><option value="ALL">全部年份</option>{years.map((value) => <option key={value} value={value}>{value} 年</option>)}</select></label>
    </div>
    <div className={styles.summary}><span role="status">{visible.length} / {papers.length} 套试卷</span>{(query || year !== 'ALL' || level !== 'ALL') && <button type="button" disabled={busy} onClick={reset}>清除筛选</button>}</div>
    <div className={styles.list} role="group" aria-label="选择试卷">
      {visible.map((paper) => {
        const current = paper.id === currentPaperId
        return <label key={paper.id} className={styles.card} data-selected={selected?.id === paper.id} data-current={current}>
          <input type="radio" name={`${id}-paper`} value={paper.id} checked={selected?.id === paper.id} disabled={busy || current} onChange={() => setSelectedId(paper.id)} />
          <span className={styles.cardBody}><span className={styles.cardMeta}>{paper.level === 'CET4' ? '四级 CET4' : '六级 CET6'}{current ? <span>正在作答</span> : selected?.id === paper.id ? <span>已选择</span> : null}</span><strong>{paper.title}</strong></span>
        </label>
      })}
      {!visible.length && <div className={styles.empty}><strong>没有找到符合条件的试卷</strong><p>试试其他关键词，或清除筛选查看全部试卷。</p><Button variant="outline" disabled={busy} onClick={reset}>查看全部试卷</Button></div>}
    </div>
    <div className={styles.footer}>
      <p>{selected ? `已选：${selected.title}` : '请选择一套试卷，再确认开始。'}</p>
      <div>{onCancel && <Button variant="outline" disabled={busy} onClick={onCancel}>继续当前试卷</Button>}<Button disabled={busy || blocked || !selected} onClick={() => { if (selected) onConfirm(selected.id) }}>{busy ? busyLabel : actionLabel}</Button></div>
    </div>
  </div>
}
