import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import {
  adminExamPaper,
  examArchive,
  examAction,
  getExamSubjectiveSubmissions,
  importExamPaper,
  listExamPapers,
  readExam,
  reviewExamPaper as reviewPaper,
  startExam,
} from '@/services/study/ExamService'
import type { ExamAction, ExamState } from '@/features/study/examTypes'
import { originalExamFixture } from './examFixture'
async function reviewExamPaper(...args: Parameters<typeof reviewPaper>) {
  const result = await reviewPaper(...args)
  if (args[2].rightsStatus === 'APPROVED') {
    const paper = await db.examPaper.findUniqueOrThrow({ where: { id: args[1] } })
    for (const userId of Object.values(users)) await db.examAccess.upsert({ where: { userId_paperKey: { userId, paperKey: paper.slug } }, create: { userId, paperKey: paper.slug }, update: {} })
  }
  return result
}
const url = process.env.EXAM_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    !/^\/eztor_exam_test_\d+$/.test(parsed.pathname)
  )
    throw new Error('Exam tests require isolated disposable local database')
}
const db = new PrismaClient({
  datasources: { db: { url: url || 'postgresql://localhost/eztor_exam_test_disabled' } },

})
const users = {
  admin: `exam-admin-${randomUUID()}`,
  a: `exam-a-${randomUUID()}`,
  b: `exam-b-${randomUUID()}`,
}
let paperId: string,
  attemptId: string,
  revision = 0
const paperIds = new Set<string>()
const event = (
  stage: 'WRITING' | 'LISTENING' | 'READING' | 'TRANSLATION',
  type: 'DRAFT' | 'SUBMIT_STAGE',
  rest = {},
) => ({ clientId: randomUUID(), revision, stage, type, ...rest })
async function act(userId: string, id: string, action: ExamAction, client: PrismaClient) {
  const result = await examAction(userId, id, action, client)
  revision = result.session.revision
  return result
}
describe.skipIf(!url)('Exam integrity in isolated PostgreSQL', () => {
  beforeAll(async () => {
    for (const [role, id] of Object.entries(users))
      await db.user.create({
        data: {
          id,
          username: id,
          password: 'test-only',
          isAdmin: role === 'admin',
          updatedAt: new Date(),
        },
      })
  })
  afterAll(async () => {
    try {
      const ownedPaperIds = [...paperIds]
      await db.auditLog.deleteMany({ where: { entityId: { in: ownedPaperIds } } })
      await db.auditLog.deleteMany({ where: { userId: { in: Object.values(users) } } })
      await db.user.deleteMany({ where: { id: { in: Object.values(users) } } })
      if (ownedPaperIds.length) await db.examPaper.deleteMany({ where: { id: { in: ownedPaperIds } } })
    } finally {
      await db.$disconnect()
    }
  })
  it('requires administrator import and source review', async () => {
    const p = originalExamFixture()
    p.slug = randomUUID()
    await expect(importExamPaper(users.a, p, db)).rejects.toMatchObject({ status: 403 })
    paperId = (await importExamPaper(users.admin, p, db)).id
    paperIds.add(paperId)
    expect((await listExamPapers(users.a, null, null, null, db)).items.some((p) => p.id === paperId)).toBe(
      false,
    )
    await expect(
      startExam(users.a, { paperId, mode: 'FULL', clientId: randomUUID() }, db),
    ).rejects.toMatchObject({ status: 409 })
    await reviewExamPaper(
      users.admin,
      paperId,
      {
        rightsStatus: 'APPROVED',
        reviewEvidence: 'ORIGINAL isolated test only source and audio identity checked',
      },
      db,
    )
    expect(
      (await listExamPapers(users.a, null, null, null, db)).items.find((p) => p.id === paperId),
    ).not.toHaveProperty('content')
  })
  it('serialises starts, enforces account ownership and hides all future answers', async () => {
    const input = { paperId, mode: 'FULL', clientId: randomUUID() }
    const results = await Promise.all([
      startExam(users.a, input, db),
      startExam(users.a, input, db),
    ])
    attemptId = results[0].id
    expect(results[1].id).toBe(attemptId)
    expect(results[0].result).toBeNull()
    expect(results[0].stageContent).not.toHaveProperty('reference')
    expect(JSON.stringify(results[0])).not.toContain('ORIGINAL transcript')
    await expect(readExam(users.b, attemptId, db)).rejects.toMatchObject({ status: 404 })
    await expect(getExamSubjectiveSubmissions(users.a, attemptId, db)).rejects.toMatchObject({
      status: 409,
    })
    await expect(startExam(users.a, { ...input, mode: 'LISTENING' }, db)).rejects.toMatchObject({
      status: 409,
    })
  })
  it('restores drafts, locks submitted text, and rejects reusing UUID for other payload', async () => {
    const draft = event('WRITING', 'DRAFT', { text: 'First original essay.' })
    await act(users.a, attemptId, draft, db)
    expect((await readExam(users.a, attemptId, db)).drafts.WRITING?.text).toBe(
      'First original essay.',
    )
    await expect(act(users.a, attemptId, { ...draft, text: 'changed' }, db)).rejects.toMatchObject({
      status: 409,
    })
    const submit = event('WRITING', 'SUBMIT_STAGE')
    const first = await act(users.a, attemptId, submit, db)
    expect(first.session.status).toBe('LISTENING')
    expect((await act(users.a, attemptId, submit, db)).receipt).toEqual(first.receipt)
    await expect(
      act(users.a, attemptId, event('WRITING', 'DRAFT', { text: 'cheat' }), db),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('hides transcripts and preserves first answer while allowing draft corrections, marks simulation replay assisted', async () => {
    const first = {
      clientId: randomUUID(),
      revision,
      stage: 'LISTENING' as const,
      type: 'AUDIO_PLAY' as const,
      audioId: 'audio-original',
    }
    await Promise.all([act(users.a, attemptId, first, db), act(users.a, attemptId, first, db)])
    const second = await act(users.a, attemptId, { ...first, revision, clientId: randomUUID() }, db)
    expect(second.session.assisted).toBe(true)
    expect(second.session.replayCount).toBe(1)
    expect(second.session.stageContent!.questions[0]).not.toHaveProperty('answerIndex')
    expect(second.session.stageContent!.audio[0]).not.toHaveProperty('transcript')
    await act(users.a, attemptId, event('LISTENING', 'DRAFT', { answers: { 'NEWS-0': 1 } }), db)
    await act(users.a, attemptId, event('LISTENING', 'DRAFT', { answers: { 'NEWS-0': 0 } }), db)
    const row = await db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    expect((row.state as unknown as ExamState).firstAnswers['NEWS-0'].choice).toBe(1)
    await act(users.a, attemptId, event('LISTENING', 'SUBMIT_STAGE'), db)
    await expect(
      act(users.a, attemptId, { ...first, revision, clientId: randomUUID() }, db),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('server deadlines lock expired drafts and advance all elapsed stages on recovery', async () => {
    await db.examAttempt.update({
      where: { id: attemptId },
      data: { deadlineAt: new Date(Date.now() - 31 * 60000) },
    })
    const view = await readExam(users.a, attemptId, db)
    revision = view.revision
    expect(view.status).toBe('COMPLETE')
    expect(view.result?.objective.totalWeight).toBe(70)
    expect(view.result?.objective.earnedWeight).toBe(1)
    expect(view.result?.feedback).toHaveLength(55)
    expect(view.result).not.toHaveProperty('officialScore')
    const submissions = await getExamSubjectiveSubmissions(users.a, attemptId, db)
    expect(submissions.submissions.find((s) => s.kind === 'WRITING')?.text).toBe(
      'First original essay.',
    )
    expect(submissions.submissions.every((s) => s.revision && s.rubric)).toBe(true)
    await expect(
      act(users.a, attemptId, event('TRANSLATION', 'DRAFT', { text: 'late' }), db),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('protects immutable paper versions, reviews content only for admins, and paginates account archives', async () => {
    const p = originalExamFixture()
    p.slug = `original-${randomUUID()}`
    const one = await importExamPaper(users.admin, p, db)
    paperIds.add(one.id)
    expect(await importExamPaper(users.admin, p, db)).toEqual(one)
    await expect(
      importExamPaper(users.admin, { ...p, title: 'changed metadata' }, db),
    ).rejects.toMatchObject({ status: 409 })
    await expect(adminExamPaper(users.a, one.id, db)).rejects.toMatchObject({ status: 403 })
    expect((await adminExamPaper(users.admin, one.id, db)).content).toEqual(p.content)
    await reviewExamPaper(
      users.admin,
      one.id,
      { rightsStatus: 'APPROVED', reviewEvidence: 'ORIGINAL isolated source reviewed' },
      db,
    )
    const two = await importExamPaper(
      users.admin,
      { ...p, version: 2, title: 'ORIGINAL second immutable revision' },
      db,
    )
    paperIds.add(two.id)
    await reviewExamPaper(
      users.admin,
      two.id,
      { rightsStatus: 'APPROVED', reviewEvidence: 'ORIGINAL source correction reviewed' },
      db,
    )
    const catalog = await listExamPapers(users.a, 'CET4', 'FULL', null, db)
    expect(catalog.items.some((x) => x.id === one.id)).toBe(false)
    expect(catalog.items.some((x) => x.id === two.id)).toBe(true)
    await expect(examArchive(users.b, attemptId, db)).rejects.toThrow('分页')
    expect((await examArchive(users.a, null, db)).items[0].paper).not.toHaveProperty('content')
  })
  it('recovers the active attempt and rejects stale cross-tab changes without losing new drafts', async () => {
    const fresh = await startExam(users.a, { paperId, mode: 'FULL', clientId: randomUUID() }, db)
    const startKey = randomUUID()
    expect((await startExam(users.a, { paperId, mode: 'FULL', clientId: startKey }, db)).id).toBe(
      fresh.id,
    )
    expect((await startExam(users.a, { paperId, mode: 'FULL', clientId: startKey }, db)).id).toBe(
      fresh.id,
    )
    const action = {
      clientId: randomUUID(),
      revision: fresh.revision,
      stage: 'WRITING' as const,
      type: 'DRAFT' as const,
      text: 'New tab saved draft',
    }
    await examAction(users.a, fresh.id, action, db)
    await expect(
      examAction(
        users.a,
        fresh.id,
        { ...action, clientId: randomUUID(), text: 'Old tab overwrite' },
        db,
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect((await readExam(users.a, fresh.id, db)).drafts.WRITING?.text).toBe('New tab saved draft')
    const row = await db.examAttempt.findUniqueOrThrow({ where: { id: fresh.id } })
    expect(row.goalSnapshot).toMatchObject({ level: 'CET4' })
    await db.examAttempt.update({
      where: { id: fresh.id },
      data: { deadlineAt: new Date(Date.now() - 101 * 60000) },
    })
    const recovered = await readExam(users.a, fresh.id, db)
    expect(recovered.status).toBe('COMPLETE')
    expect(recovered.revision).toBeGreaterThan(fresh.revision)
  })
  it('listening training allows replay without pretending it is an unassisted simulation and completes directly', async () => {
    const view = await startExam(
      users.b,
      { paperId, mode: 'LISTENING', clientId: randomUUID() },
      db,
    )
    revision = view.revision
    expect(view.deadlineAt).toBeNull()
    const play = {
      clientId: randomUUID(),
      revision: view.revision,
      stage: 'LISTENING' as const,
      type: 'AUDIO_PLAY' as const,
      audioId: 'audio-original',
    }
    await act(users.b, view.id, play, db)
    const replay = await act(users.b, view.id, { ...play, revision, clientId: randomUUID() }, db)
    expect(replay.session.assisted).toBe(false)
    expect(replay.session.replayCount).toBe(1)
    const completed = await act(users.b, view.id, event('LISTENING', 'SUBMIT_STAGE'), db)
    expect(completed.session.status).toBe('COMPLETE')
    expect(completed.session.result?.objective.totalWeight).toBe(35)
    expect(completed.session.result?.subjectiveSubmissions).toEqual([])
  })
  it('isolates reading, translation and writing practice without exposing other sections or changing full simulation', async () => {
    for (const mode of ['READING', 'TRANSLATION', 'WRITING'] as const) {
      const listed = await listExamPapers(users.a, 'CET4', mode, null, db)
      expect(listed.items.some((paper) => paper.id === paperId)).toBe(true)
      const input = { paperId, mode, clientId: randomUUID() }
      const opened = await startExam(users.b, input, db)
      expect((await startExam(users.b, input, db)).id).toBe(opened.id)
      expect(opened.status).toBe(mode)
      expect(opened.deadlineAt).toBeNull()
      expect(opened.result).toBeNull()
      expect(opened.stageContent).not.toHaveProperty('reference')
      expect(opened.stageContent?.questions.every((question) => !('answerIndex' in question))).toBe(true)
      const payload = mode === 'READING' ? { answers: {} } : { text: `Saved ${mode} practice answer` }
      const saved = await examAction(users.b, opened.id, { clientId: randomUUID(), revision: opened.revision, type: 'DRAFT', stage: mode, ...payload }, db)
      expect((await readExam(users.b, opened.id, db)).drafts[mode]).toEqual(saved.session.drafts[mode])
      const finished = await examAction(users.b, opened.id, { clientId: randomUUID(), revision: saved.session.revision, type: 'SUBMIT_STAGE', stage: mode, ...payload }, db)
      expect(finished.session.status).toBe('COMPLETE')
      expect(finished.session.result?.objective.total).toBe(mode === 'READING' ? 30 : 0)
      expect(finished.session.result?.transcripts).toEqual([])
      expect(finished.session.result?.subjectiveSubmissions.map((entry) => entry.kind)).toEqual(mode === 'READING' ? [] : [mode])
      expect(finished.session.result?.referenceTranslation !== null).toBe(mode === 'TRANSLATION')
    }
  })
})
