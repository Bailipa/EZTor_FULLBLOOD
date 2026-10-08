import { describe, expect, it } from 'vitest'
import { parseGradeResult } from '@/features/study/grading'

export const testGrade = () => ({ score: 12, summary: '表达清晰，可以进一步丰富论据。', dimensions: [
  { name: '内容切题', score: 4, reason: '回应题目。' }, { name: '语言准确', score: 4, reason: '少量用词可改进。' }, { name: '结构连贯', score: 4, reason: '结构清楚。' },
], suggestions: ['举一个具体例子。'], corrections: [] })
describe('AI grade output validation', () => {
  it('requires three consistent dimensions and never converts to a CET total', () => {
    expect(parseGradeResult(testGrade())).toMatchObject({ score: 12, maxScore: 15 })
    expect(() => parseGradeResult({ ...testGrade(), score: 710 })).toThrow()
    expect(() => parseGradeResult({ ...testGrade(), dimensions: testGrade().dimensions.slice(0, 2) })).toThrow()
  })
  it('rejects fractional, negative or invented dimension scores', () => {
    for (const score of [1.5, -1, 6, NaN]) expect(() => parseGradeResult({ ...testGrade(), dimensions: testGrade().dimensions.map(d => ({ ...d, score })) })).toThrow()
  })
  it('bounds and validates prose and duplicate criteria', () => {
    expect(() => parseGradeResult(null)).toThrow()
    expect(() => parseGradeResult({ ...testGrade(), summary: 'x'.repeat(2001) })).toThrow()
    expect(() => parseGradeResult({ ...testGrade(), dimensions: testGrade().dimensions.map(d => ({ ...d, name: 'same' })) })).toThrow()
    expect(() => parseGradeResult({ ...testGrade(), corrections: Array(9).fill({}) })).toThrow()
  })
})
