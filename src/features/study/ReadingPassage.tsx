'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ReadingMark } from './examTypes'
import styles from './exam.module.css'

type WordToken = { start: number; end: number; text: string }
function words(text: string, start: number, highlights: Set<string>, tokens: WordToken[]): ReactNode[] {
  const parts: ReactNode[] = []
  let cursor = 0
  let first = 0, last = tokens.length
  while (first < last) {
    const middle = Math.floor((first + last) / 2)
    if (tokens[middle].end <= start) first = middle + 1
    else last = middle
  }
  for (let index = first; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.start >= start + text.length) break
    const offset = Math.max(token.start, start) - start
    const end = Math.min(token.end, start + text.length) - start
    parts.push(text.slice(cursor, offset))
    const highlighted = highlights.has(`${token.start}:${token.end}`)
    parts.push(<span role="button" tabIndex={0} aria-label={highlighted ? `${token.text}，再次点按取消荧光` : `${token.text}，点按查词并荧光标记`} aria-pressed={highlighted} key={`${start + offset}:${start + end}`} data-word-start={token.start} data-word-end={token.end} className={`${styles.lookupWord} ${highlighted ? styles.lookupHighlighted : ''}`}>{text.slice(offset, end)}</span>)
    cursor = end
  }
  parts.push(text.slice(cursor))
  return parts
}

export default function ReadingPassage({ passage, marks, highlights, disabled, onMark, onHighlight, onHelp, readOnly = false, focusMark }: {
  passage: { id: string; text: string }; marks: ReadingMark[]; highlights: ReadingMark[]; disabled: boolean
  readOnly?: boolean; focusMark?: ReadingMark
  onMark: (mark: ReadingMark, marked: boolean) => void
  onHighlight: (mark: ReadingMark, marked: boolean) => Promise<boolean | void>
  onHelp: (mark: ReadingMark, mode: 'translate' | 'ask') => void
}) {
  const article = useRef<HTMLElement>(null)
  const pointer = useRef({ x: 0, y: 0, at: 0 })
  const tapping = useRef(false)
  const [selection, setSelection] = useState<ReadingMark | null>(null)
  const tokens = useMemo(() => [...passage.text.matchAll(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)].map((word) => ({ start: word.index!, end: word.index! + word[0].length, text: word[0] })), [passage.text])
  const saved = useMemo(() => marks.filter((m) => m.passageId === passage.id).sort((a, b) => a.start - b.start), [marks, passage.id])
  const highlighted = useMemo(() => new Set(highlights.filter((mark) => mark.passageId === passage.id).map((mark) => `${mark.start}:${mark.end}`)), [highlights, passage.id])
  useEffect(() => {
    if (!focusMark || focusMark.passageId !== passage.id) return
    const node = article.current?.querySelector<HTMLElement>(`mark[data-mark-start="${focusMark.start}"][data-mark-end="${focusMark.end}"]`)
    node?.scrollIntoView({ block: 'center' })
    node?.focus({ preventScroll: true })
  }, [focusMark, passage.id])
  const marked = selection && saved.some((m) => m.start === selection.start && m.end === selection.end)
  const readSelection = useCallback(() => {
    const node = article.current, selected = window.getSelection()
    if (!node || !selected?.rangeCount || selected.isCollapsed) return
    const range = selected.getRangeAt(0)
    if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) return
    const prefix = range.cloneRange()
    prefix.selectNodeContents(node)
    prefix.setEnd(range.startContainer, range.startOffset)
    const raw = range.toString(), text = raw.trim()
    if (!text || text.length > 2000) return
    const start = prefix.toString().length + raw.indexOf(text)
    if (passage.text.slice(start, start + text.length) !== text) return
    setSelection((current) => current?.start === start && current.end === start + text.length ? current : { passageId: passage.id, start, end: start + text.length, text })
  }, [passage.id, passage.text])
  useEffect(() => {
    let frame = 0
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(readSelection) }
    document.addEventListener('selectionchange', update)
    return () => { document.removeEventListener('selectionchange', update); cancelAnimationFrame(frame) }
  }, [readSelection])
  const fragments = useMemo(() => {
    const parts: ReactNode[] = []
    let offset = 0
    for (const mark of saved) {
      parts.push(...words(passage.text.slice(offset, mark.start), offset, highlighted, tokens))
      parts.push(<mark key={`${mark.start}:${mark.end}`} data-mark-start={mark.start} data-mark-end={mark.end} data-focused={focusMark?.start === mark.start && focusMark.end === mark.end ? 'true' : undefined} tabIndex={0} role="group" aria-label={`已标记：${mark.text}，点击管理`} onClick={(event) => { if (!(event.target as HTMLElement).closest('[data-word-start]')) setSelection(mark) }} onKeyDown={(event) => { if ((event.target as HTMLElement).closest('[data-word-start]')) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection(mark) } }}>{words(mark.text, mark.start, highlighted, tokens)}</mark>)
      offset = mark.end
    }
    parts.push(...words(passage.text.slice(offset), offset, highlighted, tokens))
    return parts
  }, [saved, passage.text, focusMark, highlighted, tokens])
  const tapWord = async (word: HTMLElement) => {
    if (disabled || tapping.current) return
    const start = Number(word.dataset.wordStart), end = Number(word.dataset.wordEnd)
    const mark = { passageId: passage.id, start, end, text: passage.text.slice(start, end) }
    const removing = highlighted.has(`${start}:${end}`)
    tapping.current = true
    try {
      if (await onHighlight(mark, !removing) && !removing) onHelp(mark, 'translate')
    } finally { tapping.current = false }
  }
  const tools = selection && <div className={styles.selectionTools} role="toolbar" aria-label="选中文字操作">
      <span title={selection.text}>{selection.text}</span>
      <button disabled={disabled || readOnly} onClick={() => onMark(selection, !marked)}>{marked ? '取消标记' : '标记'}</button>
      <button disabled={disabled} onClick={() => onHelp(selection, 'translate')}>查词</button>
      <button disabled={disabled} onClick={() => onHelp(selection, 'ask')}>问 AI</button>
      <button aria-label="收起选词工具" onClick={() => setSelection(null)}>收起</button>
    </div>
  return <>
    <article ref={article} className={styles.passage} onKeyDown={(event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      const word = (event.target as HTMLElement).closest<HTMLElement>('[data-word-start]')
      if (word) { event.preventDefault(); void tapWord(word) }
    }} onPointerDown={(event) => { pointer.current = { x: event.clientX, y: event.clientY, at: Date.now() } }} onPointerUp={readSelection} onKeyUp={readSelection} onClick={(event) => {
      if (disabled || Date.now() - pointer.current.at > 400 || Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 10 || !window.getSelection()?.isCollapsed) return
      const word = (event.target as HTMLElement).closest<HTMLElement>('[data-word-start]')
      if (!word) return
      void tapWord(word)
    }}>{fragments}</article>
    {tools}
  </>
}
