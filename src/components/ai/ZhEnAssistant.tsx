'use client'

import { useEffect, useState } from 'react'
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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  Search,
} from 'lucide-react'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import { AiAssistant } from './AiAssistant'

interface ZhEnWord {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
}

interface ZhEnResult {
  query: string
  total: number
  words: ZhEnWord[]
}

export function ZhEnAssistant() {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user
  const { promptLogin, LoginPromptDialog } = useLoginPrompt()

  const [view, setView] = useState<'zh-en' | 'ai'>('zh-en')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ZhEnResult[] | null>(null)
  const [error, setError] = useState('')

  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [expandedWord, setExpandedWord] = useState<Record<string, boolean>>({})
  const [targetGroup, setTargetGroup] = useState('none')
  const [newGroupName, setNewGroupName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addedNotice, setAddedNotice] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/review-groups')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setGroups(res.data.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
        }
      })
      .catch(() => {})
  }, [isAuthenticated])

  const handleLookup = async () => {
    const words = input
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (words.length === 0 || loading) return
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

  const handleAddWord = async (word: string) => {
    if (!isAuthenticated) {
      promptLogin('加入词库')
      return
    }
    if (!targetGroup || targetGroup === 'none') return
    setAdding(true)
    setAddedNotice('')
    try {
      let targetGroupId = targetGroup
      let groupLabel = groups.find((g) => g.id === targetGroup)?.name ?? ''
      if (targetGroup === 'NEW') {
        const name = newGroupName.trim()
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
      }
      const res = await fetch(`/api/review-groups/${targetGroupId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: [word] }),
      }).then((r) => r.json())
      if (res.success) {
        const added = res.addedCount ?? 0
        setAddedNotice(added > 0 ? `✅ 已将 "${word}" 加入词库"${groupLabel}"` : `"${word}" 已在词库"${groupLabel}"中`)
        setTargetGroup('none')
        setNewGroupName('')
      } else {
        setAddedNotice(`⚠️ ${res.error ?? '加入失败'}`)
      }
    } catch {
      setAddedNotice('⚠️ 执行失败，请稍后重试')
    } finally {
      setAdding(false)
    }
  }

  const enterAi = () => {
    if (!isAuthenticated) {
      promptLogin('AI询问')
      return
    }
    setView('ai')
  }

  if (view === 'ai') {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <Button variant="ghost" size="sm" onClick={() => setView('zh-en')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回中译英
          </Button>
          <span className="text-xs text-muted-foreground">AI 询问 · 每次 10 学力</span>
        </div>
        <div className="flex-1 min-h-0">
          <AiAssistant />
        </div>
        <LoginPromptDialog />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Languages className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">中译英</div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sparkles className="w-3 h-3 text-green-500" />
              查公共词库 · 多英文释义
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={enterAi}>
          <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
          AI 询问
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <Card className="border-2 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">输入中文词或词组</div>
              <p className="text-xs text-muted-foreground mb-2">
                每行一个，最多 20 个。一个中文常有多个英文解释，都会为你列出
              </p>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={'例如：苹果'}
                className="min-h-[120px] resize-y"
                aria-label="输入中文词或词组"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {input.split('\n').filter((l) => l.trim()).length} 个词
              </span>
              <Button onClick={handleLookup} disabled={loading}>
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
            <Card key={`${result.query}-${idx}`} className="border-primary/30">
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
                      找到 {result.total} 个英文表达（一个中文常有多个英文释义）
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
                          const wKey = `${idx}-${w.word}`
                          const isOpen = expandedWord[wKey]
                          return (
                            <div key={w.word} className="border border-border/60 rounded-lg">
                              <button
                                className="w-full flex items-baseline gap-2 text-sm px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                                onClick={() =>
                                  setExpandedWord((prev) => ({ ...prev, [wKey]: !prev[wKey] }))
                                }
                              >
                                <span className="font-medium shrink-0">{w.word}</span>
                                {w.phonetic && (
                                  <span className="text-xs text-muted-foreground shrink-0">{w.phonetic}</span>
                                )}
                                {w.pos && <span className="text-xs text-muted-foreground shrink-0">{w.pos}</span>}
                                <span className="text-xs text-muted-foreground truncate flex-1">
                                  {w.translation}
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                )}
                              </button>
                              {isOpen && (
                                <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border/60">
                                  <div className="space-y-0.5 text-sm">
                                    <div className="flex items-baseline gap-2">
                                      <span className="font-medium">{w.word}</span>
                                      {w.phonetic && (
                                        <span className="text-xs text-muted-foreground">{w.phonetic}</span>
                                      )}
                                    </div>
                                    {w.pos && <div className="text-xs text-muted-foreground">{w.pos}</div>}
                                    <div className="text-sm text-foreground">{w.translation}</div>
                                  </div>
                                  <div className="flex gap-2 items-center">
                                    <Select value={targetGroup} onValueChange={setTargetGroup}>
                                      <SelectTrigger className="flex-1 h-9">
                                        <SelectValue placeholder="选择词库" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">选择词库…</SelectItem>
                                        {groups.map((g) => (
                                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                        <SelectItem value="NEW">＋ 新建词库</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      className="h-9 shrink-0"
                                      onClick={() => handleAddWord(w.word)}
                                      disabled={!targetGroup || targetGroup === 'none' || adding}
                                    >
                                      {adding ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                      ) : (
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                      )}
                                      加入
                                    </Button>
                                  </div>
                                  {targetGroup === 'NEW' && (
                                    <Input
                                      value={newGroupName}
                                      onChange={(e) => setNewGroupName(e.target.value)}
                                      placeholder="新词库名称"
                                      className="h-9"
                                    />
                                  )}
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
                      词库里没有找到对应的英文，试试 AI 询问吧
                    </p>
                    <Button size="sm" variant="outline" onClick={enterAi}>
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                      去 AI 询问
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
