import { describe, it, expect } from 'vitest'
import { applyReview, SRS_DEFAULTS } from '@/lib/srs'

describe('applyReview (SM-2 lite)', () => {
  const now = new Date('2026-08-06T12:00:00Z')

  it('第一次答对：间隔 1 天', () => {
    const r = applyReview(SRS_DEFAULTS, true, now)
    expect(r.repetitions).toBe(1)
    expect(r.intervalDays).toBe(1)
    expect(r.dueDate!.getTime()).toBe(new Date('2026-08-07T12:00:00Z').getTime())
  })

  it('连续答对按 1/2/4/7/15 递增', () => {
    let state = SRS_DEFAULTS
    const expected = [1, 2, 4, 7, 15]
    for (let i = 0; i < expected.length; i++) {
      state = { ...state, ...applyReview(state, true, now) } as typeof SRS_DEFAULTS
      expect(state.intervalDays).toBe(expected[i])
    }
  })

  it('答错：重置进度、遗忘 +1、10 分钟后重见、ease -0.15', () => {
    const state = { ...SRS_DEFAULTS, repetitions: 3, intervalDays: 4, ease: 2.5 }
    const r = applyReview(state, false, now)
    expect(r.repetitions).toBe(0)
    expect(r.intervalDays).toBe(0)
    expect(r.lapses).toBe(1)
    expect(r.ease).toBeCloseTo(2.35)
    expect(r.dueDate!.getTime()).toBe(new Date('2026-08-06T12:10:00Z').getTime())
  })

  it('ease 有下限 1.3', () => {
    const state = { ...SRS_DEFAULTS, ease: 1.3 }
    const r = applyReview(state, false, now)
    expect(r.ease).toBe(1.3)
  })
})
