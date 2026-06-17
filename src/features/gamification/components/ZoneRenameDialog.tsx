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
import { ZONE_RENAME_COST, ZONE_NAME_MAX_LENGTH } from '@/features/gamification/constants'

interface ZoneRenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentName: string
  onSuccess?: (newName: string) => void
}

export function ZoneRenameDialog({ open, onOpenChange, currentName, onSuccess }: ZoneRenameDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请输入学区名称')
      return
    }
    if (trimmed.length > ZONE_NAME_MAX_LENGTH) {
      setError(`名称不能超过${ZONE_NAME_MAX_LENGTH}个字符`)
      return
    }
    if (trimmed === currentName) {
      setError('新名称不能与当前名称相同')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/game/zone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        setName('')
        onSuccess?.(trimmed)
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
          <DialogTitle>修改学区名称</DialogTitle>
          <DialogDescription>
            消耗 {ZONE_RENAME_COST} 学力修改学区名称。当前名称：{currentName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="输入新学区名称"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            maxLength={ZONE_NAME_MAX_LENGTH}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-destructive">{error}</span>
            <span className="text-muted-foreground">
              {name.length}/{ZONE_NAME_MAX_LENGTH}
            </span>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? '修改中...' : `确认修改（-${ZONE_RENAME_COST} 学力）`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
