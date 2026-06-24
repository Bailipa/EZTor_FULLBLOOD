'use client'

import React, { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PenTool, Plus, Upload, Bot, Lock, Loader2 } from 'lucide-react'
import type { ReviewGroup } from '@/types/api'
import { useRealtimeTranslation } from '@/hooks/useRealtimeTranslation'
import { WordInputRow } from './WordInputRow'

interface WordTranslationPanelProps {
  showPos: boolean
  showExample: boolean
  groups: ReviewGroup[]
  selectedTargetGroupId: string
  setSelectedTargetGroupId: (id: string) => void
  isGuest?: boolean
  onGuestFeatureClick?: (feature: string) => void
}

export function WordTranslationPanel({
  showPos,
  showExample,
  groups,
  selectedTargetGroupId,
  setSelectedTargetGroupId,
  isGuest,
  onGuestFeatureClick,
}: WordTranslationPanelProps) {
  const {
    entries,
    updateWord,
    addEntry,
    removeEntry,
    translateSingle,
    translateAll,
    notFoundCount,
    hasAiWorkInProgress,
  } = useRealtimeTranslation({ showPos, showExample, targetGroupId: selectedTargetGroupId, isGuest })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  const handleAddEntry = useCallback(() => {
    addEntry()
    setLastAddedId(null)
  }, [addEntry])

  const handleRemoveEntry = useCallback(
    (id: string) => {
      removeEntry(id)
    },
    [removeEntry],
  )

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        const text = event.target?.result as string
        if (!text) return

        try {
          const lines = text.split(/\r?\n/).filter((line) => line.trim())
          if (lines.length < 2) {
            toast.error('文件内容为空或格式不正确')
            return
          }

          const headers = lines[0]
            .split(',')
            .map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase())

          const wordIndex = headers.findIndex(
            (h) => h.includes('word') || h.includes('单词'),
          )

          if (wordIndex === -1) {
            toast.error('CSV文件缺少word/单词列')
            return
          }

          const words: string[] = []
          for (let i = 1; i < lines.length; i++) {
            const values: string[] = []
            let currentVal = ''
            let inQuotes = false
            for (const char of lines[i]) {
              if (char === '"') {
                inQuotes = !inQuotes
              } else if (char === ',' && !inQuotes) {
                values.push(currentVal)
                currentVal = ''
              } else {
                currentVal += char
              }
            }
            values.push(currentVal)

            const word = values[wordIndex]?.replace(/^"|"$/g, '').trim()
            if (word) {
              words.push(word)
            }
          }

          if (words.length === 0) {
            toast.error('未能解析出有效的单词')
            return
          }

          if (words.length > 50) {
            toast.error('CSV文件最多包含50个单词')
            return
          }

          toast.success(`成功导入 ${words.length} 个单词`)
        } catch {
          toast.error('导入过程中发生错误')
        }
      }
      reader.readAsText(file)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [],
  )

  const wordCount = entries.filter((e) => e.word.trim()).length

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            实时翻译
          </CardTitle>
          {!isGuest && (
            <>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                aria-label="上传CSV文件"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs px-2.5"
                onClick={() => fileInputRef.current?.click()}
                aria-label="导入CSV文件"
              >
                <Upload className="w-3.5 h-3.5" />
                导入 CSV
              </Button>
            </>
          )}
        </div>
        {!isGuest && (
          <div className="flex items-center justify-between mt-1.5">
            {groups.length > 0 && (
              <Select value={selectedTargetGroupId} onValueChange={setSelectedTargetGroupId}>
                <SelectTrigger
                  className="w-[130px] h-7 text-xs bg-muted/30"
                  aria-label="选择目标分组"
                >
                  <SelectValue placeholder="存入..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">仅存入总词库</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      存入: {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <WordInputRow
              key={entry.id}
              entry={entry}
              onWordChange={updateWord}
              onRemove={handleRemoveEntry}
              onTranslate={translateSingle}
              onAddEntry={handleAddEntry}
              showPos={showPos}
              showExample={showExample}
              autoFocus={lastAddedId === entry.id || (index === entries.length - 1 && entry.word === '')}
              aiTranslated={entry.aiTranslated}
              isGuest={isGuest}
              onGuestFeatureClick={onGuestFeatureClick}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddEntry}
            title="按回车键也能新建"
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            添加单词
          </button>
          {wordCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {wordCount} 个单词
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end items-center">
        {!isGuest && (notFoundCount > 0 || hasAiWorkInProgress) && (
          <Button
            onClick={translateAll}
            className="gap-2 min-w-[140px] justify-center"
            size="sm"
            aria-label={hasAiWorkInProgress ? 'AI 翻译中' : `批量AI翻译 ${notFoundCount} 个单词`}
          >
            {hasAiWorkInProgress ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 翻译中…
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                批量AI翻译 ({notFoundCount})
              </>
            )}
          </Button>
        )}
        {isGuest && notFoundCount > 0 && (
          <Button onClick={() => onGuestFeatureClick?.('AI翻译')} variant="outline" className="gap-2" size="sm">
            <Lock className="h-4 w-4" />
            登录后解锁AI翻译 ({notFoundCount})
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
