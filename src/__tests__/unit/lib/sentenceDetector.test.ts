/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { isSentence } from '@/lib/sentenceDetector'

describe('isSentence', () => {
  it('returns false for empty string', () => {
    expect(isSentence('')).toBe(false)
  })

  it('returns false for whitespace-only', () => {
    expect(isSentence('   ')).toBe(false)
  })

  it('returns true for long text (> 50 chars)', () => {
    expect(isSentence('a'.repeat(51))).toBe(true)
  })

  it('returns true for text with punctuation and 3+ words', () => {
    expect(isSentence('How are you?')).toBe(true)
  })

  it('returns true for 5+ word text without punctuation', () => {
    expect(isSentence('this is a very long')).toBe(true)
  })

  it('returns true when first word is a sentence starter', () => {
    expect(isSentence('what you doing')).toBe(true)
  })

  it('returns false for short text without punctuation or sentence starters', () => {
    expect(isSentence('hello world')).toBe(false)
  })

  it('returns false for 2-word text with non-sentence-starter', () => {
    expect(isSentence('test word')).toBe(false)
  })

  it('handles single-word input', () => {
    expect(isSentence('hello')).toBe(false)
    expect(isSentence('what')).toBe(false)
  })
})
