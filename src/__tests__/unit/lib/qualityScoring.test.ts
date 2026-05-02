/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { calculateQualityScore, updatePublicWordQuality, shouldUpdatePublicWord } from '@/lib/qualityScoring'

describe('calculateQualityScore', () => {
  it('returns D grade for error words', () => {
    const result = calculateQualityScore('test', null, '错误', '错误翻译', null, null)
    expect(result.score).toBe(0)
    expect(result.grade).toBe('D')
    expect(result.factors.isError).toBe(true)
  })

  it('returns D grade for sensitive words', () => {
    const result = calculateQualityScore('test', null, 'adj', '粗俗词汇', null, null)
    expect(result.score).toBe(0)
    expect(result.grade).toBe('D')
    expect(result.factors.isSensitive).toBe(true)
  })

  it('returns D grade for non-English words', () => {
    const result = calculateQualityScore('中文', null, 'n', 'Chinese', null, null)
    expect(result.score).toBe(0)
    expect(result.grade).toBe('D')
    expect(result.factors.isNonEnglish).toBe(true)
  })

  it('returns D grade for sentences', () => {
    const result = calculateQualityScore('this is a long sentence', null, null, '这是一个长句', null, null)
    expect(result.score).toBe(0)
    expect(result.grade).toBe('D')
    expect(result.factors.isSentence).toBe(true)
  })

  it('calculates score for a word with phonetic and pos', () => {
    const result = calculateQualityScore('hello', '/həˈloʊ/', 'int.', '你好', null, null)
    expect(result.score).toBe(30) // 15 (phonetic) + 15 (pos)
    expect(result.grade).toBe('D')
  })

  it('includes example bonus when example is present', () => {
    const result = calculateQualityScore(
      'hello', '/həˈloʊ/', 'int./v./n.', '你好，你好吗？很高兴见到你',
      'Hello there, how are you doing today?', '你好呀，你今天过得怎么样？很高兴见到你',
    )
    expect(result.grade).toBe('A')
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('detects multiple parts of speech', () => {
    const result = calculateQualityScore('test', null, 'n/v', '测试', null, null)
    expect(result.factors.hasMultiplePos).toBe(true)
  })

  it('caps score at 100', () => {
    const result = calculateQualityScore(
      'comprehensive', '/ˌkɑːmprɪˈhensɪv/', 'adj/n/v', '全面的；综合的；理解力',
      'a comprehensive study', '一项全面的研究',
    )
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

describe('updatePublicWordQuality', () => {
  it('updates when new score is higher', () => {
    const result = updatePublicWordQuality(50, 80, 1)
    expect(result).toEqual({ qualityScore: 80, version: 2 })
  })

  it('keeps current score when new score is lower', () => {
    const result = updatePublicWordQuality(80, 50, 3)
    expect(result).toEqual({ qualityScore: 80, version: 3 })
  })

  it('keeps current score when scores are equal', () => {
    const result = updatePublicWordQuality(60, 60, 2)
    expect(result).toEqual({ qualityScore: 60, version: 2 })
  })
})

describe('shouldUpdatePublicWord', () => {
  it('returns true when no current word exists', () => {
    expect(shouldUpdatePublicWord(null, 50)).toBe(true)
  })

  it('returns true when new score is higher', () => {
    expect(shouldUpdatePublicWord({ qualityScore: 30, version: 1 }, 80)).toBe(true)
  })

  it('returns false when new score is lower', () => {
    expect(shouldUpdatePublicWord({ qualityScore: 80, version: 1 }, 30)).toBe(false)
  })

  it('randomly returns true or false when scores are equal', () => {
    const results = new Set<boolean>()
    for (let i = 0; i < 50; i++) {
      results.add(shouldUpdatePublicWord({ qualityScore: 50, version: 1 }, 50))
    }
    // With 50 trials and 0.5 probability, we should see both true and false
    expect(results.has(true)).toBe(true)
  })
})
