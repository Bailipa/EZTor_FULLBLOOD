import { describe, expect, it } from 'vitest'
import { canFlushExamDraft, sameExamDraft } from '@/features/study/examDraft'

describe('exam draft recovery', () => {
  it('compares answers by value despite JSONB key order', () => {
    expect(sameExamDraft({ text: '', answers: { q1: 0, q2: 1 } }, { text: '', answers: { q2: 1, q1: 0 } })).toBe(true)
    expect(sameExamDraft({ text: '', answers: { q1: 0 } }, { text: '', answers: { q2: 0 } })).toBe(false)
  })
  it('never rebases a stale local draft silently when leaving', () => {
    const local = { text: 'local unsynced', answers: {}, revision: 1 }
    expect(canFlushExamDraft(local, { text: 'new server work', answers: {} }, 2)).toBe(false)
    expect(canFlushExamDraft(local, { text: '', answers: {} }, 1)).toBe(true)
    expect(canFlushExamDraft(local, local, 1)).toBe(false)
  })
})
