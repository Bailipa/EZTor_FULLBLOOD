'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { WordCardBody, type WordCardBodyData } from './WordCardBody'

interface WordDetailSheetProps {
  word: WordCardBodyData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSetDeletingId: (id: string | null) => void
  isGroupView?: boolean
}

const DRAG_CLOSE_THRESHOLD = 100
const DRAG_CLOSE_VELOCITY = 0.4

export function WordDetailSheet({
  word,
  open,
  onOpenChange,
  onSetDeletingId,
  isGroupView = false,
}: WordDetailSheetProps) {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartTime = useRef<number>(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    dragStartY.current = e.clientY
    dragStartTime.current = Date.now()
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || dragStartY.current === null) return
    const delta = e.clientY - dragStartY.current
    if (delta > 0) {
      setDragY(delta)
    }
  }, [])

  const handlePointerEnd = useCallback(() => {
    if (dragStartY.current === null) {
      setDragY(0)
      return
    }
    const delta = dragY
    const elapsed = Date.now() - dragStartTime.current
    const velocity = elapsed > 0 ? delta / elapsed : 0
    if (delta > DRAG_CLOSE_THRESHOLD || velocity > DRAG_CLOSE_VELOCITY) {
      onOpenChange(false)
    }
    setDragY(0)
    dragStartY.current = null
    setIsDragging(false)
  }, [dragY, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="fixed bottom-0 left-0 right-0 top-auto z-50 w-full max-w-full translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none border-b-0 p-0 sm:max-w-full data-open:slide-in-from-bottom-full data-closed:slide-out-to-bottom-full"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {word ? (
          <div className="flex flex-col max-h-[85vh]">
            <div
              className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2">
              <DialogTitle className="text-base font-semibold">单词详情</DialogTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSetDeletingId(word.id)}
                  className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500"
                  title={isGroupView ? '从分组中移除' : '删除此单词'}
                  aria-label="删除"
                >
                  <Trash2 size={16} />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭"
                >
                  <X />
                </Button>
              </div>
            </div>
            <div className="px-5 pb-5 pt-2 overflow-y-auto">
              <WordCardBody item={word} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
