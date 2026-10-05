'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Send, Loader2, Search, FolderPlus, CheckCircle2, XCircle, Lock, ChevronDown, ChevronUp, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'
import { aiHistoryKey, AI_HISTORY_MAX_ITEMS } from '@/lib/aiHistoryCache'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SearchResultMsg {
  type: 'search'
  total: number
  words: { word: string; phonetic: string | null; pos: string | null; translation: string }[]
}

interface ProposalMsg {
  type: 'proposal'
  action: string
  args: Record<string, unknown>
  total?: number
  words?: string[]
  pattern?: { mode: string; value: string }
}

interface FactMsg {
  type: 'fact'
  text: string
  ok: boolean
}

type UiMessage = ChatMessage | SearchResultMsg | ProposalMsg | FactMsg

const assistantMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="my-2 whitespace-pre-wrap leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-primary/50 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a href={href} className="break-all text-primary underline underline-offset-2" rel="noreferrer">
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border" />,
  pre: ({ children }) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-3 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className)
    return (
      <code
        className={isBlock
          ? `${className ?? ''} block whitespace-pre`
          : 'rounded bg-background/70 px-1 py-0.5 font-mono text-[0.9em] break-all'}
      >
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1.5 align-top">{children}</td>,
}

const MAX_WORDS_PER_BATCH = 500
const MAX_BATCH_TOTAL = 2000

function isChat(m: UiMessage): m is ChatMessage {
  return (m as ChatMessage).role !== undefined
}

export function AiAssistant({ onBack, groups: initialGroups }: { onBack?: () => void; groups?: { id: string; name: string }[] }) {
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const { promptLogin, LoginPromptDialog } = useLoginPrompt()

  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [expandedSearch, setExpandedSearch] = useState<number | null>(null)
  const [expandedWord, setExpandedWord] = useState<{ cardIndex: number; word: string } | null>(null)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>(initialGroups ?? [])
  const [wordTargetGroup, setWordTargetGroup] = useState<string>('none')
  const [newGroupName, setNewGroupName] = useState('')
  const [addingWord, setAddingWord] = useState(false)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [proposalGroupSel, setProposalGroupSel] = useState<Record<string, string>>({})
  const [proposalNewName, setProposalNewName] = useState<Record<string, string>>({})
  const [concluding, setConcluding] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialGroups) {
      setGroups(initialGroups)
      return
    }
    if (!isAuthenticated) return
    let cancelled = false
    const controller = new AbortController()
    fetch('/api/review-groups', { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.success && res.data) {
          setGroups(res.data.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
        }
      })
      .catch(() => {})
    return () => { cancelled = true; controller.abort() }
  }, [initialGroups, isAuthenticated])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const userId = session?.user?.id ?? null

  // 挂载时从 localStorage 恢复对话历史（仅纯文本消息与结果行，搜索卡/提议卡不持久化）
  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(aiHistoryKey(userId))
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const restored: UiMessage[] = parsed.filter(
          (m) => m && (m.role === 'user' || m.role === 'assistant' || m.type === 'fact'),
        )
        if (restored.length > 0) setMessages(restored)
      }
    } catch {
      // ignore corrupted cache
    }
  }, [userId])

  // 对话历史变化时持久化（防抖，纯文本消息才存，上限 AI_HISTORY_MAX_ITEMS 条）
  useEffect(() => {
    if (!userId || messages.length === 0) return
    const serializable: unknown[] = []
    for (const m of messages) {
      if (isChat(m)) {
        serializable.push({ role: m.role, content: m.content })
      } else if (m.type === 'fact') {
        serializable.push({ type: 'fact', text: m.text, ok: m.ok })
      }
    }
    const capped = serializable.slice(-AI_HISTORY_MAX_ITEMS)
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(aiHistoryKey(userId), JSON.stringify(capped))
      } catch {
        // storage full — drop cache
        try { localStorage.removeItem(aiHistoryKey(userId)) } catch { /* ignore */ }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [messages, userId])

  const clearHistory = useCallback(() => {
    if (!userId) return
    try {
      localStorage.removeItem(aiHistoryKey(userId))
    } catch { /* ignore */ }
    setMessages([])
  }, [userId])

  const pushChat = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [...prev, { role, content }])
  }, [])

  const handleSend = async () => {
    const text = (inputRef.current?.value ?? input).trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)
    setConcluding(false)

    const fullHistory = messages.map((m) => {
      if (isChat(m)) return { role: m.role, content: m.content }
      if (m.type === 'fact') return { role: 'assistant' as const, content: m.text }
      return null
    }).filter((m): m is { role: 'user' | 'assistant'; content: string } => m !== null)

    pushChat('user', text)
    const nextHistory = [...fullHistory, { role: 'user', content: text }]

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => null)
        const err = j?.error || '请求失败'
        pushChat('assistant', `⚠️ ${err}`)
        setBusy(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        pushChat('assistant', '⚠️ 无法读取响应')
        setBusy(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let firstTextSeen = false

      const parseEvent = (part: string) => {
        let eventType = ''
        let dataRaw = ''
        for (const line of part.split('\n')) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim()
          else if (line.startsWith('data:')) dataRaw += line.slice(5).trim()
        }
        if (!dataRaw) return
        let data: Record<string, unknown>
        try {
          data = JSON.parse(dataRaw)
        } catch {
          return
        }
        if (eventType === 'text') {
          const text = String(data.text ?? '')
          const isDelta = data.delta === true
          if (isDelta) {
            // 流式增量：追加到最后一个 assistant 气泡
            firstTextSeen = true
            setMessages((prev) => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last && (last as ChatMessage).role === 'assistant') {
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: (last as ChatMessage).content + text,
                }
              } else {
                copy.push({ role: 'assistant', content: text })
              }
              return copy
            })
          } else {
            // 完整文本：覆盖（保证最终一致），但不要重复追加（流式已渲染时仅替换）
            if (firstTextSeen) {
              setMessages((prev) => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last && (last as ChatMessage).role === 'assistant') {
                  copy[copy.length - 1] = { role: 'assistant', content: text }
                }
                return copy
              })
            } else {
              setMessages((prev) => [...prev, { role: 'assistant', content: text }])
              firstTextSeen = true
            }
          }
        } else if (eventType === 'search_result') {
          const d = data as { tool?: string; data?: { total?: number; words?: SearchResultMsg['words'] } }
          if (d.tool === 'search_words' && d.data) {
            setMessages((prev) => [...prev, { type: 'search', total: d.data!.total ?? 0, words: d.data!.words ?? [] }])
          }
        } else if (eventType === 'proposal') {
          const d = data as { action?: string; args?: Record<string, unknown>; total?: number; pattern?: { mode: string; value: string } }
          const args = d.args ?? {}
          const words = Array.isArray(args.words) ? (args.words as string[]) : []
          setMessages((prev) => [...prev, { type: 'proposal', action: d.action ?? '', args, total: d.total, words, pattern: d.pattern }])
        } else if (eventType === 'done') {
          setBusy(false)
        } else if (eventType === 'error') {
          setBusy(false)
          pushChat('assistant', `⚠️ ${String(data.error ?? '出错了')}`)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (part.trim()) parseEvent(part)
        }
      }
      if (buffer.trim()) parseEvent(buffer)
    } catch (e) {
      console.error(e)
      pushChat('assistant', '⚠️ 网络异常，请稍后重试')
      setBusy(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 输入法组合输入（中文/拼音选词）中的回车用于确认候选词，不应触发发送
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleConfirmProposal = async (index: number, full = false) => {
    const msg = messages[index]
    if (!msg || (msg as ProposalMsg).type !== 'proposal') return
    const proposal = msg as ProposalMsg
    const args = proposal.args ?? {}
    const words = Array.isArray(args.words) ? (args.words as string[]) : []
    const suggestedGroupName = typeof args.groupName === 'string' ? args.groupName : null
    const suggestedGroupId = typeof args.groupId === 'string' ? args.groupId : null
    // 用户可自定义目标词库（选择器里的选择），否则退回模型建议
    const userTarget = proposalGroupSel[String(index)]
    const userNewName = (proposalNewName[String(index)] ?? '').trim()

    setConfirming(index)
    try {
      let targetGroupId: string | null = null
      let groupLabel = ''

      if (userTarget && userTarget !== 'none' && userTarget !== 'NEW') {
        // 用户从现有词库中选择
        targetGroupId = userTarget
        groupLabel = groups.find((g) => g.id === userTarget)?.name ?? ''
      } else if (userTarget === 'NEW') {
        // 用户要新建词库
        if (!userNewName) {
          setMessages((prev) => [...prev, { type: 'fact', text: '请输入新词库名称', ok: false }])
          return
        }
        const created = await fetch('/api/review-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: userNewName }),
        }).then((r) => r.json())
        if (created.success && created.data?.id) {
          targetGroupId = created.data.id
          groupLabel = created.data.name
          setGroups((prev) => [...prev, { id: created.data.id, name: created.data.name }])
        } else {
          setMessages((prev) => [...prev, { type: 'fact', text: `⚠️ ${created.error ?? '创建词库失败'}`, ok: false }])
          return
        }
      } else {
        // 未自定义 → 用模型建议（groupName 自动建组 / groupId）
        if (suggestedGroupId) {
          targetGroupId = suggestedGroupId
          groupLabel = groups.find((g) => g.id === suggestedGroupId)?.name ?? ''
        } else if (suggestedGroupName) {
          const existing = await fetch('/api/review-groups').then((r) => r.json())
          const gs = existing.success ? existing.data : []
          const match = gs.find((g: { id: string; name: string }) => g.name === suggestedGroupName)
          if (match) {
            targetGroupId = match.id
            groupLabel = match.name
          } else {
            const created = await fetch('/api/review-groups', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: suggestedGroupName }),
            }).then((r) => r.json())
            if (created.success && created.data?.id) {
              targetGroupId = created.data.id
              groupLabel = created.data.name
              setGroups((prev) => [...prev, { id: created.data.id, name: created.data.name }])
            } else {
              setMessages((prev) => [...prev, { type: 'fact', text: `⚠️ ${created.error ?? '创建词库失败'}`, ok: false }])
              return
            }
          }
        }
      }

      if (!targetGroupId) {
        setMessages((prev) => [...prev, { type: 'fact', text: '⚠️ 缺少目标词库', ok: false }])
        return
      }

      const addToGroup = async (payload: Record<string, unknown>) => {
        const r = await fetch(`/api/review-groups/${targetGroupId}/words`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then((x) => x.json())
        return r
      }

      let totalAdded = 0
      let totalNotFound: string[] = []

      if (full && proposal.pattern) {
        // 全部加入：按 pattern 服务端重查全量（单次处理 2000 上限）
        const r = await addToGroup({ pattern: proposal.pattern })
        if (r.success) {
          totalAdded = r.addedCount ?? 0
          totalNotFound = r.notFound ?? []
        }
      } else {
        // 加入展示的单词：分批加词（单批 500，硬上限 2000）
        const capped = words.slice(0, MAX_BATCH_TOTAL)
        for (let i = 0; i < capped.length; i += MAX_WORDS_PER_BATCH) {
          const batch = capped.slice(i, i + MAX_WORDS_PER_BATCH)
          const r = await addToGroup({ words: batch })
          if (r.success) {
            totalAdded += r.addedCount ?? 0
            totalNotFound = totalNotFound.concat(r.notFound ?? [])
          }
        }
      }

      const label = groupLabel || suggestedGroupName || ''
      setMessages((prev) => [
        ...prev,
        {
          type: 'fact',
          text: `✅ 已加入 ${totalAdded} 个单词到词库"${label}"${totalNotFound.length ? `（${totalNotFound.length} 个不存在已跳过）` : ''}`,
          ok: true,
        },
      ])
    } catch {
      setMessages((prev) => [...prev, { type: 'fact', text: '⚠️ 执行失败，请稍后重试', ok: false }])
    } finally {
      setConfirming(null)
    }
  }

  // 单个单词加入词库（搜索卡内点击"加入"）：选现有组或新建
  const handleAddSingleWord = async (word: string) => {
    if (!wordTargetGroup || wordTargetGroup === 'none') return
    setAddingWord(true)
    try {
      let targetGroupId = wordTargetGroup
      if (wordTargetGroup === 'NEW') {
        const name = newGroupName.trim()
        if (!name) {
          setMessages((prev) => [...prev, { type: 'fact', text: '请输入新词库名称', ok: false }])
          return
        }
        const created = await fetch('/api/review-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }).then((r) => r.json())
        if (!created.success || !created.data?.id) {
          setMessages((prev) => [...prev, { type: 'fact', text: `⚠️ ${created.error ?? '创建词库失败'}`, ok: false }])
          return
        }
        targetGroupId = created.data.id
        setGroups((prev) => [...prev, { id: created.data.id, name: created.data.name }])
      }
      const res = await fetch(`/api/review-groups/${targetGroupId}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: [word] }),
      }).then((r) => r.json())
      const groupName = groups.find((g) => g.id === targetGroupId)?.name ?? newGroupName.trim() ?? wordTargetGroup
      if (res.success) {
        const added = res.addedCount ?? 0
        setMessages((prev) => [
          ...prev,
          {
            type: 'fact',
            text: added > 0
              ? `✅ 已将 "${word}" 加入词库"${groupName}"`
              : `"${word}" 已在词库"${groupName}"中`,
            ok: true,
          },
        ])
      } else {
        setMessages((prev) => [...prev, { type: 'fact', text: `⚠️ ${res.error ?? '加入失败'}`, ok: false }])
      }
    } catch {
      setMessages((prev) => [...prev, { type: 'fact', text: '⚠️ 执行失败，请稍后重试', ok: false }])
    } finally {
      setAddingWord(false)
      setExpandedWord(null)
      setWordTargetGroup('none')
      setNewGroupName('')
    }
  }

  const renderMessage = (m: UiMessage, i: number) => {
    if (isChat(m)) {
      const isUser = m.role === 'user'
      return (
        <div key={i} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
              isUser ? 'bg-primary/10 text-primary' : ''
            } overflow-hidden`}
          >
            {isUser ? (
              <span className="text-xs font-semibold">{(session?.user?.name || '我').charAt(0)}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
            )}
          </div>
          <div
            className={`${isUser ? 'max-w-[85%] whitespace-pre-wrap' : 'min-w-0 max-w-4xl flex-1'} px-3 py-2 rounded-2xl text-sm break-words ${
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-muted text-foreground rounded-tl-sm'
            }`}
          >
            {isUser ? m.content : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={assistantMarkdownComponents}>
                {m.content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      )
    }

    if (m.type === 'search') {
      const expanded = expandedSearch === i
      return (
        <div key={i} className="flex gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
          </div>
          <div className="min-w-0 max-w-4xl flex-1">
            <Card className="border-primary/20">
              <CardContent className="p-3 space-y-2">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setExpandedSearch(expanded ? null : i)}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Search className="w-4 h-4 text-primary" />
                    公共词库搜索到 {m.total} 个单词
                  </span>
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expanded && (
                  <div className="space-y-1.5">
                    {m.words.map((w) => {
                      const isWordExpanded = expandedWord?.cardIndex === i && expandedWord.word === w.word
                      return (
                        <div key={w.word} className="border border-border/60 rounded-lg">
                          <button
                            className="w-full flex items-baseline gap-2 text-sm px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                            onClick={() =>
                              setExpandedWord(
                                isWordExpanded ? null : { cardIndex: i, word: w.word },
                              )
                            }
                          >
                            <span className="font-medium shrink-0">{w.word}</span>
                            {w.phonetic && (
                              <span className="text-xs text-muted-foreground shrink-0">{w.phonetic}</span>
                            )}
                            {w.pos && <span className="text-xs text-muted-foreground shrink-0">{w.pos}</span>}
                            <span className="text-xs text-muted-foreground truncate flex-1">{w.translation}</span>
                            {isWordExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                          </button>
                          {isWordExpanded && (
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
                                <Select
                                  value={wordTargetGroup}
                                  onValueChange={(v) => setWordTargetGroup(v)}
                                >
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
                                  onClick={() => handleAddSingleWord(w.word)}
                                  disabled={!wordTargetGroup || wordTargetGroup === 'none' || addingWord}
                                >
                                  {addingWord ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  加入
                                </Button>
                              </div>
                              {wordTargetGroup === 'NEW' && (
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
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    if (m.type === 'proposal') {
      const words = m.words ?? []
      const groupName = typeof m.args.groupName === 'string' ? m.args.groupName : null
      const suggestedGroupId = typeof m.args.groupId === 'string' ? m.args.groupId : null
      const actionLabel = m.action === 'create_group' ? '新建词库' : '加入单词'
      const isAddWords = m.action === 'add_words_to_group'
      // 默认选中模型建议的组；用户可在选择器中改选
      const selKey = String(i)
      const defaultSel = suggestedGroupId || (groupName ? (groups.find((g) => g.name === groupName)?.id ?? 'NEW') : 'none')
      const currentSel = proposalGroupSel[selKey] ?? defaultSel
      return (
        <div key={i} className="flex gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
          </div>
          <div className="min-w-0 max-w-4xl flex-1">
            <Card className="border-amber-400/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <FolderPlus className="w-4 h-4 text-amber-500" />
                  <span>提议：{actionLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {m.action === 'create_group'
                    ? `将新建词库"${groupName ?? ''}"`
                    : m.pattern && m.total
                      ? `将匹配的 ${m.total} 个单词加入${currentSel !== 'none' && currentSel !== 'NEW' ? `词库"${groups.find((g) => g.id === currentSel)?.name ?? ''}"` : groupName ? `词库"${groupName}"` : '词库'}`
                      : `将 ${words.length} 个单词加入${currentSel !== 'none' && currentSel !== 'NEW' ? `词库"${groups.find((g) => g.id === currentSel)?.name ?? ''}"` : groupName ? `词库"${groupName}"` : '词库'}`}
                  {m.pattern && m.total
                    ? `（共匹配 ${m.total} 个）`
                    : m.total && m.total > words.length
                      ? `（共匹配 ${m.total} 个，展示 ${words.length} 个）`
                      : ''}
                </p>
                {isAddWords && words.length > 0 && (
                  <div className="text-xs text-muted-foreground line-clamp-2 break-words">
                    {words.slice(0, 10).join('、')}
                    {words.length > 10 ? ` 等 ${words.length} 个` : ''}
                  </div>
                )}
                {isAddWords && (
                  <div className="space-y-2">
                    <Select
                      value={currentSel}
                      onValueChange={(v) => setProposalGroupSel((prev) => ({ ...prev, [selKey]: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="选择目标词库" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">选择词库…</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                        <SelectItem value="NEW">＋ 新建词库</SelectItem>
                      </SelectContent>
                    </Select>
                    {currentSel === 'NEW' && (
                      <Input
                        value={proposalNewName[selKey] ?? ''}
                        onChange={(e) => setProposalNewName((prev) => ({ ...prev, [selKey]: e.target.value }))}
                        placeholder="新词库名称"
                        className="h-9"
                      />
                    )}
                  </div>
                )}
                <div className="flex gap-2 pt-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMessages((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={confirming === i}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> 取消
                  </Button>
                  {m.action === 'add_words_to_group' && m.pattern && m.total ? (
                    // pattern 模式：提供"加入全部 N 个"（words 可能为空或仅示例，以 total 为准）
                    <Button size="sm" onClick={() => handleConfirmProposal(i, true)} disabled={confirming === i}>
                      {confirming === i ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      )}
                      确认加入全部 {m.total} 个
                    </Button>
                  ) : m.action === 'add_words_to_group' && m.total && m.total > words.length ? (
                    <>
                      <Button size="sm" onClick={() => handleConfirmProposal(i, false)} disabled={confirming === i}>
                        {confirming === i ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        加入前 {words.length} 个
                      </Button>
                      {m.pattern && (
                        <Button size="sm" variant="secondary" onClick={() => handleConfirmProposal(i, true)} disabled={confirming === i}>
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          加入全部 {m.total} 个
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="sm" onClick={() => handleConfirmProposal(i, false)} disabled={confirming === i}>
                      {confirming === i ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      )}
                      确认执行
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    // fact
    return (
      <div key={i} className="flex gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
        </div>
        <div
          className={`min-w-0 max-w-4xl flex-1 px-3 py-2 rounded-2xl text-sm break-words ${
            m.ok ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {m.text}
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ai.jpg" alt="ego-ai助手" className="w-16 h-16 rounded-full object-cover" />
        </div>
        <div>
          <p className="text-lg font-semibold">ego-ai助手</p>
          <p className="text-sm text-muted-foreground">单词查询与词库整理 AI 助手</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          登录后即可使用 AI 询问
        </div>
        <Button onClick={() => promptLogin('AI询问')}>去登录</Button>
        {onBack && <Button variant="ghost" onClick={onBack}>返回翻译</Button>}
        <LoginPromptDialog />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0">
      <div data-ai-assistant-header className="flex shrink-0 items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {onBack && <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="返回翻译" onClick={onBack}><ArrowLeft size={18} /></Button>}
          <div className="w-8 h-8 rounded-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
          </div>
          <div>
            <span className="text-sm font-semibold">ego-ai助手</span>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              if (window.confirm('清空本次对话记录？')) clearHistory()
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 [overflow-wrap:anywhere]">
        <div className="space-y-4">
          {messages.length === 0 && !busy && (
            <div className="text-center text-muted-foreground text-sm py-10 space-y-3">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ai.jpg" alt="ego-ai助手" className="w-14 h-14 rounded-full object-cover" />
                </div>
              </div>
              <p>我是 ego-ai助手，可以帮你：</p>
              <div className="text-xs space-y-1">
                <p>🔍 查找以 ed 结尾 / un 开头的单词</p>
                <p>📁 新建词库、把单词批量加进词库</p>
              </div>
            </div>
          )}
          {messages.map((m, i) => renderMessage(m, i))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {concluding ? 'ego-ai助手 思考中…' : 'ego-ai助手 处理中…'}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 p-3 border-t space-y-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问我任何单词问题，如：找以ed结尾的单词…"
            rows={2}
            className="min-w-0 flex-1 max-h-28 resize-none overflow-y-auto text-base md:text-base"
            disabled={busy}
          />
          <div className="flex shrink-0 flex-col gap-1">
            <Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSend} disabled={busy || !input.trim()} aria-label="发送消息">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
