'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Calendar, Link2, Clock, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyToClipboard, shareText } from '@/lib/share'
import { toast } from 'sonner'

interface ShareCodeDisplayProps {
  code: string
  expiresAt?: string | null
  maxUses?: number | null
  usedCount?: number
  isActive?: boolean
  className?: string
  onCopy?: () => void
}

export function ShareCodeDisplay({
  code,
  expiresAt,
  maxUses,
  usedCount = 0,
  isActive = true,
  className,
  onCopy,
}: ShareCodeDisplayProps) {
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current) }
  }, [])

  const handleCopy = useCallback(async () => {
    const result = await copyToClipboard(code)
    if (!mounted.current) return
    if (!result) {
      toast.error('复制失败，请选择分享码手动复制')
      return
    }
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)

    // 调用外部回调
    if (onCopy) {
      onCopy()
    }
  }, [code, onCopy])

  const handleSend = async () => {
    setSending(true)
    try {
      const result = await shareText(code)
      if (!mounted.current) return
      if (result === 'shared') toast.success('已打开分享')
      else if (result === 'copied') toast.success('分享码已复制，可粘贴给好友')
      else if (result === 'failed') toast.error('分享失败，请复制分享码后发送')
    } finally { if (mounted.current) setSending(false) }
  }

  const formatExpiration = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return '永久有效'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }, [])

  const isExpired = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return false
    return new Date(dateString) < new Date()
  }, [])

  const getRemainingUses = useCallback(() => {
    if (!maxUses) return null
    return Math.max(0, maxUses - usedCount)
  }, [maxUses, usedCount])

  const getStatusBadge = () => {
    if (!isActive) {
      return (
        <Badge variant="destructive" className="text-xs">
          已撤销
        </Badge>
      )
    }

    if (isExpired(expiresAt)) {
      return (
        <Badge variant="destructive" className="text-xs">
          已过期
        </Badge>
      )
    }

    const remaining = getRemainingUses()
    if (remaining !== null && remaining <= 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          已达上限
        </Badge>
      )
    }

    return null
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* 分享码显示区域 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">分享码</span>
            <div className="flex items-center gap-2">{getStatusBadge()}</div>
          </div>

          <div className="flex gap-2">
            {/* 大字体分享码显示 */}
            <div
              className={cn(
                'flex-1 p-3 sm:p-4 bg-muted rounded-lg',
                'font-mono text-center tracking-wider break-all select-all',
                'text-xl sm:text-2xl md:text-3xl font-bold',
                !isActive && 'text-muted-foreground opacity-60',
              )}
            >
              {code}
            </div>

            {/* 复制按钮 */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={!isActive}
              className={cn(
                'shrink-0 h-auto aspect-square',
                'sm:h-12 sm:w-12',
                !isActive && 'opacity-50',
              )}
              aria-label="复制分享码"
              title={isActive ? '复制分享码' : '分享码已失效'}
            >
              {copied ? (
                <Check className="size-5 sm:size-6 text-foreground" />
              ) : (
                <Copy className="size-5 sm:size-6" />
              )}
            </Button>
          </div>

          <Button className="w-full gap-2" onClick={handleSend} disabled={!isActive || sending}><Share2 className="size-4" />{sending ? '正在分享…' : '发送给好友'}</Button>

          {/* 复制成功提示 */}
          {copied && (
            <div className="flex items-center justify-center gap-2 text-xs text-foreground animate-in fade-in slide-in-from-top-2">
              <Check className="size-3" />
              <span>分享码已复制到剪贴板</span>
            </div>
          )}
        </div>

        {/* 有效期和使用限制信息 */}
        {(expiresAt || maxUses) && (
          <div className="pt-3 sm:pt-4 border-t space-y-2">
            {expiresAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3 sm:size-4" />
                <span>有效期至：</span>
                <span
                  className={cn(
                    'font-medium',
                    isExpired(expiresAt) ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {formatExpiration(expiresAt)}
                </span>
                {isExpired(expiresAt) && <Clock className="size-3 text-destructive" />}
              </div>
            )}

            {maxUses && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Link2 className="size-3 sm:size-4" />
                <span>使用次数：</span>
                <span className="font-medium">
                  {usedCount} / {maxUses}
                </span>
                {getRemainingUses() !== null && (
                  <Badge
                    variant={getRemainingUses()! > 0 ? 'secondary' : 'destructive'}
                    className="text-xs ml-1"
                  >
                    剩余 {getRemainingUses()} 次
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
