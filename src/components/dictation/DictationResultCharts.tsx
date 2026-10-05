'use client'

import React from 'react'
import { Check, Clock3, Flame, Target, XCircle } from 'lucide-react'

interface Mistake {
  word: string
  translation: string
  phonetic?: string
  example?: string
}

interface DictationResultChartsProps {
  correct: number
  total: number
  mistakes: Mistake[]
  elapsedLabel: string
  elapsedMs: number
}

function getAccuracyTone(accuracy: number) {
  if (accuracy >= 90) return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', label: '状态很稳' }
  if (accuracy >= 70) return { text: 'text-primary', bar: 'bg-primary', label: '继续巩固' }
  if (accuracy >= 50) return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', label: '重点复习' }
  return { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500', label: '从错词开始' }
}

export function DictationResultCharts({
  correct,
  total,
  mistakes,
  elapsedLabel,
  elapsedMs,
}: DictationResultChartsProps) {
  const safeTotal = Math.max(0, Math.floor(total))
  const safeCorrect = Math.min(safeTotal, Math.max(0, Math.floor(correct)))
  const wrong = safeTotal - safeCorrect
  const accuracy = safeTotal > 0 ? Math.round((safeCorrect / safeTotal) * 100) : 0
  const averageMs = safeTotal > 0 ? Math.round(Math.max(0, elapsedMs) / safeTotal) : 0
  const averageLabel = averageMs < 1000 ? '<1 秒/词' : `${Math.max(1, Math.round(averageMs / 1000))} 秒/词`
  const tone = getAccuracyTone(accuracy)
  const ringRadius = 42
  const ringCircumference = 2 * Math.PI * ringRadius
  const dash = (accuracy / 100) * ringCircumference
  const guidance =
    wrong === 0
      ? '这一轮没有错词，保持现在的节奏继续前进。'
      : accuracy >= 70
        ? `先复习这 ${mistakes.length} 个需要巩固的词，再挑战下一组。`
        : '先重测错词，再回到完整词组，记忆会更牢。'

  return (
    <div data-dictation-result-chart className="w-full max-w-2xl space-y-4 pt-2 text-left">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5 text-emerald-500" /> 答对
          </div>
          <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">{safeCorrect}</p>
          <p className="text-[11px] text-muted-foreground">/ {safeTotal} 题</p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <XCircle className="size-3.5 text-rose-500" /> 需巩固
          </div>
          <p className="mt-1 text-xl font-black text-rose-600 dark:text-rose-400">{wrong}</p>
          <p className="text-[11px] text-muted-foreground">答错次数</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 text-primary" /> 节奏
          </div>
          <p className="mt-1 text-xl font-black text-primary">{averageLabel}</p>
          <p className="text-[11px] text-muted-foreground">总用时 {elapsedLabel}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative size-32 shrink-0" aria-label={`正确率 ${accuracy}%`} role="img">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="currentColor" className="text-muted/25" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                className={tone.text}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${ringCircumference - dash}`}
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${tone.text}`}>{accuracy}%</span>
              <span className="text-[10px] text-muted-foreground">正确率</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <Target className={`size-4 ${tone.text}`} />
              <span className={`text-sm font-semibold ${tone.text}`}>{tone.label}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted/60" aria-label={`答对 ${safeCorrect} 题，答错 ${wrong} 题`}>
              <div className={`h-full rounded-full ${tone.bar} transition-all duration-700`} style={{ width: `${accuracy}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>答对 {safeCorrect}</span>
              <span>答错 {wrong}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{guidance}</p>
          </div>
        </div>
      </div>

      {mistakes.length > 0 && (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Flame className="size-4 text-rose-500" /> 复习清单
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">共 {mistakes.length} 个词，下一轮可直接重测</p>
            </div>
            <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">待巩固</span>
          </div>
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {mistakes.map((mistake, index) => (
              <div key={`${mistake.word}-${index}`} className="rounded-2xl border border-rose-500/15 bg-background/50 px-3 py-2.5">
                <p className="break-all text-sm font-semibold text-foreground">
                  {mistake.word}
                  {mistake.phonetic && <span className="ml-1.5 text-xs font-mono font-normal text-muted-foreground">{mistake.phonetic}</span>}
                </p>
                {mistake.translation && <p className="mt-0.5 break-words text-xs text-muted-foreground">{mistake.translation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
