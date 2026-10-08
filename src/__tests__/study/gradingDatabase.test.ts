import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { gradeStudyWork, readGrade } from '@/services/study/GradingService'
import { importStudyPassage, reviewStudyPassage } from '@/services/study/ContentService'
import { setStudyGoal, startStudy, studyAction } from '@/services/study/StudyService'
import { studyFixture } from './fixture'
import type { GradeResult } from '@/features/study/grading'

const url = process.env.GRADING_TEST_DATABASE_URL
if (url) {
  const p = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(p.hostname) || !/^\/eztor_grading_test_\d+$/.test(p.pathname)) throw new Error('Grading tests require isolated local database')
}
const db = new PrismaClient({ datasources: { db: { url: url || 'postgresql://localhost/eztor_study_test_disabled' } } })
const userId = `grade-${randomUUID()}`, other = `grade-other-${randomUUID()}`
const grade: GradeResult = { score: 12, maxScore: 15, summary: '测试评分', dimensions: ['内容', '语言', '结构'].map(name => ({ name, score: 4, reason: '原创测试依据' })), suggestions: ['完善细节'], corrections: [], model: 'test-no-network', assessedAt: new Date().toISOString() }
let sessionId: string, revision: string, fixtureId: string
describe.skipIf(!url)('Grading leases and immutable submissions (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    for (const id of [userId, other]) await db.user.create({ data: { id, username: id, password: 'not-a-login', isAdmin: id === userId, updatedAt: new Date() } })
    const imported = await importStudyPassage(userId, studyFixture(`grade-original-${randomUUID()}`), db)
    fixtureId = imported.id
    await reviewStudyPassage(userId, imported.id, 'APPROVED', '原创评分隔离回归夹具，非真题。', db)
    await setStudyGoal(userId, { level: 'CET4', targetScore: 500, examDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10) }, randomUUID(), db)
    const session = await startStudy(userId, randomUUID(), db); sessionId = session.id
    for (let i = 0; i < session.sentences.length; i++) await studyAction(userId, sessionId, { type: 'UNDERSTOOD', sentenceIndex: i, clientId: randomUUID(), activeMs: 0 }, db)
    for (let i = 0; i < 5; i++) await studyAction(userId, sessionId, { type: 'ANSWER', questionIndex: i, choice: 0, clientId: randomUUID(), activeMs: 0 }, db)
    revision = randomUUID()
    await studyAction(userId, sessionId, { type: 'WORK_SUBMIT', kind: 'WRITING', text: 'I enjoy reading in the library.', revision: null, clientId: revision, activeMs: 10 }, db)
  })
  afterAll(async () => {
    try {
      if (fixtureId) await db.auditLog.deleteMany({ where: { entityId: fixtureId } })
      await db.auditLog.deleteMany({ where: { userId: { in: [userId, other] } } })
      await db.user.deleteMany({ where: { id: { in: [userId, other] } } })
      if (fixtureId) await db.studyPassage.deleteMany({ where: { id: fixtureId } })
    } finally {
      await db.$disconnect()
    }
  })
  const intent = () => ({ source: 'STUDY' as const, id: sessionId, kind: 'WRITING' as const, revision })
  it('deduplicates concurrent model requests, caches results and isolates accounts', async () => {
    let calls = 0
    const assess = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 20)); return grade }
    const op = randomUUID()
    const results = await Promise.all([gradeStudyWork(userId, { ...intent(), clientId: op }, db, assess), gradeStudyWork(userId, { ...intent(), clientId: randomUUID() }, db, assess)])
    expect(calls).toBe(1)
    expect(results.some(r => r.status === 'COMPLETE')).toBe(true)
    expect(await gradeStudyWork(userId, { ...intent(), clientId: op }, db, assess)).toMatchObject({ status: 'COMPLETE', grade: { score: 12 } })
    expect(calls).toBe(1)
    await expect(readGrade(other, intent(), db)).rejects.toMatchObject({ status: 404 })
    await expect(gradeStudyWork(userId, { ...intent(), kind: 'TRANSLATION', clientId: op }, db, assess)).rejects.toMatchObject({ status: 409 })
  })
  it('preserves failed submissions, retries without fake scores and keeps old versions', async () => {
    const old = revision
    revision = randomUUID()
    await studyAction(userId, sessionId, { type: 'WORK_SUBMIT', kind: 'WRITING', text: 'My new original work remains available.', revision: old, clientId: revision, activeMs: 10 }, db)
    const op = randomUUID()
    expect(await gradeStudyWork(userId, { ...intent(), clientId: op }, db, async () => { throw new Error('Unavailable') })).toMatchObject({ status: 'FAILED' })
    expect((await db.studyEvent.findUniqueOrThrow({ where: { userId_clientId: { userId, clientId: revision } } })).type).toBe('WORK_SUBMIT')
    expect(await gradeStudyWork(userId, { ...intent(), clientId: op }, db, async () => grade)).toMatchObject({ status: 'COMPLETE' })
    expect(await readGrade(userId, { ...intent(), revision: old }, db)).toMatchObject({ status: 'COMPLETE' })
    expect((await db.studySession.findUniqueOrThrow({ where: { id: sessionId } })).questionIndex).toBe(5)
  })
  it('blocks grading draft-only versions and forged ownership', async () => {
    const draft = randomUUID()
    await studyAction(userId, sessionId, { type: 'WORK_DRAFT', kind: 'TRANSLATION', text: 'My unsent draft.', revision: null, clientId: draft, activeMs: 0 }, db)
    await expect(gradeStudyWork(userId, { ...intent(), kind: 'TRANSLATION', revision: draft, clientId: randomUUID() }, db, async () => grade)).rejects.toMatchObject({ status: 409 })
    expect(await db.studyEvent.count({ where: { userId, type: 'AI_GRADE' } })).toBe(2)
  })
})
