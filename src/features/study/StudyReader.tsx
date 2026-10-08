'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { englishLookupTokens, SKILL_LABELS, type StudyAction } from './domain'
import { studyRequest, useStudyClock } from './client'
import type { LookupView, QuestionFeedback, SessionView } from './types'
import styles from './study.module.css'

type Intent = StudyAction extends infer Action ? Action extends StudyAction ? Omit<Action, 'clientId' | 'activeMs'> : never : never
type ActionResult = { session: SessionView; receipt: { lookup?: LookupView } }
const letters = ['A', 'B', 'C', 'D']
const StudyPractice = dynamic(() => import('./StudyPractice'), { loading: () => <p role="status">正在打开翻译与写作训练…</p> })

export function AnswerFeedback({ answer }: { answer: QuestionFeedback }) {
  return <details className={styles.feedback}>
    <summary>{answer.correct ? '✓ 答对了' : `正确答案 ${letters[answer.answerIndex]}`} · {SKILL_LABELS[answer.skill]}</summary>
    <p>{answer.prompt}</p>
    <p>你的选择：{letters[answer.choice]} · {answer.choices[answer.choice]}</p>
    {!answer.correct && <p>{answer.reason}</p>}
    <p>{answer.explanation}</p>
    {answer.evidence.map(({ index, text }) => <blockquote key={index}>第 {index + 1} 句：{text}</blockquote>)}
  </details>
}

export default function StudyReader({ accountId, session, onSession, onNext, hasNext, compact = false }: {
  accountId: string; session: SessionView; onSession: (session: SessionView) => void; onNext: () => void; hasNext: boolean; compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lookup, setLookup] = useState<LookupView | null>(null)
  const [lookupWord, setLookupWord] = useState<string | null>(null)
  const [articleOpen, setArticleOpen] = useState(false)
  const lookupVisible = useRef(false)
  const pending = useRef<StudyAction | null>(null)
  const mounted = useRef(true)
  const sending = useRef(false)
  const takeTime = useStudyClock(session.status !== 'COMPLETE')
  const live = useRef({ session, takeTime })
  live.current = { session, takeTime }

  useEffect(() => {
    mounted.current = true
    const pause = () => {
      const current = live.current
      if (current.session.status === 'COMPLETE' || sending.current || pending.current) return
      const activeMs = current.takeTime()
      if (!activeMs) return
      void studyRequest(accountId, `/api/study/sessions/${current.session.id}`, { method: 'POST', keepalive: true,
        body: JSON.stringify({ clientId: crypto.randomUUID(), type: 'PAUSE', activeMs }),
      }).catch(() => { /* The last confirmed progress remains recoverable. */ })
    }
    const hidden = () => { if (document.visibilityState === 'hidden') pause() }
    window.addEventListener('pagehide', pause)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      pause()
      mounted.current = false
      window.removeEventListener('pagehide', pause)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [accountId])

  async function submit(intent?: Intent) {
    if (sending.current) return
    const action = pending.current ?? (intent ? { ...intent, clientId: crypto.randomUUID(), activeMs: takeTime() } as StudyAction : null)
    if (!action) return
    pending.current = action
    sending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await studyRequest<ActionResult>(accountId, `/api/study/sessions/${session.id}`, { method: 'POST', body: JSON.stringify(action) })
      if (!mounted.current) return
      pending.current = null
      onSession(result.session)
      if (result.receipt.lookup && lookupVisible.current) { setLookup(result.receipt.lookup); setLookupWord(null) }
      else if (action.type === 'UNDERSTOOD') { closeLookup() }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : '没有保存，请重试')
    } finally {
      sending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function sync() {
    if (sending.current) return
    sending.current = true; setBusy(true)
    try {
      const current = await studyRequest<SessionView>(accountId, `/api/study/sessions/${session.id}`)
      if (!mounted.current) return
      pending.current = null; setError(''); closeLookup(); onSession(current)
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : '无法同步进度')
    } finally { sending.current = false; if (mounted.current) setBusy(false) }
  }
  function closeLookup() {
    lookupVisible.current = false
    setLookup(null); setLookupWord(null)
  }
  const disabled = busy || !!error
  const correct = session.feedback.filter((answer) => answer.correct).length
  const uniqueWords = new Set(session.lookups.map((word) => word.lemma)).size
  const wordButtons = (text: string, sentenceIndex: number) => {
    const tokens = englishLookupTokens(text)
    return tokens.map((token, tokenIndex) => <Fragment key={tokenIndex}>
      {text.slice(tokenIndex ? tokens[tokenIndex - 1].end : 0, token.start)}
      <span className={tokenIndex === tokens.length - 1 ? styles.tokenTail : undefined}><button className={styles.token} disabled={disabled} aria-label={`查看 ${token.text} 的释义`}
        aria-pressed={lookup?.sentenceIndex === sentenceIndex && lookup.tokenIndex === tokenIndex}
        onClick={() => { lookupVisible.current = true; setLookup(null); setLookupWord(token.text); void submit({ type: 'LOOKUP', sentenceIndex, tokenIndex }) }}>{token.text}</button>
      {tokenIndex === tokens.length - 1 && text.slice(token.end)}</span>
    </Fragment>)
  }
  const readCount = Math.min(session.sentenceIndex + (session.status === 'READING' ? 1 : 0), session.sentences.length)
  const paperLabel = compact ? session.passage.title.replace(/CET[46]/g, ' · ').replace(/仔细阅读 Passage One.*$/, ' · 阅读一').replace(/仔细阅读 Passage Two.*$/, ' · 阅读二') : session.passage.title

  return <section className={`${styles.panel} ${compact ? styles.reader : ''}`} data-home-reader={compact ? '' : undefined} data-state={session.status} aria-label="文章阅读练习" aria-busy={busy}>
    <div className={styles.readerHeader}>
      <div className={styles.paperTitle}>
        <span>{paperLabel}</span>
        <small>{session.passage.level === 'CET4' ? '四级' : '六级'} · {session.passage.kind === 'ORIGINAL' ? '原创练习（非真题）' : session.passage.kind === 'OFFICIAL_SAMPLE' ? '官方样题' : '历年真题'}</small>
      </div>
      <span className={styles.readerPosition}>{session.status === 'READING' ? `${session.sentenceIndex + 1}/${session.sentences.length} 句` : session.status === 'QUESTIONS' ? `${session.questionIndex + 1}/5 题` : '已完成'}</span>
    </div>
    <progress className={styles.progress} max={session.sentences.length + 5} value={session.sentenceIndex + session.questionIndex} aria-label="文章完成进度" />
    {error && <div className={styles.error} role="alert">{error}<div className={styles.row}>
      <button className={styles.textButton} disabled={busy} onClick={() => void submit()}>重试原操作</button>
      <button className={styles.textButton} disabled={busy} onClick={() => void sync()}>同步已保存进度</button>
    </div></div>}
    <Dialog open={!!(lookup || lookupWord)} onOpenChange={(open) => { if (!open) closeLookup() }}><DialogContent className={styles.wordDialog}>
      <DialogTitle>{lookup?.word ?? lookupWord ?? '单词释义'}</DialogTitle>
      <DialogDescription>查词后自动加入不认识词本</DialogDescription>
      <aside className={styles.word} role="status">
      <strong>{lookup?.word ?? lookupWord}</strong>
      <p>{lookup?.meaning ?? (busy ? '正在查词义…' : '词义尚未保存，重试后会自动加入不认识词本。')}</p>
      {lookup && <small className={styles.subtle}>已加入不认识词本 · {lookup.source === 'AI' ? 'AI 语境解释' : lookup.source === 'PUBLIC' ? '公共词库常见释义（未按本句消歧）' : '已核对的语境释义'}</small>}
      </aside>
    </DialogContent></Dialog>
    {session.status === 'READING' && <>
      <div className={styles.sentence}>{wordButtons(session.sentences[session.sentenceIndex].text, session.sentenceIndex)}</div>
      <div className={styles.readingHint}>
        <span className={styles.subtle}>点击词框查看释义</span>
        {compact && <button className={`${styles.textButton} ${styles.inlineArticleButton}`} onClick={() => setArticleOpen(true)}>回看原文</button>}
      </div>
      <div className={`${styles.actions} ${styles.readingActions}`}>
        <Button className={styles.understoodButton} disabled={disabled} onClick={() => void submit({ type: 'UNDERSTOOD', sentenceIndex: session.sentenceIndex })}>
          <span>{busy ? '正在保存…' : session.sentenceIndex === session.sentences.length - 1 ? '明白，开始答题' : '明白，下一句'}</span><ArrowRight size={18} aria-hidden="true" />
        </Button>
        <button className={styles.bookmarkButton} aria-pressed={session.bookmarks.includes(session.sentenceIndex)} title={session.bookmarks.includes(session.sentenceIndex) ? '取消收藏句子' : '收藏句子'} aria-label={session.bookmarks.includes(session.sentenceIndex) ? '取消收藏句子' : '收藏句子'} disabled={disabled} onClick={() => void submit({ type: 'BOOKMARK', sentenceIndex: session.sentenceIndex, bookmarked: !session.bookmarks.includes(session.sentenceIndex) })}>
          <Bookmark size={18} fill={session.bookmarks.includes(session.sentenceIndex) ? 'currentColor' : 'none'} />
        </button>
      </div>
    </>}
    {session.status === 'QUESTIONS' && session.question && <>
      {session.feedback.length > 0 && <AnswerFeedback answer={session.feedback[session.feedback.length - 1]} />}
      <p className={styles.question}>{session.question.prompt}</p>
      <div className={styles.choices}>{session.question.choices.map((choice, index) => <button key={index} className={styles.choice} disabled={disabled}
        onClick={() => void submit({ type: 'ANSWER', questionIndex: session.question!.index, choice: index })}><span>{letters[index]}</span>{choice}</button>)}</div>
      <p className={styles.subtle}>点选即提交；首次答案用于分析，提交后可查看原文证据。</p>
    </>}
    {session.status === 'COMPLETE' && <>
      <div className={styles.result}>
        <div className={styles.ring} style={{ background: `conic-gradient(var(--primary) ${correct * 20}%, var(--muted) 0)` }}><strong>{correct}/5</strong></div>
        <div><h3>{correct === 5 ? '这一篇，读懂了' : '把没读懂的地方，再打磨一次'}</h3><p className={styles.subtle}>有效用时 {Math.round(session.activeMs / 60000)} 分钟 · {uniqueWords} 个生词<br />{session.assisted ? '本次使用过查词辅助' : '本次未使用查词辅助'}</p></div>
      </div>
      <div className={styles.skills}>{Object.entries(SKILL_LABELS).map(([skill, label]) => {
        const answers = session.feedback.filter((answer) => answer.skill === skill)
        const hit = answers.filter((answer) => answer.correct).length
        return <div className={styles.skill} key={skill}><span>{label}</span><progress className={styles.progress} max={answers.length || 1} value={hit} aria-label={`${label}答对数量`} /><span>{answers.length ? `${hit}/${answers.length}` : '未覆盖'}</span></div>
      })}</div>
      <div className={styles.actions}>
        {hasNext && <Button disabled={disabled} onClick={onNext}>再读一篇</Button>}
        {session.lookups[0] && <Link className={styles.textButton} href={`/dictation?groupId=${encodeURIComponent(session.lookups[0].groupId)}`}>巩固陌生词 <small className={styles.subtle}>（进入账户陌生词本，含此前存入的词）</small></Link>}
        <Link className={styles.textButton} href="/history">打开词库</Link>
      </div>
      <div className={styles.work}>{session.feedback.map((answer) => <AnswerFeedback key={answer.questionIndex} answer={answer} />)}</div>
      <StudyPractice accountId={accountId} session={session} onSession={onSession} />
    </>}
    {compact && session.status !== 'READING' ? <button className={`${styles.textButton} ${styles.articleButton}`} onClick={() => setArticleOpen(true)}>查看全文</button> : !compact ? <details className={styles.article}>
      <summary>{session.status === 'READING' ? '回看已读原文' : '查看全文'}</summary>
      {session.sentences.slice(0, readCount).map(({ text }, index) => <p key={index}>{wordButtons(text, index)}</p>)}
    </details> : null}
    {articleOpen && <Dialog open onOpenChange={setArticleOpen}><DialogContent className={styles.resourceDialog}>
      <DialogTitle>{session.status === 'READING' ? '已读原文' : '全文'}</DialogTitle><DialogDescription>{session.passage.title}</DialogDescription>
      <div className={styles.articleText}>{session.sentences.slice(0, readCount).map(({ text }, index) => <p key={index}>{text}</p>)}</div>
    </DialogContent></Dialog>}
  </section>
}
