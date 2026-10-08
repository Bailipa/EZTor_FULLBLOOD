export type ScoreEvidenceLevel = 'CET4' | 'CET6'
export type ScoreEvidenceRecord = {
  score: number
  takenDateISO: string
  level: ScoreEvidenceLevel
  source: 'MOCK' | 'OFFICIAL'
  assisted: boolean
}

export function scoreEvidence(input: {
  targetScore: number
  level: ScoreEvidenceLevel
  records: ScoreEvidenceRecord[]
}, now = new Date()) {
  if (!Number.isFinite(input.targetScore) || input.targetScore < 220 || input.targetScore > 710) {
    throw new RangeError('targetScore must be between 220 and 710')
  }

  // Study days follow China time (UTC+8), including when callers pass a UTC instant.
  const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const today = Date.UTC(chinaNow.getUTCFullYear(), chinaNow.getUTCMonth(), chinaNow.getUTCDate())
  const cutoff = today - 90 * 24 * 60 * 60 * 1000
  const mocks: number[] = []
  const officialHistory: { score: number; takenDateISO: string }[] = []

  for (const record of input.records) {
    if (record.assisted !== false || record.level !== input.level ||
      (record.source !== 'MOCK' && record.source !== 'OFFICIAL') ||
      !Number.isFinite(record.score) || record.score < 0 || record.score > 710 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.takenDateISO)) continue
    const takenAt = Date.parse(`${record.takenDateISO}T00:00:00.000Z`)
    if (!Number.isFinite(takenAt) || new Date(takenAt).toISOString().slice(0, 10) !== record.takenDateISO || takenAt > today) continue

    if (record.source === 'OFFICIAL') {
      officialHistory.push({ score: record.score, takenDateISO: record.takenDateISO })
    } else if (takenAt >= cutoff) {
      mocks.push(record.score)
    }
  }

  const base = { officialHistory }
  if (mocks.length < 5) return { status: 'insufficient' as const, sampleCount: mocks.length, requiredCount: 5, ...base }

  const attainmentCount = mocks.filter((score) => score >= input.targetScore).length
  const sampleCount = mocks.length
  // This is the observed frequency in recent self-reported mocks, not a future pass probability.
  const observedRate = attainmentCount / sampleCount
  const z = 1.96
  const z2 = z * z
  const denominator = 1 + z2 / sampleCount
  const center = (observedRate + z2 / (2 * sampleCount)) / denominator
  const margin = z * Math.sqrt((observedRate * (1 - observedRate) / sampleCount) + z2 / (4 * sampleCount * sampleCount)) / denominator

  return {
    status: 'observed' as const,
    attainmentCount,
    sampleCount,
    observedRate,
    wilson95: { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) },
    meanScore: mocks.reduce((sum, score) => sum + score, 0) / sampleCount,
    ...base,
  }
}
