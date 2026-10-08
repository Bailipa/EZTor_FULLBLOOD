'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Languages,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  Search,
  Copy,
} from 'lucide-react'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import { Checkbox } from '@/components/ui/checkbox'
import styles from './translation-workspace.module.css'

const AiAssistant = dynamic(
  () => import('./AiAssistant').then((module) => module.AiAssistant),
  { loading: () => <div className="p-6 text-sm text-muted-foreground" role="status">正在打开AI助手…</div> },
)

interface ZhEnWord {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  matchType?: 'exact' | 'contains'
}

interface ZhEnResult {
  query: string
  total: number
  hasMore?: boolean
  words: ZhEnWord[]
}

interface ZhEnAssistantProps {
  view: 'zh-en' | 'text' | 'ai'
  onViewChange?: (view: 'zh-en' | 'text' | 'ai') => void
  groups?: { id: string; name: string }[]
}

export function ZhEnAssistant({ view, onViewChange, groups: initialGroups = [] }: ZhEnAssistantProps) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const { promptLogin, LoginPromptDialog } = useLoginPrompt()

  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const lookupInputRef = useRef<HTMLTextAreaElement>(null)
  const [groups, setGroups] = useState(initialGroups)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ZhEnResult[] | null>(null)
  const [error, setError] = useState('')

  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [targetGroups, setTargetGroups] = useState<Record<string, string>>({})
  const [newGroupNames, setNewGroupNames] = useState<Record<string, string>>({})
  const [addingWord, setAddingWord] = useState<string | null>(null)
  const [addedNotice, setAddedNotice] = useState('')
  const [textInput, setTextInput] = useState('')
  const [textResult, setTextResult] = useState('')
  const [textOptimize, setTextOptimize] = useState(false)
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState('')
  const [copyNotice, setCopyNotice] = useState('')

  useEffect(() => {
    setGroups(initialGroups)
  }, [initialGroups])

  const handleTextTranslate = async () => {
    if (!isAuthenticated) {
      promptLogin('文本翻译')
      return
    }
    const inputText = (textInputRef.current?.value ?? textInput).trim()
    if (!inputText || textLoading) return
    setTextLoading(true)
    setTextError('')
    setCopyNotice('')
    try {
      const res = await fetch('/api/translate-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText, optimize: textOptimize }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        setTextError(result.message || result.error || '翻译失败，请稍后重试')
        return
      }
      setTextResult(result.data?.translation || '')
    } catch {
      setTextError('网络异常，原文已保留，请检查连接后重试')
    } finally {
      setTextLoading(false)
    }
  }

  const copyTranslation = async () => {
    try {
      await navigator.clipboard.writeText(textResult)
      setCopyNotice('已复制译文')
    } catch {
      setCopyNotice('复制失败，请手动选择译文')
    }
  }

  const handleLookup = async () => {
    const words = (lookupInputRef.current?.value ?? input)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (words.length === 0 || loading) return
    if (words.length > 20) {
      setError('一次最多查询 20 行。原文已保留，请拆分后重试。')
      return
    }
    setLoading(true)
    setError('')
    setAddedNotice('')
    try {
      const res = await fetch('/api/zh-to-en', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        setError(j.error || '查询失败，请稍后重试')
        setResults(null)
      } else {
        setResults(j.data)
      }
    } catch {
      setError('网络异常，请稍后重试')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAddWord = async (word: string, wordKey: string) => {
    if (!isAuthenticated) {
      promptLogin('加入词库')
      return
    }
    const targetGroup = targetGroups[wordKey] ?? 'none'
    if (!targetGroup || targetGroup === 'none') return
    setAddingWord(word)
    setAddedNotice('')
    try {
      let targetGroupId = targetGroup
      let groupLabel = groups.find((g) => g.id === targetGroup)?.name ?? ''
      if (targetGroup === 'NEW') {
        const name = (newGroupNames[wordKey] ?? '').trim()
        if (!name) {
          setAddedNotice('请输入新词库名称')
          return
        }
        const created = await fetch('/api/review-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }).then((r) => r.json())
        if (!created.success || !created.data?.id) {
          setAddedNotice(`⚠️ ${created.error ?? '创建词库失败'}`)
          return
        }
        targetGroupId = created.data.id
        groupLabel = created.data.name
        setGroups((prev) => [...prev, { id: created.data.id, name: created.data.name }])
        setTargetGroups((prev) => ({ ...prev, [wordKey]: created.data.id }))
      }
      const res = await fetch(`/api/review-groups/${targetGroupId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: [word] }),
      }).then((r) => r.json())
      if (res.success) {
        const added = res.addedCount ?? 0
        setAddedNotice(added > 0 ? `✅ 已将 "${word}" 加入词库"${groupLabel}"` : `"${word}" 已在词库"${groupLabel}"中`)
        setTargetGroups((prev) => ({ ...prev, [wordKey]: 'none' }))
        setNewGroupNames((prev) => ({ ...prev, [wordKey]: '' }))
      } else {
        setAddedNotice(`⚠️ ${res.error ?? '加入失败'}`)
      }
    } catch {
      setAddedNotice('⚠️ 执行失败，请稍后重试')
    } finally {
      setAddingWord(null)
    }
  }

  const enterAi = () => {
    if (!isAuthenticated) {
      promptLogin('AI询问')
      return
    }
    onViewChange?.('ai')
  }

  if (view === 'ai') {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 min-w-0 flex-1">
          <AiAssistant groups={groups} />
        </div>
        <LoginPromptDialog />
      </div>
    )
  }

  if (view === 'text') {
    return (
      <div className="space-y-4">
        <div data-desk-sentence className={`grid items-stretch gap-4 lg:grid-cols-2 ${styles.sentenceSheet}`}>
          <Card className={`min-w-0 py-0 ${styles.sentencePane}`}>
            <CardContent className={`space-y-3 p-4 ${styles.sentenceBody}`}>
              <div className="flex items-center justify-between">
                <label htmlFor="text-translation-input" className="flex min-h-11 items-center text-sm font-medium">原文</label>
              </div>
              <Textarea
                ref={textInputRef}
                id="text-translation-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="输入要翻译的句子或段落…"
                className={`min-h-36 resize-y text-base lg:min-h-80 ${styles.sentenceInput}`}
                maxLength={8000}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox checked={textOptimize} onCheckedChange={(checked) => setTextOptimize(checked === true)} />
                  翻译前润色原文（可选）
                </label>
                <span className="text-xs text-muted-foreground">{textInput.length}/8000</span>
              </div>
              {textError && <p role="alert" className="text-sm text-destructive">{textError}</p>}
              <Button className="min-h-11 w-full sm:w-auto" onClick={handleTextTranslate} disabled={textLoading || !textInput.trim()}>
                {textLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />翻译中…</>
                  : <><Languages className="mr-2 h-4 w-4" />开始翻译</>}
              </Button>
            </CardContent>
          </Card>
          <Card data-desk-sentence-result={!!textResult} className={`min-w-0 py-0 ${styles.sentencePane} ${textResult ? 'ring-primary/30' : 'hidden lg:flex'}`}>
            <CardContent className={`flex flex-1 flex-col gap-3 p-4 ${styles.sentenceBody}`}>
              <div className="flex min-h-11 items-center justify-between gap-2">
                <h2 className="font-medium">译文</h2>
                {textResult && <Button variant="outline" className="min-h-11" onClick={copyTranslation}>
                  <Copy className="mr-2 h-4 w-4" />复制
                </Button>}
              </div>
              {textResult ? (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 lg:text-lg lg:leading-[1.9]">{textResult}</p>
                  <p className="text-xs text-muted-foreground">未加入词库</p>
                </>
              ) : (
                <div className="flex min-h-36 flex-1 items-center justify-center text-sm text-muted-foreground">译文显示在这里</div>
              )}
              {copyNotice && <p role="status" className="text-xs text-muted-foreground">{copyNotice}</p>}
            </CardContent>
          </Card>
        </div>
        <LoginPromptDialog />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`space-y-4 ${styles.lookupContent}`}>
        <Card data-desk-lookup className={`py-0 shadow-sm ${styles.supplementQuery}`}>
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between"><label htmlFor="zh-en-lookup-input" className="text-sm font-medium">输入中文词或词组</label></div>
              <p className="text-xs text-muted-foreground mb-2">每行一个，最多 20 行</p>
              <Textarea
                ref={lookupInputRef}
                id="zh-en-lookup-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={'例如：苹果'}
                className="min-h-[120px] resize-y text-base md:text-base"
                aria-label="输入中文词或词组"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {input.split('\n').filter((l) => l.trim()).length}/20 行
              </span>
              <Button className="min-h-11" onClick={handleLookup} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" /> 查询中...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-1" /> 中译英
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {addedNotice && <div className="text-sm text-muted-foreground">{addedNotice}</div>}

        {loading && (
          <div className="text-center text-sm text-muted-foreground py-6">查询公共词库中...</div>
          )}

        {!loading &&
          results?.map((result, idx) => (
            <Card key={`${result.query}-${idx}`} className={`py-0 ring-primary/30 ${styles.supplementResult}`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium min-w-0">
                    <Languages className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">中译英：{result.query}</span>
                  </span>
                </div>
                {result.total > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      找到 {result.total} 个公共词库候选，按释义匹配。
                      {result.hasMore && ` 当前展示前 ${result.words.length} 条，可缩小中文查询词。`}
                    </p>
                    <button
                      className="flex items-center justify-between w-full text-left"
                      onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    >
                      <span className="text-xs text-muted-foreground">
                        {expanded[idx] === false ? '展开候选' : '收起候选'}
                      </span>
                      {expanded[idx] === false ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {(expanded[idx] !== false) && (
                      <div className="space-y-1.5">
                        {result.words.map((w) => {
                          const wKey = `${result.query}-${idx}-${w.word}`
                          const targetGroup = targetGroups[wKey] ?? 'none'
                          return (
                            <div key={w.word} className={`rounded-lg border border-border/60 p-3 ${styles.supplementWord}`}>
                              <div className={styles.supplementWordInfo}>
                                <div className={styles.supplementWordHeading}>
                                  <span className="font-medium">{w.word}</span>
                                  {w.phonetic && <span className="text-sm text-muted-foreground">{w.phonetic}</span>}
                                  {w.pos && <span className="text-sm text-muted-foreground">{w.pos}</span>}
                                </div>
                                <p className={styles.supplementWordTranslation}>{w.translation}</p>
                                <div className={styles.supplementWordFooter}>
                                  {w.matchType && <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{w.matchType === 'exact' ? '完整匹配' : '包含匹配'}</span>}
                                </div>
                              </div>
                              {isAuthenticated && (
                                <div className={styles.supplementWordActions} data-supplement-word-actions>
                                  <Select value={targetGroup} onValueChange={(value) => setTargetGroups((prev) => ({ ...prev, [wKey]: value }))}>
                                    <SelectTrigger className="min-h-11 w-full" aria-label={`选择保存 ${w.word} 的词库`}>
                                      <SelectValue placeholder="选择词库…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">选择词库…</SelectItem>
                                      {groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}
                                      <SelectItem value="NEW">＋ 新建词库</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {targetGroup === 'NEW' && (
                                    <Input
                                      value={newGroupNames[wKey] ?? ''}
                                      onChange={(event) => setNewGroupNames((prev) => ({ ...prev, [wKey]: event.target.value }))}
                                      placeholder="新词库名称"
                                      className="min-h-11 w-full text-base"
                                    />
                                  )}
                                  <Button
                                    variant="outline"
                                    className="min-h-11 w-full px-3"
                                    onClick={() => handleAddWord(w.word, wKey)}
                                    disabled={!targetGroup || targetGroup === 'none' || addingWord !== null}
                                  >
                                    {addingWord === w.word ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Plus className="mr-1 size-4" />}
                                    加入
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      词库里没有找到对应的英文。
                    </p>
                    <Button size="sm" variant="outline" onClick={enterAi}>
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                      问AI助手
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
      </div>
      <LoginPromptDialog />
    </div>
  )
}
