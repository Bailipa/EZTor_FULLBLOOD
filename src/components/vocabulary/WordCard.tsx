'use client'

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WordCardBody, type WordCardBodyData } from './WordCardBody'

export interface WordData extends WordCardBodyData {
  updatedAt: string
}

interface WordCardProps {
  item: WordData
  index: number
  mode?: 'chip' | 'full'
  isSelectionMode: boolean
  isSelected: boolean
  isGroupView: boolean
  onToggleSelection: (id: string) => void
  onMouseDown: (index: number, id: string, e?: React.MouseEvent) => void
  onDragEnter: (index: number) => void
  onTouchStart: (index: number, id: string, e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  onSetDeletingId: (id: string | null) => void
}

const WordCard = memo(
  function WordCard({
    item,
    index,
    mode = 'full',
    isSelectionMode,
    isSelected,
    isGroupView,
    onToggleSelection,
    onMouseDown,
    onDragEnter,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onSetDeletingId,
  }: WordCardProps) {
    const commonProps = {
      'data-word-id': item.id,
      'data-word-index': index,
      onMouseDown: (e: React.MouseEvent) => onMouseDown(index, item.id, e),
      onMouseEnter: () => onDragEnter(index),
      onTouchStart: (e: React.TouchEvent) => onTouchStart(index, item.id, e),
      onTouchMove,
      onTouchEnd,
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
    }

    const handleTrashClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      onSetDeletingId(item.id)
    }

    if (mode === 'chip') {
      return (
        <Card
          {...commonProps}
          className={cn(
            'cursor-pointer select-none touch-pan-y',
            'h-11 transition-colors',
            isSelectionMode && isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
            !isSelectionMode && 'hover:bg-muted/40',
          )}
        >
          <CardContent className="p-2 h-full flex items-center justify-center relative">
            {isSelectionMode && (
              <div className="absolute top-1 right-1 z-10">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(item.id)}
                  className="w-3.5 h-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                />
              </div>
            )}
            <span
              className={cn(
                'text-sm font-medium text-center truncate w-full',
                isSelected && isSelectionMode ? 'text-primary' : 'text-foreground',
              )}
              title={item.word}
            >
              {item.word}
            </span>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card
        {...commonProps}
        className={cn(
          isSelectionMode && 'cursor-pointer select-none touch-pan-y',
          isSelectionMode && isSelected && 'ring-2 ring-primary border-primary bg-primary/5',
        )}
      >
        <CardContent className="p-5 relative">
          {isSelectionMode && (
            <div className="absolute top-5 right-5 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelection(item.id)}
                className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
              />
            </div>
          )}

          {isSelectionMode ? (
            <div className="flex items-start justify-between gap-2 pr-8">
              <span className="text-lg font-bold text-primary truncate">{item.word}</span>
            </div>
          ) : (
            <WordCardBody item={item} />
          )}

          {!isSelectionMode && (
            <button
              onClick={handleTrashClick}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute top-5 right-5 z-10 p-1 text-gray-300 dark:text-gray-600 hover:text-red-500"
              title={isGroupView ? '从分组中移除' : '删除此单词'}
              aria-label={isGroupView ? '从分组中移除' : '删除此单词'}
            >
              <Trash2 size={16} />
            </button>
          )}
        </CardContent>
      </Card>
    )
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.mode === next.mode &&
      prev.isSelected === next.isSelected &&
      prev.isSelectionMode === next.isSelectionMode &&
      prev.isGroupView === next.isGroupView &&
      prev.index === next.index
    )
  },
)

export default WordCard
