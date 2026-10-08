import { describe, it, expect } from 'vitest'
import {
  examMinutes,
  examNext,
  parseExamAction,
  parseExamContent,
  examAudioUrl,
} from '@/features/study/examDomain'
import { originalExamFixture } from './examFixture'
describe('CET exam format validation', () => {
  it('accepts same-origin study audio without accepting arbitrary local paths', () => {
    expect(examAudioUrl('/study/audio/cet4-2019-12-set1.mp3')).toBe('/study/audio/cet4-2019-12-set1.mp3')
    for (const url of ['//other.example/file.mp3', '/api/study', '/study/audio/../secret.mp3', 'http://remote.example/file.mp3'])
      expect(() => examAudioUrl(url)).toThrow('HTTPS')
    const p = originalExamFixture()
    p.content.LISTENING.audio[0].url = '/study/audio/cet4-2019-12-set1.mp3'
    expect(parseExamContent(p.content, 'CET4', 'FULL').LISTENING.audio[0].url).toBe(p.content.LISTENING.audio[0].url)
    p.content.LISTENING.audio[0].sourceUrl = '/study/audio/cet4-2019-12-set1.mp3'
    expect(() => parseExamContent(p.content, 'CET4', 'FULL')).toThrow('HTTPS')
  })
  it('validates complete official counts and weighted parts for both levels', () => {
    for (const level of ['CET4', 'CET6'] as const) {
      const p = originalExamFixture(level)
      const c = parseExamContent(p.content, level, 'FULL')
      expect(c.LISTENING.questions).toHaveLength(25)
      expect(c.READING!.questions).toHaveLength(30)
      expect(c.LISTENING.questions.reduce((s, q) => s + q.weight, 0)).toBe(35)
      expect(c.READING!.questions.reduce((s, q) => s + q.weight, 0)).toBe(35)
    }
  })
  it('rejects short reading worksheets masquerading as complete papers', () => {
    const p = originalExamFixture()
    p.content.READING!.questions = p.content.READING!.questions.slice(0, 5)
    expect(() => parseExamContent(p.content, 'CET4', 'FULL')).toThrow('题数')
  })
  it('rejects wrong weights, missing real audio identity and wrong bank choice count', () => {
    const p = originalExamFixture()
    p.content.LISTENING.questions[0].weight = 2
    expect(() => parseExamContent(p.content, 'CET4', 'FULL')).toThrow('权重')
    p.content.LISTENING.questions[0].weight = 1
    p.content.LISTENING.audio[0].identity = ''
    expect(() => parseExamContent(p.content, 'CET4', 'FULL')).toThrow()
    p.content.LISTENING.audio[0].identity = 'original'
    p.content.READING!.questions[0].choices.pop()
    expect(() => parseExamContent(p.content, 'CET4', 'FULL')).toThrow('选项')
  })
  it('enforces original HTTPS audio, complete stage order and invalid action constraints', () => {
    const p = originalExamFixture()
    p.content.LISTENING.audio[0].url = 'data:audio/wav;base64,invalid'
    expect(() => parseExamContent(p.content, 'CET4', 'FULL')).toThrow('HTTPS')
    expect(examNext('LISTENING', 'LISTENING')).toBe('COMPLETE')
    for (const mode of ['READING', 'TRANSLATION', 'WRITING'] as const)
      expect(examNext(mode, mode)).toBe('COMPLETE')
    expect(examNext('FULL', 'READING')).toBe('TRANSLATION')
    expect(examMinutes('CET6', 'LISTENING')).toBe(30)
    expect(() =>
      parseExamAction({ clientId: 'invalid', type: 'DRAFT', stage: 'READING' }),
    ).toThrow()
  })
})
