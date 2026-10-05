'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Volume2, Loader2, Search, Bot, Check, Bookmark, Lock, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WordEntry } from '@/hooks/useRealtimeTranslation'
import { speakText } from '@/lib/ttsBrowser'
import type { ReviewGroup } from '@/types/api'
import styles from '@/components/ai/translation-workspace.module.css'

interface WordInputRowProps {
  entry: WordEntry
  rowNumber: number
  singleEntry: boolean
  onWordChange: (id: string, word: string, deferLookup?: boolean) => void
  onRemove: (id: string) => void
  onTranslate: (id: string) => void
  onCancelTranslate: (id: string) => void
  onRetryQuery: (id: string) => void
  onSave: (id: string, word: string, groupId?: string) => void
  onCancelSave: (id: string) => void
  onAddEntry?: () => void
  showPos: boolean
  showPhonetic: boolean
  showExample: boolean
  autoFocus?: boolean
  aiTranslated?: boolean
  isGuest?: boolean
  onGuestFeatureClick?: (feature: string) => void
  groups: ReviewGroup[]
  selectedTargetGroupId: string
}

function SaveStatusIndicator({
  entry,
  groupName,
  entryGroupName,
  currentTargetGroupId,
  onSave,
  onCancelSave,
}: {
  entry: WordEntry
  groupName?: string
  entryGroupName?: string
  currentTargetGroupId: string
  onSave: (id: string, word: string, groupId?: string) => void
  onCancelSave: (id: string) => void
}) {
  const { saveStatus } = entry
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (saveStatus !== 'pending') {
      setCountdown(3)
      return
    }

    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [saveStatus, entry.id])

  if (saveStatus === 'idle') return null

  if (saveStatus === 'in-vocabulary') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <Bookmark className="h-3 w-3" />
        <span>已在生词本中</span>
      </div>
    )
  }

  if (saveStatus === 'pending') {
    return (
      <div className="flex flex-wrap items-center gap-2 py-1 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span>{countdown}s 后保存至{entryGroupName ? `「${entryGroupName}」` : '总词库'}</span>
        <Button type="button" variant="ghost" size="sm" className="min-h-11 px-3" onClick={() => onCancelSave(entry.id)}>
          取消保存
        </Button>
      </div>
    )
  }

  if (saveStatus === 'saving') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>入库中...</span>
      </div>
    )
  }

  if (saveStatus === 'saved') {
    return (
      <div className={`flex items-center gap-1.5 py-1 text-xs text-green-600 dark:text-green-400 ${styles.savedArrival}`}>
        <Check className="h-3 w-3" />
        <span>已保存到{entryGroupName ? `「${entryGroupName}」` : '总词库'}</span>
      </div>
    )
  }

  if (saveStatus === 'not-saved' || saveStatus === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-2 py-1">
        <span className={cn('text-xs', saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
          {saveStatus === 'error' ? '保存失败' : '尚未保存'}
        </span>
        <Button type="button" variant="outline" size="sm" className="min-h-11 px-3" onClick={() => onSave(entry.id, entry.word, currentTargetGroupId === 'none' ? undefined : currentTargetGroupId)}>
          {saveStatus === 'error' ? `重试保存到${groupName ? `「${groupName}」` : '总词库'}` : `保存到${groupName ? `「${groupName}」` : '总词库'}`}
        </Button>
      </div>
    )
  }

  return null
}

export const WordInputRow = React.memo(function WordInputRow({
  entry,
  rowNumber,
  singleEntry,
  onWordChange,
  onRemove,
  onTranslate,
  onCancelTranslate,
  onRetryQuery,
  onSave,
  onCancelSave,
  onAddEntry,
  showPos,
  showPhonetic,
  showExample,
  autoFocus,
  aiTranslated,
  isGuest,
  onGuestFeatureClick,
  groups,
  selectedTargetGroupId,
}: WordInputRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)
  const lastStartClickRef = useRef(0)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const playAudio = (text: string) => {
    speakText(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (entry.word.trim() && onAddEntry) {
        onAddEntry()
      } else if (!entry.word.trim()) {
        // 输入为空时：把当前输入框滚到可视区中央，并保持聚焦
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        inputRef.current?.focus({ preventScroll: true })
      }
    }
  }

  const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onWordChange(entry.id, e.target.value, isComposingRef.current)
  }

  const handleStartTranslate = useCallback(() => {
    const now = Date.now()
    if (now - lastStartClickRef.current < 300) return
    lastStartClickRef.current = now
    onTranslate(entry.id)
  }, [entry.id, onTranslate])

  const renderTranslationResult = () => {
    switch (entry.status) {
      case 'idle':
        return null

      case 'loading':
        return (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">查询中...</span>
          </div>
        )

      case 'ai-loading':
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{entry.batchQueued ? '批量队列等待中…' : entry.batchTranslation ? '批量 AI 翻译中…' : 'AI 翻译中…'}</span>
            </div>
            {!entry.batchQueued && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCancelTranslate(entry.id)}
                className="min-h-11 gap-1.5"
              >
                {entry.batchTranslation ? '停止本批' : '取消'}
              </Button>
            )}
          </div>
        )

      case 'found':
        return (
          <div className={`space-y-2 py-2 ${styles.resultArrival}`}>
            <div className="flex flex-wrap items-center gap-2">
              {showPhonetic && entry.phonetic && (
                <span className="font-mono text-sm text-muted-foreground">[{entry.phonetic}]</span>
              )}
              {showPos && entry.pos && <Badge variant="secondary">{entry.pos}</Badge>}
              <button
                onClick={() => playAudio(entry.word)}
                className="inline-flex h-11 w-11 lg:h-8 lg:w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                title="点击发音"
                aria-label={`播放 ${entry.word} 的发音`}
              >
                <Volume2 size={16} />
              </button>
            </div>
            <p className={`text-sm font-medium ${styles.translation}`}>{entry.translation}</p>
            {showExample && entry.example && (
              <details className={styles.examples}>
                <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">例句<ChevronDown className="size-3.5" /></summary>
                <div className="space-y-3 pb-2">
                {entry.example.split('\n').map((ex, i) => {
                  const translations = entry.exampleTranslation
                    ? entry.exampleTranslation.split('\n')
                    : []
                  const trans = translations[i] || ''
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-start gap-1">
                        <p className="min-w-0 leading-7">&quot;{ex}&quot;</p>
                        <button
                          onClick={() => playAudio(ex)}
                          className="inline-flex h-11 w-11 lg:h-7 lg:w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary"
                          title="朗读例句"
                          aria-label="朗读例句"
                        >
                          <Volume2 size={12} />
                        </button>
                      </div>
                      {trans && <p className="text-muted-foreground">{trans}</p>}
                    </div>
                  )
                })}
                </div>
              </details>
            )}
            <SaveStatusIndicator
              entry={entry}
              groupName={groups.find((group) => group.id === selectedTargetGroupId)?.name}
              entryGroupName={groups.find((group) => group.id === entry.saveTargetGroupId)?.name}
              currentTargetGroupId={selectedTargetGroupId}
              onSave={onSave}
              onCancelSave={onCancelSave}
            />
          </div>
        )

      case 'not-found':
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              <span className="text-sm">未在公共词库中找到</span>
            </div>
            {isGuest ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onGuestFeatureClick?.('AI翻译')}
                className="gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" />
                登录后解锁
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartTranslate}
                className="gap-1.5"
              >
                <Bot className="h-3.5 w-3.5" />
                AI翻译
              </Button>
            )}
          </div>
        )

      case 'error':
        const lookupFailed = entry.errorStage === 'lookup'
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-sm text-destructive">查询失败</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => lookupFailed ? onRetryQuery(entry.id) : handleStartTranslate()}
              className="min-h-11 gap-1.5"
            >
              {lookupFailed ? <Search className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              {lookupFailed ? '重试词库查询' : '重试 AI 翻译'}
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  const hasContent = entry.status !== 'idle'

  return (
    <div
      data-workspace-translation-row
      className={cn(
        'group relative rounded-lg border bg-card transition-colors hover:border-primary/30 lg:grid lg:grid-cols-[minmax(14rem,0.38fr)_minmax(0,1fr)]',
        styles.wordRow,
        singleEntry && styles.singleRow,
        aiTranslated && 'ring-2 ring-emerald-500 border-emerald-500/40',
      )}
    >
      <div data-workspace-translation-input className={`flex min-w-0 items-center gap-2 self-start p-3 ${styles.wordInput}`}>
        <span className="hidden shrink-0 pr-1 text-[11px] leading-[44px] tabular-nums text-muted-foreground/60 lg:block" aria-hidden="true">{String(rowNumber).padStart(2, '0')}</span>
        <Input
          ref={inputRef}
          value={entry.word}
          onChange={handleWordChange}
          onCompositionStart={() => { isComposingRef.current = true }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false
            onWordChange(entry.id, e.currentTarget.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入单词或词组..."
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base md:text-base lg:text-sm shadow-none focus-visible:ring-0"
          aria-label="输入单词"
        />
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          aria-label={`删除 ${entry.word || '空输入框'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div data-workspace-translation-definition className={cn('min-w-0 break-words border-t px-3 lg:border-t-0 lg:border-l', styles.definition, !hasContent && `hidden lg:flex ${styles.emptyDefinition}`)}>
        {hasContent ? renderTranslationResult() : singleEntry ? (
          <p className="text-sm text-muted-foreground/70">输入后查看释义</p>
        ) : <span className="text-muted-foreground/50" aria-hidden="true">—</span>}
      </div>
    </div>
  )
})
