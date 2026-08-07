'use client'

import React from 'react'
import { XCircle } from 'lucide-react'

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
}

export function DictationResultCharts({
  correct,
  total,
  mistakes,
  elapsedLabel,
}: DictationResultChartsProps) {
  const wrong = Math.max(0, total - correct)
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const ringRadius = 42
  const ringCircumference = 2 * Math.PI * ringRadius
  const dash = (accuracy / 100) * ringCircumference

  const accuracyColor =
    accuracy >= 90 ? 'text-green-600 dark:text-green-500' : accuracy >= 70 ? 'text-primary' : 'text-orange-500'

  return (
    <div className="w-full max-w-md space-y-6 pt-6">
      {/* 正确率环形图 */}
      <div className="flex items-center justify-center gap-6">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={ringRadius}
              fill="none"
              stroke="currentColor"
              className="text-muted/20"
              strokeWidth="9"
            />
            <circle
              cx="50"
              cy="50"
              r={ringRadius}
              fill="none"
              stroke="currentColor"
              className={accuracyColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${ringCircumference - dash}`}
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-black ${accuracyColor}`}>{accuracy}%</span>
            <span className="text-[10px] text-muted-foreground">正确率</span>
          </div>
        </div>
        <div className="text-left space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">答对</span>
            <span className="font-bold text-green-600 dark:text-green-500">{correct}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-muted-foreground">答错</span>
            <span className="font-bold text-red-500">{wrong}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">用时</span>
            <span className="font-bold">{elapsedLabel}</span>
          </div>
        </div>
      </div>

      {/* 对错占比条 */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-green-500 transition-all duration-700"
          style={{ width: `${accuracy}%` }}
        />
        <div className="bg-red-500 transition-all duration-700" style={{ width: `${100 - accuracy}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>正确 {correct}/{total}</span>
        <span>错误 {wrong}/{total}</span>
      </div>

      {/* 错词列表 */}
      {mistakes.length > 0 && (
        <div className="space-y-2 text-left">
          <p className="text-xs font-medium text-muted-foreground">
            本次做错的单词（{mistakes.length}）
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {mistakes.map((m, i) => (
              <div
                key={`${m.word}-${i}`}
                className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
              >
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400 break-all">
                    {m.word}
                    {m.phonetic && (
                      <span className="ml-1.5 text-xs font-mono font-normal text-muted-foreground">
                        {m.phonetic}
                      </span>
                    )}
                  </p>
                  {m.translation && (
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {m.translation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
