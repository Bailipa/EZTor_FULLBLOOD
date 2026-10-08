import { describe, expect, it } from 'vitest'
import { scoreEvidence, type ScoreEvidenceRecord } from '@/features/study/scoreEvidence'

const now = new Date('2026-01-01T12:00:00.000Z')
const mock = (score: number, takenDateISO = '2025-12-01', patch: Partial<ScoreEvidenceRecord> = {}): ScoreEvidenceRecord => ({
  score, takenDateISO, level: 'CET4', source: 'MOCK', assisted: false, ...patch,
})

describe('CET target score evidence', () => {
  it('returns insufficient with no evidence', () => {
    expect(scoreEvidence({ targetScore: 425, level: 'CET4', records: [] }, now)).toMatchObject({
      status: 'insufficient', sampleCount: 0, requiredCount: 5, officialHistory: [],
    })
  })

  it('requires five valid recent mocks and does not count official scores as mock samples', () => {
    const result = scoreEvidence({ targetScore: 425, level: 'CET4', records: [
      ...Array.from({ length: 4 }, () => mock(500)),
      mock(600, '2025-12-01', { source: 'OFFICIAL' }),
    ] }, now)
    expect(result).toMatchObject({ status: 'insufficient', sampleCount: 4, requiredCount: 5 })
    expect(result.officialHistory).toEqual([{ score: 600, takenDateISO: '2025-12-01' }])
  })

  it('reports zero and full observed attainment with Wilson intervals at target boundaries', () => {
    const none = scoreEvidence({ targetScore: 220, level: 'CET4', records: Array.from({ length: 5 }, () => mock(219)) }, now)
    expect(none).toMatchObject({ status: 'observed', attainmentCount: 0, sampleCount: 5, observedRate: 0, meanScore: 219 })
    if (none.status === 'observed') {
      expect(none.wilson95.lower).toBe(0)
      expect(none.wilson95.upper).toBeGreaterThan(0)
      expect(none.wilson95.upper).toBeLessThan(1)
    }

    const all = scoreEvidence({ targetScore: 710, level: 'CET6', records: Array.from({ length: 5 }, () => mock(710, '2025-12-01', { level: 'CET6' })) }, now)
    expect(all).toMatchObject({ status: 'observed', attainmentCount: 5, sampleCount: 5, observedRate: 1, meanScore: 710 })
    if (all.status === 'observed') {
      expect(all.wilson95.lower).toBeGreaterThan(0)
      expect(all.wilson95.lower).toBeLessThan(1)
      expect(all.wilson95.upper).toBe(1)
    }
  })

  it('filters assisted, wrong-level, future, older-than-90-day and invalid-score records', () => {
    const result = scoreEvidence({ targetScore: 425, level: 'CET4', records: [
      ...Array.from({ length: 4 }, () => mock(500)),
      mock(700, '2025-10-03'), // exactly 90 days before now
      mock(710, '2025-10-02'),
      mock(710, '2026-01-02'),
      mock(710, '2025-12-01', { assisted: true }),
      mock(710, '2025-12-01', { level: 'CET6' }),
      mock(Number.NaN), mock(-1), mock(711),
    ] }, now)
    expect(result).toMatchObject({ status: 'observed', attainmentCount: 5, sampleCount: 5, observedRate: 1 })
  })

  it('rejects targets outside 220–710 and excludes malformed dates and non-finite scores', () => {
    for (const targetScore of [219, 711, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => scoreEvidence({ targetScore, level: 'CET4', records: [] }, now)).toThrow(RangeError)
    }
    const result = scoreEvidence({ targetScore: 425, level: 'CET4', records: [
      ...Array.from({ length: 4 }, () => mock(500)),
      mock(Number.POSITIVE_INFINITY), mock(500, '2025-02-30'), mock(500, '2025/12/01'),
    ] }, now)
    expect(result).toMatchObject({ status: 'insufficient', sampleCount: 4 })
  })

  it('uses China calendar dates when filtering the 90-day window and future records', () => {
    const result = scoreEvidence({ targetScore: 425, level: 'CET4', records: [
      mock(500, '2026-03-04'), // 90 days before the China study date (June 2)
      ...Array.from({ length: 4 }, () => mock(500, '2026-06-01')),
      mock(500, '2026-06-02'), // current China date, though it is still the previous UTC date
      mock(500, '2026-03-03'), mock(500, '2026-06-03'),
    ] }, new Date('2026-06-01T16:00:00.000Z'))
    expect(result).toMatchObject({ status: 'observed', sampleCount: 6, attainmentCount: 6, observedRate: 1 })
  })

  it('keeps official results as separate historical evidence, including older valid records', () => {
    const result = scoreEvidence({ targetScore: 600, level: 'CET4', records: [
      ...Array.from({ length: 5 }, () => mock(500)),
      mock(650, '2020-05-01', { source: 'OFFICIAL' }),
      mock(700, '2025-12-01', { source: 'OFFICIAL', assisted: true }),
      mock(700, '2025-12-01', { source: 'OFFICIAL', level: 'CET6' }),
    ] }, now)
    expect(result).toMatchObject({ status: 'observed', attainmentCount: 0, sampleCount: 5, observedRate: 0 })
    expect(result.officialHistory).toEqual([{ score: 650, takenDateISO: '2020-05-01' }])
  })
})
