import { describe, expect, it } from 'vitest'
import { studyEventDescription } from '@/features/study/eventDescription'

describe('learning archive event descriptions', () => {
  it('displays read and bookmark sentence numbers using one-based labels', () => {
    expect(studyEventDescription({ type: 'UNDERSTOOD', data: { input: { sentenceIndex: 0 } } })).toBe('读懂第 1 句')
    expect(studyEventDescription({ type: 'BOOKMARK', data: { input: { sentenceIndex: 2 } } })).toBe('收藏第 3 句')
  })
  it('displays the confirmed contextual lookup without raw metadata', () => {
    expect(studyEventDescription({ type: 'LOOKUP', data: { input: {}, output: { lookup: { word: 'library', meaning: '图书馆', wordId: 'private-id' } } } })).toBe('查词 library · 图书馆')
  })
  it('separates first-answer outcomes and the covered skill', () => {
    expect(studyEventDescription({ type: 'ANSWER', data: { input: {}, output: { answer: { choice: 1, correct: false, skill: 'INFERENCE' } } } })).toBe('选择 B · 答错 · 推断判断')
  })
  it('summarises draft and submitted works without downloading text into the label', () => {
    for (const [type, label] of [['WORK_DRAFT', '草稿保存'], ['WORK_SUBMIT', '提交']]) {
      expect(studyEventDescription({ type, data: { input: {}, output: { work: { kind: 'WRITING', wordCount: 120, text: 'private work' } } } })).toBe(`写作${label} · 120 词`)
    }
  })
})
