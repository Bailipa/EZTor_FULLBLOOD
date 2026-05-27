'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Volume2, Sparkles, Search } from 'lucide-react'
import { useTheme } from '@wrksz/themes/client'
import { useBrandTheme } from '@/components/brand-theme-provider'
import type { WordResult } from '@/types/api'
import { speakText } from '@/lib/ttsBrowser'
interface ResultsListProps {
  results: WordResult[]
  showPos: boolean
  showExample: boolean
  onClear?: () => void
}


function EmptyPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
        <Search className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-3">
        欢迎使用 EZTor
      </h3>
      <div className="text-sm text-muted-foreground space-y-3 max-w-sm leading-relaxed">
        <p>
          在左侧输入单词或词组，📝 一键查询即可获取翻译结果。
        </p>
        <p>
          📚 查询后的单词可以保存到生词本，随时通过默写复习巩固记忆。
        </p>
        <p>
          🤖 AI 翻译引擎为你提供精准的释义和贴近语境的例句。
      </p>
      <div className="grid gap-4">
        {results.map((item, index) => (
          <ResultCard
            key={`${index}-${item.word}`}
            item={item}
            index={index}
            showPos={showPos}
            showExample={showExample}
            mounted={mounted}
            isDark={isDark}
            isPurple={isPurple}
            playAudio={playAudio}
          />
        ))}
      </div>
    </div>
  )
})

interface ResultCardProps {
  item: WordResult
  index: number
  showPos: boolean
  showExample: boolean
  mounted: boolean
  isDark: boolean
  isPurple: boolean
  playAudio: (text: string) => void
}

function ResultCard({
  item,
  index,
  showPos,
  showExample,
  mounted,
  isDark,
  isPurple,
  playAudio,
}: ResultCardProps) {
  const gradientClass = item.isNotFound
    ? 'bg-gradient-to-r from-muted-foreground to-caption'
    : isPurple
      ? 'bg-gradient-to-r from-[#6B5CE7] to-[#A99DF8]'
      : 'bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500'

  return (
    <Card
      className={`overflow-hidden rounded-[20px] border-border shadow-sm animate-[slideIn_0.35s_ease-out_${index * 0.03}s_both]`}
      style={{
        backgroundColor: mounted ? (isDark ? 'rgb(38, 38, 38)' : 'rgb(255, 255, 255)') : undefined,
        color: mounted ? (isDark ? 'rgb(245, 245, 245)' : 'rgb(23, 23, 23)') : undefined,
        willChange: 'transform, opacity',
      }}
    >
      <div
        className={`h-1 animate-[scaleX_0.4s_ease-out_${index * 0.03 + 0.1}s_both] origin-left ${gradientClass}`}
      />
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xl font-semibold text-foreground">{item.word}</span>
          {item.phonetic && (
            <span className="font-mono text-sm text-muted-foreground">[{item.phonetic}]</span>
          )}
          <button
            onClick={() => playAudio(item.word)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            title="点击发音"
            aria-label={`播放 ${item.word} 的发音`}
          >
            <Volume2 size={18} />
          </button>
          {showPos && item.pos && <Badge variant="secondary">{item.pos}</Badge>}
          <span className="font-medium text-muted-foreground">{item.translation}</span>
        </div>
        {showExample && item.example && (
          <div className="mt-2 space-y-3 rounded-md bg-muted/50 p-3 text-sm">
            {item.example.split('\n').map((ex: string, i: number) => {
              const translations = item.exampleTranslation
                ? item.exampleTranslation.split('\n')
                : []
              const trans = translations[i] || ''
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 italic">"{ex}"</p>
                    <button
                      onClick={() => playAudio(ex)}
                      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-primary"
                      title="朗读例句"
                      aria-label={`朗读例句: ${ex}`}
                    >
                      <Volume2 size={14} />
                    </button>
                  </div>
                  {trans && <p className="text-caption">{trans}</p>}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
