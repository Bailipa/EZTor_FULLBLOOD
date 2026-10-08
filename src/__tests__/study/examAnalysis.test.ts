import { describe, expect, it } from 'vitest'
import { examAnalysisEligible, examAnalysisStats, parseAnalysisReport } from '@/features/study/examAnalysis'
import { originalExamFixture } from './examFixture'
import type { ExamContent, ExamState } from '@/features/study/examTypes'
const content = originalExamFixture().content as ExamContent
function complete(): ExamState {
  return { drafts: {}, firstAnswers: {}, audioPlays: {}, submissions: Object.fromEntries(['WRITING', 'LISTENING', 'READING', 'TRANSLATION'].map(stage => [stage, { text: 'My completed work.', submittedAt: new Date().toISOString(), expired: false, elapsedMs: 1000, answers: Object.fromEntries(content[stage as keyof ExamContent]!.questions.map(q => [q.id, q.answerIndex])) }])) }
}
describe('completed exam analysis', () => {
  it('requires a complete full paper with every actual submission and answer', () => {
    const state = complete()
    expect(examAnalysisEligible('FULL', 'COMPLETE', state, content)).toBe(true)
    expect(examAnalysisEligible('READING', 'COMPLETE', state, content)).toBe(false)
    expect(examAnalysisEligible('FULL', 'READING', state, content)).toBe(false)
    state.submissions.WRITING!.text = ' '
    expect(examAnalysisEligible('FULL', 'COMPLETE', state, content)).toBe(false)
    const missing = complete(); delete missing.submissions.LISTENING!.answers[content.LISTENING.questions[0].id]
    expect(examAnalysisEligible('FULL', 'COMPLETE', missing, content)).toBe(false)
    const invalid = complete()
    invalid.submissions.READING!.answers[content.READING!.questions[0].id] = content.READING!.questions[0].choices.length
    expect(examAnalysisEligible('FULL', 'COMPLETE', invalid, content)).toBe(false)
    const unsubmitted = complete(); delete unsubmitted.submissions.TRANSLATION
    expect(examAnalysisEligible('FULL', 'COMPLETE', unsubmitted, content)).toBe(false)
  })
  it('uses server answer keys and excludes unavailable answers from accuracy', () => {
    const state = complete(), edited = structuredClone(content)
    state.submissions.LISTENING!.answers[edited.LISTENING.questions[0].id] = 3
    edited.LISTENING.questions[1].answerIndex = -1
    const stats = examAnalysisStats(state, edited)
    expect(stats.correct).toBe(stats.total - 1)
    expect(stats.modules.find(m => m.stage === 'LISTENING')!.ungraded).toBe(1)
  })
  it('rejects unstructured and unbounded model output', () => {
    expect(() => parseAnalysisReport({ summary: 'x', weaknesses: [], suggestions: [] })).toThrow()
    expect(() => parseAnalysisReport({ summary: 'x'.repeat(1201), weaknesses: [], suggestions: ['练习'] })).toThrow()
    expect(parseAnalysisReport({ summary: '复习阅读', weaknesses: ['细节题有失分'], suggestions: ['练习定位依据'] }).suggestions).toHaveLength(1)
  })
})
