'use client'

import React, { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Volume2, Trash2 } from 'lucide-react'
import { speakText } from '@/lib/ttsBrowser'

interface WordData {
  id: string
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  exampleTranslation: string | null
  correctCount: number
  incorrectCount: number
  updatedAt: string
}

interface WordCardProps {
  item: WordData
  index: number
  isSelectionMode: boolean
  isSelected: boolean
  isDeleting: boolean
  isGroupView: boolean
  onToggleSelection: (id: string) => void
  onDragStart: (index: number, id: string) => void
  onDragEnter: (index: number) => void
  onTouchStart: (index: number, id: string) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  onSetDeletingId: (id: string | null) => void
  onDelete: (id: string) => void
}

const WordCard = memo(
  function WordCard({
    item,
    index,
    isSelectionMode,
    isSelected,
    isDeleting,
    isGroupView,
    onToggleSelection,
    onDragStart,
    onDragEnter,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onSetDeletingId,
    onDelete,
  }: WordCardProps) {
    return (
      <Card
        data-word-id={item.id}
        data-word-index={index}
        className={`${isSelectionMode ? 'cursor-pointer select-none' : ''} ${isSelectionMode && isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}
        style={{
          contain: 'layout style paint',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        }}
        onMouseDown={() => onDragStart(index, item.id)}
        onMouseEnter={() => onDragEnter(index)}
        onTouchStart={() => onTouchStart(index, item.id)}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDragStart={(e) => e.preventDefault()}
      >
        <CardContent
          className="p-5 space-y-3 relative"
          style={{ minHeight: '200px', contain: 'layout' }}
        >
          {isSelectionMode && (
            <div className="absolute top-5 right-5 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelection(item.id)}
                className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
              />
            </div>
          )}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-wrap pr-8">
              <span className="text-lg font-bold text-primary">{item.word}</span>
              {item.phonetic && (
                <span className="text-xs text-gray-500 font-mono">[{item.phonetic}]</span>
              )}
              <button
                onClick={() => speakText(item.word)}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full relative z-20"
              >
                <Volume2 size={16} />
              </button>
            </div>
            {!isSelectionMode && (
              <AlertDialog
                open={isDeleting}
                onOpenChange={(open) => !open && onSetDeletingId(null)}
              >
                <AlertDialogTrigger asChild>
                  <button
                    onClick={() => onSetDeletingId(item.id)}
                    className="text-gray-300 hover:text-red-500"
                    title={isGroupView ? '从分组中移除' : '删除此单词'}
                  >
                    <Trash2 size={16} />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{isGroupView ? '从分组中移除' : '删除单词'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要{isGroupView ? '从当前分组中移除' : '从生词本中永久删除'}{' '}
                      <span className="font-bold text-gray-900">"{item.word}"</span> 吗？
                      {isGroupView && ' (该单词仍会保留在您的总生词本中)'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(item.id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      确定移除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="flex items-center gap-2">
            {item.pos && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {item.pos}
              </Badge>
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              {item.translation}
            </span>
          </div>

          {(() => {
            const correctCount = item.correctCount ?? 0
            const incorrectCount = item.incorrectCount ?? 0
            const totalCount = correctCount + incorrectCount

            if (totalCount > 0) {
              return (
                <div className="flex gap-3 text-xs mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                  <span className="text-green-600 dark:text-green-500 font-medium">
                    答对: {correctCount}
                  </span>
                  <span className="text-red-600 dark:text-red-500 font-medium">
                    答错: {incorrectCount}
                  </span>
                  <span className="text-muted-foreground ml-auto">
                    正确率: {Math.round((correctCount / totalCount) * 100)}%
                  </span>
                </div>
              )
            }

            return (
              <div className="text-xs text-muted-foreground opacity-70 mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                暂无默写记录
              </div>
            )
          })()}

          {item.example && (
            <div className="pt-3 mt-3 border-t border-gray-100 dark:border-border space-y-2">
              {item.example.split('\n').map((ex: string, i: number) => {
                if (!ex.trim()) return null

                const translations = item.exampleTranslation
                  ? item.exampleTranslation.split('\n')
                  : []
                const trans = translations[i] || ''

                return (
                  <div key={`ex-${i}-${item.id}`} className="space-y-1">
                    <div className="flex items-start gap-1.5">
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic flex-1">
                        "{ex}"
                      </p>
                      <button
                        onClick={() => speakText(ex)}
                        className="p-0.5 text-gray-400 hover:text-primary rounded shrink-0"
                      >
                        <Volume2 size={12} />
                      </button>
                    </div>
                    {trans && <p className="text-xs text-gray-400 dark:text-gray-500">{trans}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    )
  },
  (prev, next) => {
    return (
      prev.item.id === next.item.id &&
      prev.isSelected === next.isSelected &&
      prev.isSelectionMode === next.isSelectionMode &&
      prev.isDeleting === next.isDeleting &&
      prev.isGroupView === next.isGroupView &&
      prev.index === next.index
    )
  },
)

export default WordCard

export type { WordData }
