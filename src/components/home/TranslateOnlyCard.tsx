'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Languages,
  Copy,
  ClipboardPaste,
  Settings,
  Sparkles,
  History,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { useAnalytics } from '@/lib/analytics'
import { getDeviceId } from '@/lib/deviceId'
import { loadFromStorage, saveToStorage } from '@/lib/storage'
import { LimitExceededModal } from './LimitExceededModal'
import {
  loadHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  formatTime,
  HistoryEntry,
} from '@/lib/translateHistory'

const MAX_LENGTH = 8000
const DAILY_LIMIT = 30

export function TranslateOnlyCard() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isClearConfirm, setIsClearConfirm] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isCopied, setIsCopied] = useState(false)
  const { trackTranslateOnly } = useAnalytics()

  const [remaining, setRemaining] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showClearApiDialog, setShowClearApiDialog] = useState(false)
  const [customApi, setCustomApi] = useState<{ configured: boolean; model?: string } | null>(null)
  const [optimize, setOptimize] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const fetchCustomApiStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-key')
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        setCustomApi(data.data)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchCustomApiStatus()
    setOptimize(loadFromStorage<boolean>('vocab_optimize_mode', false))
    setHistory(loadHistory())
  }, [fetchCustomApiStatus])

  const charCount = input.length
  const isOverLimit = charCount > MAX_LENGTH
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/translate-only/usage')
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        setIsAdmin(data.data.isAdmin)
        setRemaining(data.data.remaining)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  const handleOptimizeToggle = (checked: boolean) => {
    setOptimize(checked)
    saveToStorage('vocab_optimize_mode', checked)
  }

  const startFakeProgress = () => {
    setProgress(0)
    let current = 0

    progressIntervalRef.current = setInterval(() => {
      current += Math.random() * 8 + 2
      if (current >= 90) {
        current = 90 + Math.random() * 5
      }
      setProgress(Math.min(current, 95))
    }, 300)
  }

  const finishProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setProgress(100)
    setTimeout(() => setProgress(0), 500)
  }

  const handleCustomApiSaved = () => {
    fetchCustomApiStatus()
  }

  const handleClearCustomApi = async () => {
    try {
      await fetch('/api/custom-key', { method: 'DELETE' })
    } catch {}
    setCustomApi(null)
    setShowClearApiDialog(false)
    fetchUsage()
  }

  const handleConfigureApi = () => {
    setShowLimitModal(true)
  }

  const handleTranslate = async () => {
    if (isLoading) return
    if (!input.trim()) return
    setIsClearConfirm(false)

    if (!isAdmin && !customApi?.configured && remaining !== null && remaining <= 0) {
      setShowLimitModal(true)
      return
    }

    const currentInput = input.trim()

    setIsLoading(true)
    startFakeProgress()

    const finishWithError = (message: string) => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(0)
      toast.error(message)
      setIsLoading(false)
    }

    try {
      const controller = new AbortController()
      const BASE_TIMEOUT_MS = 30000
      const PER_1000_MS = 30000
      const MAX_TIMEOUT_MS = 300000
      const extraUnits = Math.max(0, Math.ceil(currentInput.length / 1000) - 1)
      let timeoutMs = Math.min(MAX_TIMEOUT_MS, BASE_TIMEOUT_MS + extraUnits * PER_1000_MS)
      if (optimize) {
        timeoutMs = Math.min(MAX_TIMEOUT_MS, timeoutMs * 2)
      }
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch('/api/translate-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: currentInput,
          deviceId: getDeviceId(),
          optimize,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          if (errorData.error === 'DAILY_LIMIT_EXCEEDED') {
            setShowLimitModal(true)
            return
          }
          throw new Error(errorData.error || errorData.message || 'Translation failed')
        } else {
          throw new Error('Translation service temporarily unavailable. Please try again later.')
        }
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Translation failed')
      }

      const translation = data.data?.translation || ''
      setResult(translation)

      if (data.data?.optimizedInput) {
        setInput(data.data.optimizedInput)
      }

      const newHistory = addHistoryEntry(
        data.data?.optimizedInput || currentInput,
        translation,
        optimize,
        history,
      )
      setHistory(newHistory)

      if (data.usage?.remaining !== undefined) {
        setRemaining(data.usage.remaining)
      } else {
        fetchUsage()
      }

      finishProgress()
      trackTranslateOnly(currentInput.length)
    } catch (error: unknown) {
      const err = error as Error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProgress(0)
      if (err.name === 'AbortError') {
        finishWithError('Translation request timed out. Please try again.')
      } else {
        finishWithError(err.message || 'Translation failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTranslate()
    }
  }

  const handleCopy = async () => {
    if (!result.trim()) return
    try {
      await navigator.clipboard.writeText(result)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  const handleClear = () => {
    if (!isClearConfirm) {
      setIsClearConfirm(true)
      return
    }
    setInput('')
    setResult('')
    setIsClearConfirm(false)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
      setIsClearConfirm(false)
    } catch {
      toast.error('无法读取剪贴板内容')
    }
  }

  const handleHistoryRestore = (entry: HistoryEntry) => {
    setInput(entry.input)
    setResult(entry.output)
  }

  const handleHistoryDelete = (id: string) => {
    const updated = removeHistoryEntry(id)
    setHistory(updated)
  }

  const handleHistoryClear = () => {
    clearHistory()
    setHistory([])
    setHistoryOpen(false)
  }

  const usageText = isAdmin
    ? '管理员 · 无限制'
    : customApi?.configured
      ? '正在使用自定义 API'
      : remaining !== null
        ? `今日剩余免费次数：${remaining} / ${DAILY_LIMIT}`
        : null

  const isUsageLow = !isAdmin && !customApi?.configured && remaining !== null && remaining <= 3

  return (
    <>
      <Card className="border-2 shadow-sm">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
            <div style={{ minWidth: 'max-content' }}>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary" aria-hidden="true" />
                Translate Only
                {customApi?.configured && (
                  <Badge
                    variant="outline"
                    className="ml-1 font-normal text-xs h-5 px-1.5 cursor-pointer gap-0.5"
                    onClick={() => setShowClearApiDialog(true)}
                    title="点击管理自定义 API"
                  >
                    <Settings className="w-3 h-3" /> 自定义 API
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1.5 text-xs sm:text-sm break-words">
                中英互译，最多 {charCount}/{MAX_LENGTH} 字符
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant={isOpen ? 'secondary' : 'outline'}
                size="sm"
                className="gap-1.5 sm:gap-2 h-8 text-xs sm:text-sm px-2.5 sm:px-3"
                aria-expanded={isOpen}
                aria-controls="translate-only-content"
              >
                {isOpen ? '收起' : '打开'}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent id="translate-only-content">
            <CardContent className="pt-0 space-y-3">
              <div className="relative">
                <label htmlFor="translate-only-input" className="sr-only">
                  输入要翻译的文本
                </label>
                <Textarea
                  id="translate-only-input"
                  placeholder="请输入中文或英文..."
                  className="min-h-[110px] resize-y"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setIsClearConfirm(false)
                  }}
                  onKeyDown={handleKeyDown}
                  aria-describedby={isOverLimit ? 'char-limit-warning' : undefined}
                />
                {isOverLimit && (
                  <p id="char-limit-warning" className="text-xs text-destructive mt-1" role="alert">
                    已超过 {MAX_LENGTH} 字符限制
                  </p>
                )}
              </div>

              {usageText && (
                <p
                  className={`text-xs text-right ${
                    isUsageLow && !customApi
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {usageText}
                  {!customApi?.configured && (
                    <>
                      {' · '}
                      <button
                        onClick={handleConfigureApi}
                        className="underline hover:text-foreground"
                      >
                        配置 API
                      </button>
                    </>
                  )}
                  {customApi?.configured && (
                    <>
                      {' · '}
                      <button
                        onClick={() => setShowClearApiDialog(true)}
                        className="underline hover:text-foreground"
                      >
                        清除配置
                      </button>
                    </>
                  )}
                </p>
              )}

              <div className="flex items-center justify-between">
                <label
                  htmlFor="optimize-switch"
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <Switch
                    id="optimize-switch"
                    checked={optimize}
                    onCheckedChange={handleOptimizeToggle}
                    size="sm"
                  />
                  <span
                    className={`text-xs flex items-center gap-1 ${optimize ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                  >
                    <Sparkles className="w-3 h-3" />
                    输出优化
                  </span>
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handlePaste} aria-label="从剪贴板粘贴">
                    <ClipboardPaste className="w-4 h-4 mr-1" aria-hidden="true" />
                    粘贴
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    aria-label={isClearConfirm ? '再次点击确认清空' : '清空输入'}
                  >
                    {isClearConfirm ? '再按一次' : '清空'}
                  </Button>
                  <Button
                    onClick={handleTranslate}
                    disabled={isLoading || !input.trim() || isOverLimit}
                    aria-label="开始翻译"
                  >
                    {isLoading ? '翻译中...' : '开始翻译'}
                  </Button>
                </div>
              </div>

              {isLoading && (
                <div
                  className="space-y-1.5"
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="翻译进度"
                >
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950">
                    <div
                      className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute inset-0 w-full animate-progress-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    </div>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    AI 正在{optimize ? '优化并' : ''}翻译{progress < 95 ? '...' : '，即将完成！'}
                  </p>
                </div>
              )}

              {result && (
                <div className="rounded-md border bg-gray-50 dark:bg-muted/50 p-3">
                  <div className="flex justify-end mb-2">
                    <Button
                      variant={isCopied ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2.5 text-xs gap-1.5"
                      onClick={handleCopy}
                      aria-label={isCopied ? '已复制到剪贴板' : '复制翻译结果'}
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      {isCopied ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {result}
                  </p>
                </div>
              )}

              <div className="border-t pt-3">
                <button
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
                >
                  <History className="w-3.5 h-3.5" />
                  翻译历史
                  {history.length > 0 && <span className="text-[10px]">({history.length})</span>}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                  />
                  <span className="flex-1" />
                  {history.length > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleHistoryClear()
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      清空全部
                    </span>
                  )}
                </button>
                {historyOpen && (
                  <div className="mt-2 max-h-64 overflow-y-auto">
                    {history.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        暂无翻译记录，翻译完成后会自动保存在此
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {history.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => handleHistoryRestore(entry)}
                            className="w-full text-left p-2 rounded-md hover:bg-muted/60 transition-colors group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground truncate">
                                  {entry.input.slice(0, 60)}
                                  {entry.input.length > 60 ? '...' : ''}
                                </p>
                                <p className="text-xs mt-0.5 truncate">
                                  {entry.output.slice(0, 60)}
                                  {entry.output.length > 60 ? '...' : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatTime(entry.timestamp)}
                                </span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleHistoryDelete(entry.id)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
                                  title="删除此条记录"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <LimitExceededModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        onSaved={handleCustomApiSaved}
      />

      <AlertDialog open={showClearApiDialog} onOpenChange={setShowClearApiDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清除自定义 API 配置？</AlertDialogTitle>
            <AlertDialogDescription>
              清除后将恢复使用每日 30 次免费翻译额度。
              {remaining !== null &&
                remaining <= 0 &&
                ' 当前今日免费次数已用完，清除后需配置新的 API 或等待次日刷新。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCustomApi}>确认清除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
