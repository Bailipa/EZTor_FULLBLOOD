'use client'

import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { speakText } from '@/lib/ttsBrowser'
import WordMeaningQuestionButton from '@/components/flashcard/WordMeaningQuestionButton'
import styles from './mobile-navigation.module.css'

type Word = { word: string; translation: string; phonetic?: string }

export default function MenuFlashcard() {
  const [word, setWord] = useState<Word | null>(null)
  const [showMeaning, setShowMeaning] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch('/api/flashcard/public?limit=1', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then((result) => {
        if (!controller.signal.aborted && result?.success && result.data?.[0]) setWord(result.data[0])
        else if (!controller.signal.aborted) setError(true)
      })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
  return () => controller.abort()
  }, [retry])

  const classify = async (known: boolean) => {
    if (!word || saving) return
    setSaving(true); setSaveError('')
    try {
      const response = await fetch('/api/flashcard/save-and-categorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: word.word, category: known ? 'known' : 'unknown', isCorrect: known }) })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '没有保存，请重试')
      setWord(null); setShowMeaning(false); setRetry(value => value + 1)
    } catch (failure) { setSaveError(failure instanceof Error ? failure.message : '网络错误，请重试') }
    finally { setSaving(false) }
  }

  return (
    <section
      className={styles.menuFlashcard}
      aria-label="每日单词"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {!word ? error ? <button type="button" onClick={() => setRetry(value => value + 1)}>单词未载入，点击重试</button> : <span className={styles.menuFlashcardWord}>每日一词…</span> : <>
        <div className={styles.menuFlashcardWordRow}>
          <span className={styles.menuFlashcardWordCopy}>
            <span className={styles.menuFlashcardWord}>{word.word}</span>
            {word.phonetic && <span className={styles.menuFlashcardPhonetic}>[{word.phonetic}]</span>}
          </span>
        </div>
        <div className={styles.menuFlashcardActions}>
          <button type="button" className={styles.menuFlashcardMeaning} onClick={() => setShowMeaning((shown) => !shown)}>
            {showMeaning ? word.translation : '点击查看释义'}
          </button>
          <button type="button" aria-label="朗读单词" onClick={() => speakText(word.word)}>
            <Volume2 size={15} aria-hidden />
          </button>
          <WordMeaningQuestionButton word={word.word} translation={word.translation} />
        </div>
        {showMeaning && <div className={styles.menuFlashcardChoices}><button disabled={saving} onClick={() => void classify(false)}>不认识</button><button disabled={saving} onClick={() => void classify(true)}>认识</button></div>}
        {saveError && <span role="alert" className={styles.menuFlashcardPhonetic}>{saveError}</span>}
      </>}
    </section>
  )
}
