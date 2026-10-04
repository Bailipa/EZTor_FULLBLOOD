'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
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
import { PenTool, Plus, Upload, Bot, Lock, Loader2, X } from 'lucide-react'
import type { ReviewGroup } from '@/types/api'
import { useRealtimeTranslation } from '@/hooks/useRealtimeTranslation'
import { useImportExportVisibility } from '@/hooks/useImportExportVisibility'
import { WordInputRow } from './WordInputRow'
import { AnimatedCounter } from '@/components/ui/rare/animated-counter'
import styles from '@/components/ai/translation-workspace.module.css'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface WordTranslationPanelProps {
  showPhonetic: boolean
  showPos: boolean
  showExample: boolean
  groups: ReviewGroup[]
  selectedTargetGroupId: string
  setSelectedTargetGroupId: (id: string) => void
  isGuest?: boolean
  autoSaveWords?: boolean
  soundEffectsEnabled?: boolean
  onGuestFeatureClick?: (feature: string) => void
  pendingRealtimeWord?: { word: string; requestId: number } | null
  showTitle?: boolean
}

export function WordTranslationPanel({
  showPhonetic,
  showPos,
  showExample,
  groups,
  selectedTargetGroupId,
  setSelectedTargetGroupId,
  isGuest,
  autoSaveWords = true,
  soundEffectsEnabled = true,
  onGuestFeatureClick,
  pendingRealtimeWord,
  showTitle = true,
}: WordTranslationPanelProps) {
  const { show: showImportExportActions } = useImportExportVisibility()
  const {
    entries,
    updateWord,
    retryPublicTranslation,
    addEntry,
    importWords,
    removeEntry,
    clearAll,
    saveEntry,
    cancelSave,
    translateSingle,
    translateAll,
    cancelTranslate,
    cancelAllTranslate,
    notFoundCount,
    hasAiWorkInProgress,
    batchProgress,
  } = useRealtimeTranslation({ showPos, showExample, targetGroupId: selectedTargetGroupId, isGuest, autoSaveWords, soundEffectsEnabled })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<{
    words: string[]
    blankCount: number
    duplicateCount: number
  } | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBatchStartClickRef = useRef(0)
  const handledRealtimeWordRef = useRef(0)

  useEffect(() => {
    if (!pendingRealtimeWord || pendingRealtimeWord.requestId === handledRealtimeWordRef.current) return
    handledRealtimeWordRef.current = pendingRealtimeWord.requestId

    const blankEntry = entries.find((entry) => !entry.word.trim())
    const entryId = blankEntry?.id ?? addEntry()
    if (!entryId) return
    updateWord(entryId, pendingRealtimeWord.word, true)
    setLastAddedId(entryId)
  }, [pendingRealtimeWord, entries, addEntry, updateWord])

  const handleAddEntry = useCallback(() => {
    setLastAddedId(addEntry())
  }, [addEntry])

  const handleRemoveEntry = useCallback(
    (id: string) => {
      removeEntry(id)
    },
    [removeEntry],
  )

  const handleClearAll = useCallback(() => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      clearTimerRef.current = setTimeout(() => {
        setConfirmingClear(false)
        clearTimerRef.current = null
      }, 3000)
      return
    }
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    setConfirmingClear(false)
    clearAll()
  }, [confirmingClear, clearAll])

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [])

  const handleCancelTranslate = useCallback(
    (id: string) => {
      cancelTranslate(id)
    },
    [cancelTranslate],
  )

  const handleBatchClick = useCallback(() => {
    if (hasAiWorkInProgress) {
      // 已经在翻译中：点击 = 取消（幂等，不防抖）
      cancelAllTranslate()
      return
    }
    // 不在翻译中：点击 = 启动（受防抖影响）
    const now = Date.now()
    if (now - lastBatchStartClickRef.current < 300) return
    lastBatchStartClickRef.current = now
    translateAll()
  }, [hasAiWorkInProgress, cancelAllTranslate, translateAll])

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        const text = event.target?.result as string
        if (!text) return

        try {
          const rows: string[][] = []
          let row: string[] = []
          let field = ''
          let inQuotes = false
          const csvText = text.replace(/^\uFEFF/, '')

          for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i]
            if (char === '"') {
              if (inQuotes && csvText[i + 1] === '"') {
                field += '"'
                i++
              } else {
                inQuotes = !inQuotes
              }
            } else if (char === ',' && !inQuotes) {
              row.push(field.trim())
              field = ''
            } else if (char === '\n' && !inQuotes) {
              row.push(field.trim())
              if (row.some((value) => value.trim())) rows.push(row)
              row = []
              field = ''
            } else if (char !== '\r') {
              field += char
            }
          }
          if (inQuotes) throw new Error('CSV 引号未闭合')
          row.push(field.trim())
          if (row.some((value) => value.trim())) rows.push(row)

          if (rows.length < 2) {
            toast.error('文件内容为空或格式不正确')
            return
          }

          const headers = rows[0].map((h) => h.trim().toLowerCase())

          const wordIndex = headers.findIndex((h) => h === 'word' || h === '单词')

          if (wordIndex === -1) {
            toast.error('CSV文件缺少word/单词列')
            return
          }

          const values = rows.slice(1).map((csvRow) => csvRow[wordIndex]?.trim() || '')
          const blankCount = values.filter((word) => !word).length
          const candidates = values.filter(Boolean)

          if (candidates.length === 0) {
            toast.error('未能解析出有效的单词')
            return
          }

          if (candidates.length > 50) {
            toast.error('CSV文件最多包含50个单词')
            return
          }

          const seen = new Set<string>()
          const words = candidates.filter((word) => {
            const key = word.toLocaleLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          const duplicateCount = candidates.length - words.length
          setCsvPreview({ words, blankCount, duplicateCount })
        } catch {
          toast.error('CSV 格式无效，请检查引号和分隔符')
        }
      }
      reader.readAsText(file)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [importWords],
  )

  const wordCount = entries.filter((e) => e.word.trim()).length
  const showFooter = (!isGuest && (wordCount > 0 || hasAiWorkInProgress))
    || notFoundCount > 0
    || (batchProgress && batchProgress.status !== 'running')

  return (
    <Card className={`shadow-sm ${styles.sheet}`}>
      <CardHeader className={`${styles.sheetHeader} ${!showTitle && isGuest ? 'hidden lg:grid' : ''}`}>
        <div className="flex flex-wrap items-center gap-3">
          {!showTitle && <div className="hidden items-center gap-2.5 lg:flex">
            <PenTool className="size-4 text-primary" />
            <span className="font-medium">单词清单</span>
            {wordCount > 0 && <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"><AnimatedCounter value={wordCount} duration={0.35} /></span>}
          </div>}
          {showTitle && (
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              实时翻译
            </CardTitle>
          )}
          {!isGuest && (
            <>
              {groups.length > 0 && (
                <Select value={selectedTargetGroupId} onValueChange={setSelectedTargetGroupId}>
                  <SelectTrigger
                    className="w-full min-h-11 text-sm bg-muted/30 sm:w-56 lg:ml-auto lg:min-h-9"
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
              {showImportExportActions && (
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
                    className={`ml-auto gap-1.5 h-11 min-w-11 px-3 text-xs lg:h-9 ${groups.length > 0 ? 'lg:ml-0' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="导入CSV文件"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    导入 CSV
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className={styles.sheetBody}>
        <div className={`mb-2 hidden grid-cols-[minmax(14rem,0.38fr)_minmax(0,1fr)] text-xs text-muted-foreground lg:grid ${styles.columnLabels}`} aria-hidden="true">
          <span className="px-3">单词</span>
          <span className="px-3">释义</span>
        </div>
        <div className={`space-y-2 ${styles.rows}`}>
          {entries.map((entry, index) => (
            <WordInputRow
              key={entry.id}
              entry={entry}
              rowNumber={index + 1}
              singleEntry={entries.length === 1}
              onWordChange={updateWord}
              onRemove={handleRemoveEntry}
              onTranslate={translateSingle}
              onCancelTranslate={handleCancelTranslate}
              onRetryQuery={retryPublicTranslation}
              onSave={saveEntry}
              onCancelSave={cancelSave}
              onAddEntry={handleAddEntry}
              showPos={showPos}
              showPhonetic={showPhonetic}
              showExample={showExample}
              autoFocus={lastAddedId === entry.id}
              aiTranslated={entry.aiTranslated}
              isGuest={isGuest}
              onGuestFeatureClick={onGuestFeatureClick}
              groups={groups}
              selectedTargetGroupId={selectedTargetGroupId}
            />
          ))}
        </div>

        <div className={`mt-3 flex items-center justify-between ${styles.sheetActions}`}>
          <button
            type="button"
            onClick={handleAddEntry}
            title="按回车键也能新建"
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            添加单词
          </button>
          {wordCount > 0 && (
            <span className="text-xs text-muted-foreground lg:hidden">
              <AnimatedCounter value={wordCount} duration={0.35} /> 个单词
            </span>
          )}
          <span className="hidden items-center gap-2 text-xs text-muted-foreground lg:inline-flex"><kbd className="rounded border bg-muted/40 px-1.5 py-0.5 font-sans">Enter</kbd>下一词</span>
        </div>
      </CardContent>
      {showFooter && (
        <CardFooter className="flex flex-wrap justify-end items-center gap-2 lg:px-6">
          {!isGuest && wordCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 gap-1.5 px-3"
              onClick={handleClearAll}
              aria-label="清空输入"
            >
              {confirmingClear ? '再按一次' : '清空'}
            </Button>
          )}
          {!isGuest && (notFoundCount > 0 || hasAiWorkInProgress) && (
            <Button
              onClick={handleBatchClick}
              className="min-h-11 gap-2 min-w-[140px] justify-center"
              size="sm"
              aria-label={hasAiWorkInProgress ? batchProgress?.status === 'running' ? '停止当前批量 AI 翻译' : '取消正在进行的 AI 翻译' : `批量AI翻译 ${notFoundCount} 个单词`}
            >
              {hasAiWorkInProgress ? (
                <>
                  {batchProgress?.status === 'running' ? <X className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                  {batchProgress?.status === 'running' ? `停止本批 · ${batchProgress.completed}/${batchProgress.total}` : '取消翻译'}
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
          {batchProgress && batchProgress.status !== 'running' && (
            <p className="w-full text-right text-xs text-muted-foreground" role="status" aria-live="polite">
              {batchProgress.status === 'done'
                ? `批量处理完成：${batchProgress.completed}/${batchProgress.total} 个词条；异常项可单独重试。`
                : `本批已停止：处理 ${batchProgress.completed}/${batchProgress.total} 个词条；未处理项保留。停止不保证撤销已提交的模型请求。`}
            </p>
          )}
        </CardFooter>
      )}
      <Dialog open={!!csvPreview} onOpenChange={(open) => { if (!open) setCsvPreview(null) }}>
        <DialogContent className="max-h-[min(85dvh,44rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>预览待查词</DialogTitle>
            <DialogDescription>
              确认后开始查询；是否自动加入生词本由“我的”页中的设置决定。
            </DialogDescription>
          </DialogHeader>
          {csvPreview && (
            <div className="space-y-3">
              <p className="text-sm">
                共 {csvPreview.words.length} 个不同单词
                {csvPreview.blankCount > 0 && `，忽略空行 ${csvPreview.blankCount}`}
                {csvPreview.duplicateCount > 0 && `，合并重复项 ${csvPreview.duplicateCount}`}
              </p>
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
                {csvPreview.words.slice(0, 12).map((word, index) => (
                  <li key={`${word}-${index}`} className="break-words">{word}</li>
                ))}
                {csvPreview.words.length > 12 && (
                  <li className="text-muted-foreground">另有 {csvPreview.words.length - 12} 个…</li>
                )}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setCsvPreview(null)}>取消</Button>
            <Button
              className="min-h-11"
              onClick={() => {
                if (!csvPreview) return
                importWords(csvPreview.words)
                toast.success(`已填入 ${csvPreview.words.length} 个待查词`)
                setCsvPreview(null)
              }}
            >
              填入并查询
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
