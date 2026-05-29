'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Send, Trash, Ban, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { isDeveloper, getDisplayName, getAvatar } from '@/lib/chatUser'

interface Message {
  id: string
  userId: string
  content: string
  isHidden: boolean
  isDeleted: boolean
  createdAt: string
  User: {
    id: string
    username: string
    isAdmin?: boolean
  }
}

const MAX_CONTENT_LENGTH = 300

export function ChatRoom() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isShadowBanned, setIsShadowBanned] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const admin = session?.user ? isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin }) : false

  const fetchMessages = useCallback(async (loadMore = false) => {
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (loadMore && cursor) {
        params.set('cursor', cursor)
      }

      const res = await fetch(`/api/chat/messages?${params}`)
      const data = await res.json()

      if (data.success) {
        if (loadMore) {
          setMessages(prev => [...data.data, ...prev])
        } else {
          setMessages(data.data)
        }
        setHasMore(data.pagination.hasMore)
        setCursor(data.pagination.nextCursor)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [cursor])

  const fetchOnlineCount = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/online')
      const data = await res.json()
      if (data.success) {
        setOnlineCount(data.count)
      }
    } catch (error) {
      console.error('Failed to fetch online count:', error)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    fetchOnlineCount()

    const eventSource = new EventSource('/api/chat/stream')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'message') {
          setMessages(prev => [...prev, data.data])
        } else if (data.type === 'config') {
          if (data.data.isCircuitBroken) {
            window.location.href = '/chat/circuit-break'
          }
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
      }
    }

    const interval = setInterval(fetchOnlineCount, 30000)

    return () => {
      eventSource.close()
      clearInterval(interval)
    }
  }, [fetchMessages, fetchOnlineCount])

  useEffect(() => {
    if (!isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim() || isSending) return

    if (input.trim().length > MAX_CONTENT_LENGTH) {
      toast.error(`消息长度不能超过${MAX_CONTENT_LENGTH}个字符`)
      return
    }

    setIsSending(true)
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.trim() })
      })

      const data = await res.json()

      if (data.success) {
        setInput('')
        if (data.isShadowBanned) {
          setIsShadowBanned(true)
          toast.info('你的消息仅管理员可见')
        }
      } else {
        toast.error(data.error || '发送失败')
      }
    } catch (error) {
      toast.error('发送失败')
    } finally {
      setIsSending(false)
    }
  }

  const handleDelete = async (messageId: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (data.success) {
        setMessages(prev => prev.filter(m => m.id !== messageId))
        toast.success('消息已删除')
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleBan = async (userId: string) => {
    try {
      const res = await fetch('/api/chat/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('用户已禁言')
      } else {
        toast.error(data.error || '禁言失败')
      }
    } catch (error) {
      toast.error('禁言失败')
    }
  }

  const handleLoadMore = () => {
    setIsLoadingMore(true)
    fetchMessages(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h2 className="text-lg font-semibold">💬 用户反馈</h2>
        <span className="text-sm text-muted-foreground">在线: {onlineCount} 人</span>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ChevronUp className="w-4 h-4 mr-2" />
              )}
              加载更多
            </Button>
          </div>
        )}

        {messages.map((message) => {
          const isOwn = message.userId === session?.user?.id
          const messageAdmin = isDeveloper(message.User)
          const avatar = getAvatar(message.User)
          const displayName = getDisplayName(message.User)

          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                {avatar ? (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                    {avatar}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                )}

                <div>
                  <div className={`text-xs mb-1 ${isOwn ? 'text-right' : 'text-left'} ${messageAdmin ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                    {displayName}
                    {message.isHidden && admin && (
                      <span className="ml-2 text-xs text-yellow-500">[仅管理员可见]</span>
                    )}
                  </div>

                  <Card className={`${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'} ${message.isHidden && admin ? 'border-yellow-500' : ''}`}>
                    <CardContent className="px-3 py-1.5">
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </CardContent>
                  </Card>

                  {admin && (
                    <div className="flex gap-1 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleDelete(message.id)}
                      >
                        <Trash className="w-3 h-3 mr-1" />
                        删除
                      </Button>
                      {!isOwn && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleBan(message.userId)}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          禁言
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t shrink-0">
        {isShadowBanned && (
          <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm rounded">
            ℹ️ 你的消息仅管理员可见
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            disabled={isSending}
            maxLength={MAX_CONTENT_LENGTH}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-1 text-right">
          {input.length}/{MAX_CONTENT_LENGTH}
        </div>
      </div>
    </div>
  )
}
