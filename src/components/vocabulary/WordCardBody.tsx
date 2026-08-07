'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Volume2 } from 'lucide-react'
import { speakText } from '@/lib/ttsBrowser'

export interface WordCardBodyData {
  id: string
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  exampleTranslation: string | null
  correctCount: number
  incorrectCount: number
}

interface WordCardBodyProps {
  item: WordCardBodyData
}

export function WordCardBody({ item }: WordCardBodyProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-8">
        <span className="text-lg font-bold text-primary break-all">{item.word}</span>
        {item.phonetic && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono shrink-0">
            [{item.phonetic}]
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            speakText(item.word)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-primary/10 rounded-full relative z-20 shrink-0"
          aria-label="发音"
        >
          <Volume2 size={16} />
        </button>
      </div>

      <div className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed break-words">
        {item.pos && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 mr-1.5 align-middle">
            {item.pos}
          </Badge>
        )}
        {item.translation}
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
        <div className="pt-3 mt-3 border-t border-border space-y-2">
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
                    onClick={(e) => {
                      e.stopPropagation()
                      speakText(ex)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-primary rounded shrink-0"
                    aria-label="朗读例句"
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
    </div>
  )
}
