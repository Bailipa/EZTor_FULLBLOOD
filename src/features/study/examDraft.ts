import type { ExamDraft } from './examTypes'

export function sameExamDraft(a: ExamDraft, b: ExamDraft) {
  return a.text === b.text && Object.keys(a.answers).length === Object.keys(b.answers).length
    && Object.entries(a.answers).every(([id, choice]) => b.answers[id] === choice)
}

export function canFlushExamDraft(local: ExamDraft & { revision: number }, saved: ExamDraft, revision: number) {
  return local.revision === revision && !sameExamDraft(local, saved)
}
