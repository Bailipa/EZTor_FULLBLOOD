import { afterEach, describe, expect, it, vi } from 'vitest'
import { readExamClock } from '@/features/study/ExamClock'

afterEach(() => { vi.restoreAllMocks() })

describe('readExamClock', () => {
  it('applies the server offset to countdown and elapsed time', () => {
    const clientNow = Date.parse('2026-10-06T10:00:00.000Z')
    const stageStartedAt = Date.parse('2026-10-06T09:58:30.000Z')
    const deadline = Date.parse('2026-10-06T10:01:00.000Z')

    expect(readExamClock(deadline, stageStartedAt, 30_000, clientNow)).toEqual({ remaining: 30, elapsed: 2 })
  })

  it('rounds remaining seconds up and clamps an expired deadline to zero', () => {
    const now = 1_000_000
    expect(readExamClock(now + 1, now, 0, now).remaining).toBe(1)
    expect(readExamClock(now - 1, now, 0, now).remaining).toBe(0)
  })

  it('keeps unlimited practice free of countdown while tracking whole elapsed minutes', () => {
    const now = 1_000_000
    expect(readExamClock(null, now - 119_999, 0, now)).toEqual({ remaining: null, elapsed: 1 })
  })
})
