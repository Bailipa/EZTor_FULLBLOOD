'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NICKNAME_MAX_LENGTH, NICKNAME_CHANGE_COST } from '@/features/gamification/constants'

interface NicknameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (nickname: string, cost: number) => void
}

export function NicknameDialog({ open, onOpenChange, onSuccess }: NicknameDialogProps) {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstChange, setIsFirstChange] = useState(true)

  useEffect(() => {
    if (open) {
      fetch('/api/game/profile')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setIsFirstChange(!data.data.nicknameChangedAt)
          }
        })
        .catch(() => {})
    }
  }, [open])

  const handleSubmit = async () => {
    const trimmed = nickname.trim()
    if (!trimmed) {
      setError('请输入昵称')
      return
    }
    if (trimmed.length > NICKNAME_MAX_LENGTH) {
      setError(`昵称不能超过${NICKNAME_MAX_LENGTH}个字符`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/game/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        onSuccess?.(trimmed, data.cost ?? 0)
      } else {
        setError(data.error || '设置失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const title = isFirstChange ? '设置昵称' : '修改昵称'
  const description = isFirstChange
    ? '设置一个昵称，它将显示在排行榜上。首次设置免费。'
    : `修改昵称将消耗 ${NICKNAME_CHANGE_COST} 学力。改名后3天内榜单会显示你的原昵称。`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="输入昵称"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value)
              setError('')
            }}
            maxLength={NICKNAME_MAX_LENGTH}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-destructive">{error}</span>
            <span className="text-muted-foreground">
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? '设置中...' : isFirstChange ? '确认设置' : `确认修改（-${NICKNAME_CHANGE_COST} 学力）`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
