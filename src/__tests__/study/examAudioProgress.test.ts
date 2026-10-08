import { describe, expect, it } from 'vitest'
import { examAudioProgressKey, restorableAudioPosition } from '@/features/study/examAudioProgress'

describe('examAudioProgress', () => {
  it('isolates saved progress by account, attempt, and audio', () => {
    const key = examAudioProgressKey('account/a', 'attempt 1', 'audio:1')
    expect(key).toContain(encodeURIComponent('account/a'))
    expect(new Set([
      key,
      examAudioProgressKey('account/b', 'attempt 1', 'audio:1'),
      examAudioProgressKey('account/a', 'attempt 2', 'audio:1'),
      examAudioProgressKey('account/a', 'attempt 1', 'audio:2'),
    ]).size).toBe(4)
  })

  it('rejects absent, blank, non-finite, and negative saved positions', () => {
    expect(restorableAudioPosition(null, 100)).toBeNull()
    expect(restorableAudioPosition(' ', 100)).toBeNull()
    expect(restorableAudioPosition('Infinity', 100)).toBeNull()
    expect(restorableAudioPosition('-1', 100)).toBeNull()
  })

  it('keeps a valid saved position when duration is not yet known', () => {
    expect(restorableAudioPosition('9.5', Number.NaN)).toBe(9.5)
  })

  it('clamps a valid saved position to the media duration', () => {
    expect(restorableAudioPosition('200', 145.25)).toBe(145.25)
  })
})
