import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { acknowledgeExamAnalysis, generateExamAnalysis, readExamAnalysis } from '@/services/study/ExamAnalysisService'
import { originalExamFixture } from './examFixture'
import type { ExamStage } from '@/features/study/examTypes'
import { emptyPracticeTiming } from '@/features/study/practiceTiming'
const url = process.env.EXAM_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !/^\/eztor_exam_test_\d+$/.test(parsed.pathname)) throw new Error('Analysis tests require an isolated local database')
}
const db = new PrismaClient({ datasources: { db: { url: url || 'postgresql://localhost/eztor_exam_test_disabled' } } })
const userId = randomUUID(), otherUserId = randomUUID(), paperId = randomUUID(), paperKey = `analysis-${randomUUID()}`, id = randomUUID()
const report = { summary: '阅读细节需要练习', weaknesses: ['阅读定位'], suggestions: ['逐题标注证据句'], generatedAt: new Date().toISOString() }
const fixture = originalExamFixture()
const submissions = Object.fromEntries(Object.entries(fixture.content).map(([stage, content]) => [stage, { text: 'My submitted work.', answers: Object.fromEntries(content.questions.map(q => [q.id, q.answerIndex])), expired: false, submittedAt: new Date().toISOString(), elapsedMs: 1000 }]))
const where = { userId_paperKey: { userId, paperKey } }
describe.skipIf(!url)('Once-per-paper analysis quota (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    for (const uid of [userId, otherUserId]) await db.user.create({ data: { id: uid, username: `analysis-${uid}`, password: 'not-a-login', updatedAt: new Date() } })
    await db.examPaper.create({ data: { ...fixture, id: paperId, slug: `${paperKey}-full`, rightsStatus: 'APPROVED', contentHash: randomUUID(), content: fixture.content as unknown as Prisma.InputJsonValue } })
    await db.examAttempt.create({ data: { id, userId, paperId, startKey: randomUUID(), mode: 'FULL', status: 'COMPLETE', goalSnapshot: {}, stageStartedAt: new Date(), completedAt: new Date(), state: { drafts: {}, firstAnswers: {}, audioPlays: {}, submissions } } })
  })
  beforeEach(async () => {
    await db.examAnalysisRecord.deleteMany({ where: { userId } })
    await db.examAttempt.deleteMany({ where: { paperId, id: { not: id } } })
    await db.examAttempt.update({ where: { id }, data: { status: 'COMPLETE', practiceTiming: emptyPracticeTiming() } })
    await db.examAccess.upsert({ where, create: { userId, paperKey }, update: {} })
  })
  afterAll(async () => { await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } }); await db.examPaper.deleteMany({ where: { id: paperId } }); await db.$disconnect() })
  it('checks ownership, completion, timing and revoked access before spending attempts', async () => {
    const assess = vi.fn(async () => report)
    await expect(generateExamAnalysis(otherUserId, id, db, assess)).rejects.toMatchObject({ status: 404 })
    await db.examAttempt.update({ where: { id }, data: { practiceTiming: Prisma.DbNull } })
    await expect(generateExamAnalysis(userId, id, db, assess)).rejects.toMatchObject({ status: 409 })
    await db.examAttempt.update({ where: { id }, data: { status: 'READING', practiceTiming: emptyPracticeTiming() } })
    await expect(generateExamAnalysis(userId, id, db, assess)).rejects.toMatchObject({ status: 409 })
    await db.examAccess.deleteMany({ where: { userId } })
    await expect(readExamAnalysis(userId, id, db)).rejects.toMatchObject({ status: 403 })
    expect(assess).not.toHaveBeenCalled()
    expect(await db.examAnalysisRecord.count({ where: { userId } })).toBe(0)
  })
  it('serializes clicks, sends the report once, and stores no report on the server', async () => {
    let release!: () => void
    const wait = new Promise<void>(resolve => { release = resolve })
    const assess = vi.fn(async () => { await wait; return report })
    const first = generateExamAnalysis(userId, id, db, assess)
    await vi.waitFor(() => expect(assess).toHaveBeenCalledTimes(1))
    expect((await generateExamAnalysis(userId, id, db, assess)).status).toBe('RUNNING')
    release(); const delivered = await first
    expect(delivered.status).toBe('AWAITING_ACK'); expect(delivered.report).toEqual(report)
    expect((await readExamAnalysis(userId, id, db)).report).toBeUndefined()
    expect((await generateExamAnalysis(userId, id, db, assess)).report).toBeUndefined()
    await expect(acknowledgeExamAnalysis(userId, id, 'wrong-token', db)).rejects.toMatchObject({ status: 409 })
    expect((await acknowledgeExamAnalysis(userId, id, delivered.deliveryToken, db)).status).toBe('COMPLETE')
    expect((await generateExamAnalysis(userId, id, db, assess)).status).toBe('COMPLETE')
    expect(assess).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(await db.examAnalysisRecord.findUnique({ where }))).not.toContain(report.summary)
  })
  it('permits only three failed calls, then records terminal completion', async () => {
    const assess = vi.fn(async () => { throw new Error('provider unavailable') })
    for (let n = 1; n <= 3; n++) {
      const result = await generateExamAnalysis(userId, id, db, assess)
      expect(result.attempts).toBe(n)
      expect(result.status).toBe(n < 3 ? 'FAILED' : 'EXHAUSTED')
    }
    expect((await generateExamAnalysis(userId, id, db, assess)).error).toContain('EZTor 开发者')
    expect(assess).toHaveBeenCalledTimes(3)
    expect((await db.examAnalysisRecord.findUniqueOrThrow({ where })).completedAt).not.toBeNull()
  })
  it('counts interrupted delivery and running leases, without resetting the allowance', async () => {
    await generateExamAnalysis(userId, id, db, async () => report)
    await db.examAnalysisRecord.update({ where, data: { leaseUntil: new Date(0) } })
    expect((await readExamAnalysis(userId, id, db)).status).toBe('FAILED')
    expect((await generateExamAnalysis(userId, id, db, async () => report)).attempts).toBe(2)
    await db.examAnalysisRecord.update({ where, data: { status: 'RUNNING', attempts: 3, leaseUntil: new Date(0) } })
    expect((await readExamAnalysis(userId, id, db)).status).toBe('EXHAUSTED')
    const final = await db.examAnalysisRecord.findUniqueOrThrow({ where })
    expect(final.status).toBe('EXHAUSTED'); expect(final.completedAt).not.toBeNull()
  })
  it('combines four separate modules and never grants a second analysis after new work', async () => {
    async function module(stage: ExamStage, seconds: number, complete = true, owner = userId) {
      const timing = emptyPracticeTiming(); timing.modules[stage] = seconds * 1000; timing.totalMs = seconds * 1000; timing.tracked = true
      return db.examAttempt.create({ data: { id: randomUUID(), userId: owner, paperId, startKey: randomUUID(), mode: stage, status: 'COMPLETE', goalSnapshot: {}, stageStartedAt: new Date(), completedAt: new Date(Date.UTC(2026, 9, 8, 0, 0, seconds)), practiceTiming: timing, state: { drafts: {}, firstAnswers: {}, audioPlays: {}, submissions: { [stage]: complete ? submissions[stage] : { ...submissions[stage], text: '', answers: {} } } } } })
    }
    const writing = await module('WRITING', 1), listening = await module('LISTENING', 2)
    await module('TRANSLATION', 3); await module('READING', 4, false); await module('READING', 5, true, otherUserId)
    expect((await readExamAnalysis(userId, writing.id, db)).status).toBe('LOCKED')
    const reading = await module('READING', 6)
    expect((await readExamAnalysis(userId, reading.id, db)).timing?.totalMs).toBe(12000)
    const assess = vi.fn(async () => report)
    const delivery = await generateExamAnalysis(userId, writing.id, db, assess)
    await acknowledgeExamAnalysis(userId, listening.id, delivery.deliveryToken, db)
    await module('WRITING', 8)
    expect((await generateExamAnalysis(userId, reading.id, db, assess)).status).toBe('COMPLETE')
    // Switching to the FULL attempt is the same paper allowance.
    expect((await generateExamAnalysis(userId, id, db, assess)).status).toBe('COMPLETE')
    expect(assess).toHaveBeenCalledTimes(1)
  })
})
