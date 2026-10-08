import type { PracticeTiming } from './practiceTiming'
import type { ExamContent, ExamState, ExamStage } from './examTypes'

export const ANALYSIS_STAGES: ExamStage[] = ['WRITING', 'LISTENING', 'READING', 'TRANSLATION']
export type AnalysisStats = { modules: { stage: ExamStage; correct: number; total: number; ungraded: number; words: number }[]; correct: number; total: number }
export type ExamAnalysisView = {
  status: 'LOCKED' | 'ABSENT' | 'RUNNING' | 'AWAITING_ACK' | 'COMPLETE' | 'FAILED' | 'EXHAUSTED'
  paperKey: string
  attempts: number
  maxAttempts: number
  deliveryToken?: string
  timing?: PracticeTiming
  stats: AnalysisStats
  report?: { summary: string; weaknesses: string[]; suggestions: string[]; generatedAt: string }
  error?: string
}
export function examModuleComplete(stage: ExamStage, state: ExamState, content: ExamContent) {
  const work = state.submissions[stage], section = content[stage]
  if (!work || !section || section.unavailableReason) return false
  if (stage === 'WRITING' || stage === 'TRANSLATION') return Boolean(work.text.trim())
  return section.questions.length > 0 && section.questions.every(q => Number.isInteger(work.answers[q.id]) && work.answers[q.id] >= 0 && work.answers[q.id] < q.choices.length)
}
export function examAnalysisEligible(mode: string, status: string, state: ExamState, content: ExamContent) {
  return mode === 'FULL' && status === 'COMPLETE' && ANALYSIS_STAGES.every(stage => examModuleComplete(stage, state, content))
}
export function examAnalysisStats(state: ExamState, content: ExamContent): AnalysisStats {
  const modules = ANALYSIS_STAGES.map(stage => {
    const section = content[stage], work = state.submissions[stage]
    const questions = section?.questions ?? []
    const graded = questions.filter(q => q.answerIndex >= 0 && !(stage === 'LISTENING' && section?.audioUnavailableReason && q.audioId === undefined))
    return { stage, correct: graded.filter(q => work?.answers[q.id] === q.answerIndex).length, total: graded.length, ungraded: questions.length - graded.length, words: work?.text.trim().split(/\s+/).filter(Boolean).length ?? 0 }
  })
  return { modules, correct: modules.reduce((n, item) => n + item.correct, 0), total: modules.reduce((n, item) => n + item.total, 0) }
}
export function parseAnalysisReport(raw: unknown): Omit<NonNullable<ExamAnalysisView['report']>, 'generatedAt'> {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid analysis')
  const value = raw as Record<string, unknown>
  const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  if (!text(value.summary, 1200) || !Array.isArray(value.weaknesses) || !Array.isArray(value.suggestions) || value.weaknesses.length > 6 || !value.suggestions.length || value.suggestions.length > 6 || !value.weaknesses.every(v => text(v, 600)) || !value.suggestions.every(v => text(v, 600))) throw new Error('Invalid analysis report')
  return { summary: value.summary, weaknesses: value.weaknesses, suggestions: value.suggestions }
}
