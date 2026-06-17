'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Volume2, Loader2, Search, Bot, Check, Bookmark } from 'lucide-react'
import type { WordEntry } from '@/hooks/useRealtimeTranslation'
import { speakText } from '@/lib/ttsBrowser'

interface WordInputRowProps {
  entry: WordEntry
  onWordChange: (id: string, word: string) => void
  onRemove: (id: string) => void
  onTranslate: (id: string) => void
  showPos: boolean
  showExample: boolean
  autoFocus?: boolean
}

function SaveStatusIndicator({ status, entryId }: { status: WordEntry['saveStatus']; entryId: string }) {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (status !== 'pending') {
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
  }, [status, entryId])

  if (status === 'idle') return null

  if (status === 'in-vocabulary') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <Bookmark className="h-3 w-3" />
        <span>已在生词本中</span>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span>{countdown}s 后自动入库</span>
      </div>
    )
  }

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>入库中...</span>
      </div>
    )
  }

  if (status === 'saved') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-green-600 dark:text-green-400 animate-[fadeIn_0.3s_ease-out]">
        <Check className="h-3 w-3" />
        <span>入库成功</span>
      </div>
    )
  }

  return null
}

export function WordInputRow({
  entry,
  onWordChange,
  onRemove,
  onTranslate,
  showPos,
  showExample,
  autoFocus,
}: WordInputRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const playAudio = (text: string) => {
    speakText(text)
  }

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
          <div className="flex items-center gap-2 py-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">AI翻译中...</span>
          </div>
        )

      case 'found':
        return (
          <div className="space-y-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {entry.phonetic && (
                <span className="font-mono text-sm text-muted-foreground">[{entry.phonetic}]</span>
              )}
              {showPos && entry.pos && <Badge variant="secondary">{entry.pos}</Badge>}
              <button
                onClick={() => playAudio(entry.word)}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                title="点击发音"
                aria-label={`播放 ${entry.word} 的发音`}
              >
                <Volume2 size={16} />
              </button>
              {entry.isPublic && (
                <Badge variant="outline" className="text-xs">
                  词库
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium">{entry.translation}</p>
            {showExample && entry.example && (
              <div className="space-y-1 rounded-md bg-muted/50 p-2 text-xs">
                {entry.example.split('\n').map((ex, i) => {
                  const translations = entry.exampleTranslation
                    ? entry.exampleTranslation.split('\n')
                    : []
                  const trans = translations[i] || ''
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-start gap-1">
                        <p className="flex-1 italic">&quot;{ex}&quot;</p>
                        <button
                          onClick={() => playAudio(ex)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-primary"
                          title="朗读例句"
                        >
                          <Volume2 size={12} />
                        </button>
                      </div>
                      {trans && <p className="text-muted-foreground">{trans}</p>}
                    </div>
                  )
                })}
              </div>
            )}
            <SaveStatusIndicator status={entry.saveStatus} entryId={entry.id} />
          </div>
        )

      case 'not-found':
        return (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              <span className="text-sm">未在公共词库中找到</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTranslate(entry.id)}
              className="gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" />
              AI翻译
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-destructive">查询失败</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTranslate(entry.id)}
              className="gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" />
              重试
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  const hasContent = entry.status !== 'idle'

  return (
    <div className="group relative rounded-lg border bg-card transition-colors hover:border-primary/30">
      <div className="flex items-center gap-2 p-3">
        <Input
          ref={inputRef}
          value={entry.word}
          onChange={(e) => onWordChange(entry.id, e.target.value)}
          placeholder="输入单词或词组..."
          className="flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          aria-label="输入单词"
        />
        <button
          onClick={() => onRemove(entry.id)}
          className="rounded-full p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label={`删除 ${entry.word || '空输入框'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {hasContent && (
        <div className="border-t px-3">{renderTranslationResult()}</div>
      )}
    </div>
  )
}
