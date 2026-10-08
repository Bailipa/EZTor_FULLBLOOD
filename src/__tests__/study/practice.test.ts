import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { nextProgress, parseAction, parseScoreRecord } from '@/features/study/domain'
import { practicePrompt } from '@/features/study/practicePrompt'
import type { SessionView } from '@/features/study/types'
import { studyFixture } from './fixture'

describe('CET writing, translation and score input', () => {
  it('validates work kind, text, revision and reading completion', () => {
    const input = { type: 'WORK_SUBMIT', kind: 'WRITING', text: 'My essay.', revision: null, clientId: randomUUID(), activeMs: 100 }
    const action = parseAction(input)
    expect(nextProgress({ status: 'COMPLETE', sentenceIndex: 3, questionIndex: 5 }, studyFixture().content, action)).toEqual({})
    expect(() => nextProgress({ status: 'READING', sentenceIndex: 1, questionIndex: 0 }, studyFixture().content, action)).toThrow('先完成')
    for (const patch of [{ kind: 'other' }, { text: '' }, { text: 'x'.repeat(12001) }, { revision: 'invalid' }]) expect(() => parseAction({ ...input, ...patch })).toThrow()
    expect(parseAction({ ...input, type: 'WORK_DRAFT', text: '' })).toMatchObject({ text: '' })
  })
  it('validates self-reported scores with China-time dates', () => {
    const input = { score: 500, takenDateISO: '2026-10-07', level: 'CET4', source: 'MOCK', assisted: false, paper: 'A full original practice paper' }
    const now = new Date('2026-10-06T16:01:00Z')
    expect(parseScoreRecord(input, now)).toEqual(input)
    for (const patch of [{ score: 711 }, { score: 500.5 }, { source: 'AI' }, { assisted: 'false' }, { paper: '' }, { takenDateISO: '2026-10-08' }, { takenDateISO: '2026-02-30' }]) expect(() => parseScoreRecord({ ...input, ...patch }, now)).toThrow()
  })
  it('bounds AI handoff and identifies excerpts without dropping archived work', () => {
    const fixture = studyFixture()
    const session = { passage: { level: 'CET4' }, practice: { translation: fixture.content.translationTask, writing: fixture.content.writingTask }, works: { WRITING: { text: 'long text '.repeat(1200) } } } as unknown as SessionView
    const prompt = practicePrompt(session, 'writing')
    expect(prompt.length).toBeLessThanOrEqual(2000)
    expect(prompt).toContain('节选')
    expect(session.works.WRITING?.text.length).toBe(12000)
    expect(practicePrompt(session, 'translation')).toContain(fixture.content.translationTask.source)
    expect(() => practicePrompt({ ...session, practice: null }, 'writing')).toThrow()
  })
})
