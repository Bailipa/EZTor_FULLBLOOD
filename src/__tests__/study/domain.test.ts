import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { chinaDay, englishLookupTokens, englishTokens, nextProgress, parseAction, parseContent, parseGoal, parsePassage } from '@/features/study/domain'
import { studyFixture } from './fixture'

describe('CET goal and content boundaries', () => {
  it('uses China day and rejects a past or nonexistent date', () => {
    const now = new Date('2026-10-06T16:01:00Z')
    expect(chinaDay(now)).toBe('2026-10-07')
    expect(() => parseGoal({ level: 'CET4', examDate: '2026-10-06', targetScore: 425 }, now)).toThrow('三年内')
    expect(() => parseGoal({ level: 'CET4', examDate: '2027-02-29', targetScore: 425 }, now)).toThrow('无效')
    expect(parseGoal({ level: 'CET6', examDate: '2028-02-29', targetScore: 600 }, now).targetScore).toBe(600)
  })
  it.each([219, 711, 425.5, '425'])('rejects an invalid target %s', (targetScore) => {
    expect(() => parseGoal({ level: 'CET4', examDate: '2026-12-20', targetScore }, new Date('2026-10-06T00:00:00Z'))).toThrow()
  })
  it('preserves punctuation offsets while normalising words', () => {
    const sentence = '“Don’t” use a well-known BOOK.'
    const tokens = englishTokens(sentence)
    expect(tokens.map((token) => token.word)).toEqual(["don't", 'use', 'a', 'well-known', 'book'])
    for (const token of tokens) expect(sentence.slice(token.start, token.end)).toBe(token.text)
  })
  it('groups only known adjacent collocations for reading lookup', () => {
    const sentence = 'Students learn in order to take part in community work.'
    const tokens = englishLookupTokens(sentence)
    expect(tokens.map((token) => token.word)).toEqual(['students', 'learn', 'in order to', 'take part in', 'community', 'work'])
    for (const token of tokens) expect(sentence.slice(token.start, token.end)).toBe(token.text)
  })
  it('requires documented origin for actual papers and never accepts a rights verdict in the input', () => {
    const fixture = studyFixture()
    expect(() => parsePassage({ ...fixture, kind: 'PAST_EXAM' })).toThrow('来源链接')
    expect(() => parsePassage({ ...fixture, sourceUrl: 'https://user:password@example.com/paper' })).toThrow('无效')
    expect(parsePassage({ ...fixture, rightsStatus: 'APPROVED' })).not.toHaveProperty('rightsStatus')
  })
  it('rejects invalid evidence, duplicate questions and an answer out of bounds', () => {
    const content = studyFixture().content
    for (const patch of [{ evidence: [99] }, { answerIndex: 4 }, { id: 'q2' }, { skill: '__proto__' }]) {
      const modified = { ...content, questions: content.questions.map((question, i) => i === 0 ? { ...question, ...patch } : question) }
      expect(() => parseContent(modified)).toThrow()
    }
  })
  it('rejects non-sentence glossary words and reversed paragraphs', () => {
    const content = studyFixture().content
    expect(() => parseContent({ ...content, sentences: [{ ...content.sentences[0], glossary: { missing: { lemma: 'missing', meaning: '不存在' } } }] })).toThrow('对应句中')
    expect(() => parseContent({ ...content, sentences: [{ ...content.sentences[0], paragraph: 3 }, content.sentences[1]] })).toThrow('顺序')
  })
})

describe('sequential progress and first-answer integrity', () => {
  const content = studyFixture().content
  it('advances sentences once, then opens the questions', () => {
    const action = { type: 'UNDERSTOOD' as const, sentenceIndex: 0, activeMs: 1000, clientId: randomUUID() }
    const next = nextProgress({ status: 'READING', sentenceIndex: 0, questionIndex: 0 }, content, action)
    expect(next).toMatchObject({ status: 'READING', sentenceIndex: 1 })
    expect(() => nextProgress({ status: 'READING', sentenceIndex: 1, questionIndex: 0 }, content, action)).toThrow('进度已变化')
    expect(nextProgress({ status: 'READING', sentenceIndex: 2, questionIndex: 0 }, content, { ...action, sentenceIndex: 2 })).toMatchObject({ status: 'QUESTIONS', sentenceIndex: 3 })
  })
  it('grades on the server and completes after question five', () => {
    const action = { type: 'ANSWER' as const, questionIndex: 4, choice: 1, activeMs: 1000, clientId: randomUUID() }
    expect(nextProgress({ status: 'QUESTIONS', sentenceIndex: 3, questionIndex: 4 }, content, action)).toMatchObject({ status: 'COMPLETE', questionIndex: 5, answer: { correct: false, skill: 'PURPOSE', choice: 1 } })
    expect(() => nextProgress({ status: 'READING', sentenceIndex: 0, questionIndex: 0 }, content, action)).toThrow('进度已变化')
  })
  it('does not allow lookup of unread sentences or forged word positions', () => {
    const action = { type: 'LOOKUP' as const, sentenceIndex: 1, tokenIndex: 0, activeMs: 0, clientId: randomUUID() }
    expect(() => nextProgress({ status: 'READING', sentenceIndex: 0, questionIndex: 0 }, content, action)).toThrow('请先阅读')
    expect(() => nextProgress({ status: 'READING', sentenceIndex: 1, questionIndex: 0 }, content, { ...action, tokenIndex: 100 })).toThrow('位置无效')
  })
  it('bounds durations and UUIDs, and does not advance on pause', () => {
    expect(() => parseAction({ clientId: 'invalid', type: 'PAUSE', activeMs: 1 })).toThrow()
    expect(() => parseAction({ clientId: randomUUID(), type: 'PAUSE', activeMs: 900001 })).toThrow()
    const action = parseAction({ clientId: randomUUID(), type: 'PAUSE', activeMs: 0 })
    expect(nextProgress({ status: 'READING', sentenceIndex: 0, questionIndex: 0 }, content, action)).toEqual({})
  })
})
