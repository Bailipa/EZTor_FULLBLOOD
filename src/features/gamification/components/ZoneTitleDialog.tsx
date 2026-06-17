'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { ZONE_TITLE_MAX_LENGTH, ZONE_TITLE_CHANGE_COST, ZONE_TITLE_CHANGE_COOLDOWN_DAYS } from '@/features/gamification/constants'

interface ZoneTitleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTitle: string
  onSuccess?: () => void
}

export function ZoneTitleDialog({ open, onOpenChange, currentTitle, onSuccess }: ZoneTitleDialogProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('请输入称号')
      return
    }
    if (trimmed.length > ZONE_TITLE_MAX_LENGTH) {
      setError(`称号不能超过${ZONE_TITLE_MAX_LENGTH}个字符`)
      return
    }
    if (trimmed === currentTitle) {
      setError('新称号不能与当前称号相同')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/game/zone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setTitle', title: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        setTitle('')
        onSuccess?.()
      } else {
        setError(data.error || '修改失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>修改称号</DialogTitle>
          <DialogDescription>
            消耗 {ZONE_TITLE_CHANGE_COST} 学力修改称号，冷却 {ZONE_TITLE_CHANGE_COOLDOWN_DAYS} 天。当前称号：{currentTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="输入新称号"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            maxLength={ZONE_TITLE_MAX_LENGTH}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-destructive">{error}</span>
            <span className="text-muted-foreground">{title.length}/{ZONE_TITLE_MAX_LENGTH}</span>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                修改中...
              </>
            ) : (
              `确认修改（-${ZONE_TITLE_CHANGE_COST} 学力）`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
