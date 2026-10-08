import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
const auth = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('next-auth/next', () => ({ getServerSession: auth.session }))
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/prisma', () => ({ default: new PrismaClient({ datasources: { db: { url: process.env.EXAM_TEST_DATABASE_URL || 'postgresql://localhost/eztor_exam_test_disabled' } } }) }))
import db from '@/lib/prisma'
import { GET, PATCH } from '@/app/api/admin/users/[id]/exam-access/route'
import { examPaperKey } from '@/services/study/ExamAccessService'
import { importExamPaper, reviewExamPaper, listExamPapers, startExam, readExam, examAction, examArchive } from '@/services/study/ExamService'
import { readingMarks, readingMarkSource } from '@/services/study/ReadingMarkService'
import { readGrade } from '@/services/study/GradingService'
import { originalExamFixture } from './examFixture'

const url = process.env.EXAM_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !/^\/eztor_exam_test_\d+$/.test(parsed.pathname)) throw new Error('Permissions tests require an isolated local database')
}
const adminId = randomUUID(), userId = randomUUID(), otherId = randomUUID()
const paperIds: string[] = []
let paperId: string, secondId: string, paperKey: string, attemptId: string
const params = { params: Promise.resolve({ id: userId }) }
const request = (body: unknown, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/admin/users/user/exam-access', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json', host: 'localhost:3000', origin }, body: JSON.stringify(body),
})
const readRequest = () => new Request('http://localhost:3000/api/admin/users/user/exam-access')

describe.skipIf(!url)('Per-user paper permissions (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    for (const id of [adminId, userId, otherId]) await db.user.create({ data: { id, username: `access-${id}`, password: 'not-a-login', isAdmin: id === adminId, updatedAt: new Date() } })
    for (let n = 1; n <= 2; n++) {
      const fixture = originalExamFixture()
      fixture.slug = `access-${adminId}-set${n}-full`
      fixture.title += ` ${n}`
      const paper = await importExamPaper(adminId, fixture, db)
      paperIds.push(paper.id)
      await reviewExamPaper(adminId, paper.id, { rightsStatus: 'APPROVED', reviewEvidence: 'ORIGINAL isolated permission fixture checked' }, db)
    }
    ;[paperId, secondId] = paperIds
    paperKey = examPaperKey(`access-${adminId}-set1-full`)
  })
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: { in: [adminId, userId, otherId] } } })
    await db.user.deleteMany({ where: { id: { in: [adminId, userId, otherId] } } })
    await db.examPaper.deleteMany({ where: { id: { in: paperIds } } })
    await db.$disconnect()
  })
  it('defaults new accounts to no grants, and review/import does not open papers', async () => {
    expect(await db.examAccess.count({ where: { userId } })).toBe(0)
    expect((await listExamPapers(userId, null, null, null, db)).items).toEqual([])
    await expect(startExam(userId, { paperId, mode: 'READING', clientId: randomUUID() }, db)).rejects.toMatchObject({ status: 403 })
  })
  it('rejects anonymous, non-admin, cross-origin and invalid permission writes', async () => {
    auth.session.mockResolvedValue(null)
    expect((await GET(readRequest(), params)).status).toBe(401)
    auth.session.mockResolvedValue({ user: { id: userId } })
    expect((await PATCH(request({ paperKey, enabled: true }), params)).status).toBe(403)
    auth.session.mockResolvedValue({ user: { id: adminId } })
    expect((await PATCH(request({ paperKey, enabled: true }, 'https://evil.example'), params)).status).toBe(403)
    expect((await PATCH(request({ paperKey, enabled: 'true' }), params)).status).toBe(400)
    expect((await PATCH(request({ paperKey: 'unknown-paper', enabled: true }), params)).status).toBe(404)
    expect(await db.examAccess.count({ where: { userId } })).toBe(0)
  })
  it('opens exactly one set for exactly one account and writes an audit record', async () => {
    expect((await PATCH(request({ paperKey, enabled: true }), params)).status).toBe(200)
    expect((await listExamPapers(userId, null, null, null, db)).items.map((paper) => paper.id)).toEqual([paperId])
    expect((await listExamPapers(otherId, null, null, null, db)).items).toEqual([])
    await expect(startExam(userId, { paperId: secondId, mode: 'READING', clientId: randomUUID() }, db)).rejects.toMatchObject({ status: 403 })
    const attempt = await startExam(userId, { paperId, mode: 'READING', clientId: randomUUID() }, db)
    attemptId = attempt.id
    expect((await readExam(userId, attemptId, db)).id).toBe(attemptId)
    const catalogue = await (await GET(readRequest(), params)).json()
    expect(catalogue.data.find((paper: { key: string }) => paper.key === paperKey).enabled).toBe(true)
    expect(await db.auditLog.count({ where: { entityId: userId, action: 'SET_EXAM_ACCESS' } })).toBe(1)
  })
  it('revokes existing attempts, replay writes, marks and grading without deleting answers', async () => {
    expect((await PATCH(request({ paperKey, enabled: false }), params)).status).toBe(200)
    await expect(readExam(userId, attemptId, db)).rejects.toMatchObject({ status: 403 })
    await expect(examAction(userId, attemptId, { clientId: randomUUID(), revision: 0, stage: 'READING', type: 'DRAFT', answers: {}, text: '' }, db)).rejects.toMatchObject({ status: 403 })
    await expect(readingMarkSource(userId, attemptId, 'passage', 0, 1, db)).rejects.toMatchObject({ status: 403 })
    await expect(readGrade(userId, { source: 'EXAM', id: attemptId, kind: 'WRITING', revision: 'x' }, db)).rejects.toMatchObject({ status: 403 })
    expect((await readingMarks(userId, null, db)).items).toEqual([])
    expect((await examArchive(userId, null, db)).items).toEqual([])
    expect((await listExamPapers(userId, null, null, null, db)).items).toEqual([])
    expect(await db.examAttempt.count({ where: { id: attemptId } })).toBe(1)
    // Granting again restores the same attempt rather than creating or losing progress.
    await PATCH(request({ paperKey, enabled: true }), params)
    expect((await readExam(userId, attemptId, db)).id).toBe(attemptId)
  })
})
