import { describe, expect, it } from 'vitest'
import { localExamAnalysisKey, readLocalExamAnalysis, saveLocalExamAnalysis } from '@/features/study/localExamAnalysis'
const report = { summary: '复习阅读', weaknesses: ['定位信息'], suggestions: ['标出证据句'], generatedAt: '2026-10-08T00:00:00Z' }
describe('Local analysis persistence before acknowledgement', () => {
  it('isolates accounts and paper sets and retains the confirmation token across reload', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } }
    const key = localExamAnalysisKey('alice', 'paper-one')
    saveLocalExamAnalysis(storage, key, { report, token: 'delivery-token' })
    expect(readLocalExamAnalysis(storage, key)).toEqual({ report, token: 'delivery-token' })
    expect(readLocalExamAnalysis(storage, localExamAnalysisKey('bob', 'paper-one'))).toBeNull()
    expect(readLocalExamAnalysis(storage, localExamAnalysisKey('alice', 'paper-two'))).toBeNull()
    saveLocalExamAnalysis(storage, key, { report })
    expect(readLocalExamAnalysis(storage, key)).toEqual({ report })
  })
  it('fails on unavailable or silently discarded storage so the server is not acknowledged', () => {
    expect(() => saveLocalExamAnalysis({ getItem: () => null, setItem: () => { throw new Error('quota') } }, 'key', { report })).toThrow()
    expect(() => saveLocalExamAnalysis({ getItem: () => null, setItem: () => {} }, 'key', { report })).toThrow()
    expect(readLocalExamAnalysis({ getItem: () => '{broken' }, 'key')).toBeNull()
  })
})
