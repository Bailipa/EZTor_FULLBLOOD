'use client'

import React, { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ReviewGroup {
  id: string
  name: string
  _count?: {
    ReviewGroupWord: number
  }
}

interface GroupSelectorProps {
  value?: string
  onChange: (groupId: string | 'NEW') => void
  groups: ReviewGroup[]
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function GroupSelector({
  value,
  onChange,
  groups,
  className,
  disabled = false,
  placeholder = '选择分组',
}: GroupSelectorProps) {
  const [selectedValue, setSelectedValue] = useState<string | 'NEW'>(value || 'NEW')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
      setShowNewGroupInput(value === 'NEW')
    }
  }, [value])

  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue)
    onChange(newValue)
    setShowNewGroupInput(newValue === 'NEW')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label>分组选择</Label>
      <Select value={selectedValue} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NEW">创建新分组</SelectItem>
          {groups.length === 0 ? (
            <SelectItem value="none" disabled>
              暂无分组
            </SelectItem>
          ) : (
            groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}{' '}
                {group._count?.ReviewGroupWord !== undefined && (
                  <span className="text-muted-foreground">({group._count.ReviewGroupWord} 词)</span>
                )}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {showNewGroupInput && (
        <div className="space-y-2 mt-2">
          <Label htmlFor="newGroupName">新分组名称</Label>
          <Input id="newGroupName" placeholder="输入新分组名称" disabled={disabled} />
        </div>
      )}
    </div>
  )
}
