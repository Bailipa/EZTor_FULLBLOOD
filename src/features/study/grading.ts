export type GradeSource = 'STUDY' | 'EXAM'
export type GradeKind = 'WRITING' | 'TRANSLATION'
export type GradeResult = {
  score: number; maxScore: 15; summary: string
  dimensions: { name: string; score: number; reason: string }[]
  suggestions: string[]; corrections: { original: string; revised: string; reason: string }[]
  model: string; assessedAt: string
}
export type GradeView = { status: 'ABSENT' | 'RUNNING' | 'FAILED' | 'COMPLETE'; grade?: GradeResult; error?: string }
export type GradeInput = { source: GradeSource; id: string; kind: GradeKind; revision: string }
export type GradeSubmission = { level: string; kind: GradeKind; text: string; prompt: string; reference: string; rubric: string; minimumWords?: number; maximumWords?: number }

export function parseGradeResult(raw: unknown): Omit<GradeResult, 'model' | 'assessedAt'> {
  const value = raw as Record<string, unknown> | null
  const text = (v: unknown, max = 2000) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error('Invalid grading text')
    return v.trim()
  }
  if (!value || !Array.isArray(value.dimensions) || value.dimensions.length !== 3 || !Array.isArray(value.suggestions) || value.suggestions.length > 5 || !Array.isArray(value.corrections) || value.corrections.length > 8) throw new Error('Invalid grade format')
  const dimensions = value.dimensions.map((raw) => {
    const d = raw as Record<string, unknown>
    if (!d || typeof d.score !== 'number' || !Number.isInteger(d.score) || d.score < 0 || d.score > 5) throw new Error('Invalid dimension score')
    return { name: text(d.name, 80), score: d.score, reason: text(d.reason) }
  })
  if (new Set(dimensions.map(d => d.name)).size !== 3 || value.score !== dimensions.reduce((n, d) => n + d.score, 0)) throw new Error('Inconsistent grade score')
  return { score: value.score as number, maxScore: 15, summary: text(value.summary), dimensions,
    suggestions: value.suggestions.map(v => text(v)), corrections: value.corrections.map(raw => {
      const c = raw as Record<string, unknown>
      if (!c) throw new Error('Invalid correction')
      return { original: text(c.original), revised: text(c.revised), reason: text(c.reason) }
    }) }
}
