'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Zap, Sparkles, Send, Loader2, Search, FolderPlus, CheckCircle2, XCircle, Lock, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useLoginPrompt } from '@/components/ui/login-prompt-modal'

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

const MAX_WORDS_PER_BATCH = 500
const MAX_BATCH_TOTAL = 2000

function isChat(m: UiMessage): m is ChatMessage {
  return (m as ChatMessage).role !== undefined
}

export function AiAssistant() {
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const { promptLogin, LoginPromptDialog } = useLoginPrompt()

  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [isAiFree, setIsAiFree] = useState(false)
  const [expandedSearch, setExpandedSearch] = useState<number | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [concluding, setConcluding] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    fetch('/api/game/profile')
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setBalance(res.data.combatPower)
        }
      })
      .catch(() => {})
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setIsAiFree(res.isAiFree)
      })
      .catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const pushChat = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [...prev, { role, content }])
  }, [])

  const handleSend = async () => {
    const text = input.trim()
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
        const err = j?.error || (res.status === 402 ? '学力不足' : '请求失败')
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
          if (!firstTextSeen) {
            setMessages((prev) => [...prev, { role: 'assistant', content: '' }])
            firstTextSeen = true
          }
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && (last as ChatMessage).role === 'assistant') {
              copy[copy.length - 1] = { role: 'assistant', content: text }
            }
            return copy
          })
          if (data.isAiFree === true) setIsAiFree(true)
          if (typeof data.deducted === 'boolean' && data.deducted) {
            setBalance((b) => (b === null ? b : Math.max(0, b - 10)))
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
    const groupName = typeof args.groupName === 'string' ? args.groupName : null
    const groupId = typeof args.groupId === 'string' ? args.groupId : null

    setConfirming(index)
    try {
      let targetGroupId = groupId
      if (!targetGroupId && groupName) {
        const existing = await fetch('/api/review-groups').then((r) => r.json())
        const groups = existing.success ? existing.data : []
        const match = groups.find((g: { id: string; name: string }) => g.name === groupName)
        if (match) {
          targetGroupId = match.id
        } else {
          const created = await fetch('/api/review-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: groupName }),
          }).then((r) => r.json())
          if (created.success && created.data?.id) {
            targetGroupId = created.data.id
          } else {
            setMessages((prev) => [...prev, { type: 'fact', text: `⚠️ ${created.error ?? '创建词库失败'}`, ok: false }])
            return
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

      const groupLabel = groupName ?? proposal.args.groupId ?? ''
      setMessages((prev) => [
        ...prev,
        {
          type: 'fact',
          text: `✅ 已加入 ${totalAdded} 个单词到词库"${groupLabel}"${totalNotFound.length ? `（${totalNotFound.length} 个不存在已跳过）` : ''}`,
          ok: true,
        },
      ])
    } catch {
      setMessages((prev) => [...prev, { type: 'fact', text: '⚠️ 执行失败，请稍后重试', ok: false }])
    } finally {
      setConfirming(null)
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
            className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-muted text-foreground rounded-tl-sm'
            }`}
          >
            {m.content}
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
          <div className="max-w-[85%] w-full">
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
                  <div className="space-y-1">
                    {m.words.map((w) => (
                      <div key={w.word} className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium">{w.word}</span>
                        {w.phonetic && <span className="text-xs text-muted-foreground">{w.phonetic}</span>}
                        {w.pos && <span className="text-xs text-muted-foreground">{w.pos}</span>}
                        <span className="text-xs text-muted-foreground truncate">{w.translation}</span>
                      </div>
                    ))}
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
      const actionLabel = m.action === 'create_group' ? '新建词库' : '加入单词'
      const confirmKey = `proposal-${i}`
      void confirmKey
      return (
        <div key={i} className="flex gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
          </div>
          <div className="max-w-[85%] w-full">
            <Card className="border-amber-400/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <FolderPlus className="w-4 h-4 text-amber-500" />
                  <span>提议：{actionLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {m.action === 'create_group'
                    ? `将新建词库"${groupName ?? ''}"`
                    : `将 ${words.length} 个单词加入${groupName ? `词库"${groupName}"` : '词库'}`}
                  {m.total && m.total > words.length ? `（共匹配 ${m.total} 个，展示 ${words.length} 个）` : ''}
                </p>
                {m.action === 'add_words_to_group' && words.length > 0 && (
                  <div className="text-xs text-muted-foreground line-clamp-2 break-words">
                    {words.slice(0, 10).join('、')}
                    {words.length > 10 ? ` 等 ${words.length} 个` : ''}
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
                  {m.action === 'add_words_to_group' && m.total && m.total > words.length ? (
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
          className={`px-3 py-2 rounded-2xl text-sm break-words max-w-[80%] ${
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
        <LoginPromptDialog />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ai.jpg" alt="ego-ai助手" className="w-8 h-8 rounded-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">ego-ai助手</span>
              {isAiFree && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 rounded-full px-1.5 py-0.5">
                  <Sparkles className="w-3 h-3" /> AI 免费
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Zap className="w-3 h-3 text-amber-500" />
              每次提问消耗 10 学力{isAiFree ? '（当前免费）' : balance !== null ? `（当前 ${balance}）` : ''}
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
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

      <div className="p-3 border-t space-y-2">
        {!isAiFree && balance !== null && balance < 10 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            学力不足（当前 {balance}），完成每日任务或默写可赚取学力
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问我任何单词问题，如：找以ed结尾的单词…"
            rows={2}
            disabled={busy || (!isAiFree && balance !== null && balance < 10)}
          />
          <Button size="icon" onClick={handleSend} disabled={busy || !input.trim() || (!isAiFree && balance !== null && balance < 10)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
