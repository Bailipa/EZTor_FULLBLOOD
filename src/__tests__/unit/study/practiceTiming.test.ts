import { describe, expect, it, vi, beforeEach } from 'vitest'
import { emptyPracticeTiming, parsePracticeTiming, settlePracticeTiming } from '@/features/study/practiceTiming'

const mocks = vi.hoisted(() => ({ attempt: vi.fn(), update: vi.fn(), access: vi.fn(), accounts: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { $transaction: (action: (tx: unknown) => unknown) => action({ $queryRaw: mocks.accounts, examAttempt: { findFirst: mocks.attempt, update: mocks.update } }) } }))
vi.mock('@/services/study/ExamAccessService', () => ({ requireExamAccess: mocks.access }))
import { savePracticeTiming } from '@/services/study/PracticeTimingService'

const complete = () => ({ id: 'attempt', mode: 'FULL', status: 'COMPLETE', paper: { slug: 'paper-full', rightsStatus: 'APPROVED' }, state: { submissions: { WRITING: {}, LISTENING: {}, READING: {}, TRANSLATION: {} } }, practiceTiming: null })
beforeEach(() => { vi.clearAllMocks(); mocks.accounts.mockResolvedValue([{ isBanned: false, banExpiresAt: null }]); mocks.access.mockResolvedValue(undefined); mocks.attempt.mockResolvedValue(complete()) })

describe('manual practice timing', () => {
  it('settles only the running module, pause prevents double count and clock rollback adds zero', () => {
    const running = { ...emptyPracticeTiming(), tracked: true, stage: 'READING' as const, runningSince: 1000 }
    const settled = settlePracticeTiming(running, 4500)
    expect(settled.modules.READING).toBe(3500)
    expect(settlePracticeTiming(settled, 9000).totalMs).toBe(3500)
    expect(settlePracticeTiming(running, 500).totalMs).toBe(0)
  })
  it('rejects malformed, negative, inflated and mismatched totals', () => {
    const base = emptyPracticeTiming()
    expect(parsePracticeTiming(base)).toEqual(base)
    expect(parsePracticeTiming({ ...base, modules: { ...base.modules, READING: -1 }, totalMs: -1 })).toBeNull()
    expect(parsePracticeTiming({ ...base, totalMs: 2 })).toBeNull()
    expect(parsePracticeTiming({ ...base, tracked: true, modules: { ...base.modules, READING: 1e12 }, totalMs: 1e12 })).toBeNull()
    expect(parsePracticeTiming({ ...base, modules: {} })).toBeNull()
  })
  it('checks owner and paper access before saving', async () => {
    mocks.attempt.mockResolvedValueOnce(null)
    await expect(savePracticeTiming('user', 'foreign', emptyPracticeTiming())).rejects.toMatchObject({ status: 404 })
    expect(mocks.attempt).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', userId: 'user' } }))
    mocks.access.mockRejectedValueOnce(new Error('denied'))
    await expect(savePracticeTiming('user', 'attempt', emptyPracticeTiming())).rejects.toThrow('denied')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('refuses incomplete attempts or missing submissions', async () => {
    mocks.attempt.mockResolvedValueOnce({ ...complete(), status: 'READING' }).mockResolvedValueOnce({ ...complete(), mode: 'READING', state: { submissions: {} } }).mockResolvedValueOnce({ ...complete(), state: { submissions: { READING: {} } } })
    for (let i = 0; i < 3; i++) await expect(savePracticeTiming('user', 'attempt', emptyPracticeTiming())).rejects.toMatchObject({ status: 409 })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('saves completed single-module timing and rejects unrelated module values', async () => {
    mocks.attempt.mockResolvedValue({ ...complete(), mode: 'READING', state: { submissions: { READING: {} } } })
    const reading = { ...emptyPracticeTiming(), tracked: true, modules: { ...emptyPracticeTiming().modules, READING: 7500 }, totalMs: 7500 }
    await expect(savePracticeTiming('user', 'attempt', reading)).resolves.toEqual(reading)
    await expect(savePracticeTiming('user', 'attempt', { ...reading, modules: { ...reading.modules, WRITING: 1000 }, totalMs: 8500 })).rejects.toMatchObject({ status: 400 })
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
  it('strips untrusted extra modules and fields from cached or submitted timing', () => {
    const base = emptyPracticeTiming()
    expect(parsePracticeTiming({ ...base, admin: true, modules: { ...base.modules, SECRET: 99 } })).toEqual(base)
  })
  it('saves once and returns original timing on retry or conflicting subsequent payload', async () => {
    const first = emptyPracticeTiming()
    await expect(savePracticeTiming('user', 'attempt', first)).resolves.toEqual(first)
    expect(mocks.update).toHaveBeenCalledTimes(1)
    mocks.attempt.mockResolvedValue({ ...complete(), practiceTiming: first })
    const changed = { ...first, tracked: true, modules: { ...first.modules, READING: 1000 }, totalMs: 1000 }
    await expect(savePracticeTiming('user', 'attempt', changed)).resolves.toEqual(first)
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })
})
