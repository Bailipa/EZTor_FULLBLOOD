import type { ExamStage } from './examTypes'

export const TIMING_STAGES: ExamStage[] = ['WRITING', 'LISTENING', 'READING', 'TRANSLATION']
export const TIMING_LABELS: Record<ExamStage, string> = { WRITING: '写作', LISTENING: '听力', READING: '阅读', TRANSLATION: '翻译' }
export const MAX_MODULE_MS = 24 * 60 * 60 * 1000
export type PracticeTiming = { version: 1; modules: Record<ExamStage, number>; totalMs: number; tracked: boolean }
export type LocalPracticeTiming = PracticeTiming & { stage: ExamStage | null; runningSince: number | null }
export function emptyPracticeTiming(): PracticeTiming {
  return { version: 1, modules: { WRITING: 0, LISTENING: 0, READING: 0, TRANSLATION: 0 }, totalMs: 0, tracked: false }
}
export function parsePracticeTiming(value: unknown): PracticeTiming | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Partial<PracticeTiming>
  if (data.version !== 1 || typeof data.tracked !== 'boolean' || !data.modules) return null
  if (!TIMING_STAGES.every(stage => Number.isSafeInteger(data.modules?.[stage]) && data.modules![stage] >= 0 && data.modules![stage] <= MAX_MODULE_MS)) return null
  const totalMs = TIMING_STAGES.reduce((sum, stage) => sum + data.modules![stage], 0)
  if (totalMs !== data.totalMs || (!data.tracked && totalMs !== 0)) return null
  return { version: 1, modules: { WRITING: data.modules.WRITING, LISTENING: data.modules.LISTENING, READING: data.modules.READING, TRANSLATION: data.modules.TRANSLATION }, totalMs, tracked: data.tracked }
}
export function settlePracticeTiming(value: LocalPracticeTiming, now: number): LocalPracticeTiming {
  const modules = { ...value.modules }
  if (value.stage && value.runningSince !== null) modules[value.stage] = Math.min(MAX_MODULE_MS, modules[value.stage] + Math.max(0, now - value.runningSince))
  return { ...value, modules, totalMs: TIMING_STAGES.reduce((sum, stage) => sum + modules[stage], 0), runningSince: null }
}
export function formatPracticeTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
