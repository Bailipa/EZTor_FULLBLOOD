import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { importStudyPassage, reviewStudyPassage as reviewPassage } from '@/services/study/ContentService'
import { readStudySession, sessionView, setStudyGoal, startStudy, studyAction, studyArchive, studyEvents, studyHome, studyScores, recordStudyScore } from '@/services/study/StudyService'
import { englishTokens } from '@/features/study/domain'
import { studyFixture } from './fixture'

async function reviewStudyPassage(...args: Parameters<typeof reviewPassage>) {
  const result = await reviewPassage(...args)
  if (args[2] === 'APPROVED') {
    const passage = await db.studyPassage.findUniqueOrThrow({ where: { id: args[1] } })
    const accounts = await db.user.findMany({ select: { id: true } })
    await db.examAccess.createMany({ data: accounts.map(({ id }) => ({ userId: id, paperKey: passage.slug })), skipDuplicates: true })
  }
  return result
}
const url = process.env.STUDY_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !/^\/eztor_study_test_\d+$/.test(parsed.pathname)) throw new Error('Study integration tests require a named disposable localhost database')
}
const db = new PrismaClient({ datasources: { db: { url: url || 'postgresql://localhost/eztor_study_test_disabled' } } })
const ids = { admin: `study-admin-${randomUUID()}`, a: `study-a-${randomUUID()}`, b: `study-b-${randomUUID()}` }
const goal = { level: 'CET4', examDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10), targetScore: 500 }
const testSlug = `original-test-${randomUUID()}`
let passageId: string
let sessionId: string
let publicLookupSessionId: string | undefined
const passageIds = new Set<string>()
const publicWordIds = new Set<string>()

describe.skipIf(!url)('CET learning database invariants (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    for (const [role, id] of Object.entries(ids)) await db.user.create({ data: { id, username: id, password: 'not-a-real-login', isAdmin: role === 'admin', updatedAt: new Date() } })
  })
  afterAll(async () => {
    try {
      const ownedPassageIds = [...passageIds]
      await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } })
      if (ownedPassageIds.length) {
        await db.auditLog.deleteMany({ where: { entityId: { in: ownedPassageIds } } })
        await db.studyPassage.deleteMany({ where: { id: { in: ownedPassageIds } } })
      }
      await db.auditLog.deleteMany({ where: { userId: { in: Object.values(ids) } } })
      if (publicWordIds.size) await db.publicWord.deleteMany({ where: { id: { in: [...publicWordIds] } } })
    } finally {
      await db.$disconnect()
    }
  })

  it('requires admin rights and review before recommendations', async () => {
    await expect(importStudyPassage(ids.a, studyFixture(testSlug), db)).rejects.toMatchObject({ status: 403 })
    const imported = await importStudyPassage(ids.admin, studyFixture(testSlug), db)
    passageId = imported.id
    passageIds.add(imported.id)
    expect(imported.rightsStatus).toBe('PENDING')
    expect(await importStudyPassage(ids.admin, studyFixture(testSlug), db)).toEqual(imported)
    await setStudyGoal(ids.a, goal, randomUUID(), db)
    await setStudyGoal(ids.b, goal, randomUUID(), db)
    const goalOperation = randomUUID()
    const savedGoal = await setStudyGoal(ids.a, goal, goalOperation, db)
    expect(await setStudyGoal(ids.a, { targetScore: goal.targetScore, examDate: goal.examDate, level: goal.level }, goalOperation, db)).toEqual(savedGoal)
    expect((await studyHome(ids.a, db)).contentReady).toBe(false)
    await expect(startStudy(ids.a, randomUUID(), db)).rejects.toThrow('已核验')
    await reviewStudyPassage(ids.admin, passageId, 'APPROVED', '原创隔离测试材料已核验，非真题。', db)
    expect(await db.auditLog.count({ where: { entityId: passageId } })).toBe(2)
    const changed = studyFixture(testSlug); changed.content.sentences[0].text += ' New text.'
    await expect(importStudyPassage(ids.admin, changed, db)).rejects.toMatchObject({ status: 409 })
  })
  it('serialises concurrent starts and restores the same interrupted session', async () => {
    const op = randomUUID()
    const results = await Promise.all([startStudy(ids.a, op, db), startStudy(ids.a, op, db), startStudy(ids.a, randomUUID(), db)])
    sessionId = results[0].id
    expect(new Set(results.map((row) => row.id)).size).toBe(1)
    expect(await db.studySession.count({ where: { userId: ids.a } })).toBe(1)
    expect(results[0].question).toBeNull()
    expect(results[0].feedback).toEqual([])
    expect(results[0].practice).toBeNull()
    expect(results[0].sentences[0]).not.toHaveProperty('glossary')
    await expect(readStudySession(ids.b, sessionId, db)).rejects.toMatchObject({ status: 404 })
  })
  it('atomically archives unknown words without changing dictation counters', async () => {
    await db.word.create({ data: { userId: ids.a, word: 'library', translation: '用户自己的释义', correctCount: 2, incorrectCount: 1, totalAttempts: 3, updatedAt: new Date() } })
    const op = { type: 'LOOKUP' as const, clientId: randomUUID(), sentenceIndex: 0, tokenIndex: 1, activeMs: 10 }
    const results = await Promise.all([studyAction(ids.a, sessionId, op, db), studyAction(ids.a, sessionId, op, db)])
    expect(results[0].receipt).toEqual(results[1].receipt)
    const word = await db.word.findUniqueOrThrow({ where: { word_userId: { userId: ids.a, word: 'library' } } })
    expect(word).toMatchObject({ translation: '用户自己的释义', correctCount: 2, incorrectCount: 1, totalAttempts: 3 })
    expect(await db.reviewGroupWord.count({ where: { wordId: word.id } })).toBe(1)
    expect(await db.studyEvent.count({ where: { userId: ids.a, clientId: op.clientId } })).toBe(1)
    expect(results[0].session.assisted).toBe(true)
    await expect(studyAction(ids.a, sessionId, { ...op, tokenIndex: 2 }, db)).rejects.toMatchObject({ status: 409 })
    expect(await db.word.count({ where: { userId: ids.b } })).toBe(0)
  })
  it('failed AI lookup leaves no partial word, event or progress', async () => {
    const before = await db.studySession.findUniqueOrThrow({ where: { id: sessionId } })
    const op = { type: 'LOOKUP' as const, clientId: randomUUID(), sentenceIndex: 0, tokenIndex: 2, activeMs: 10 }
    await expect(studyAction(ids.a, sessionId, op, db, async () => { throw new Error('simulated model outage') })).rejects.toThrow('simulated')
    expect(await db.studyEvent.count({ where: { userId: ids.a, clientId: op.clientId } })).toBe(0)
    expect(await db.word.count({ where: { userId: ids.a } })).toBe(1)
    expect((await db.studySession.findUniqueOrThrow({ where: { id: sessionId } })).sentenceIndex).toBe(before.sentenceIndex)
  })
  it('protects first answers across retries and persists completed evidence', async () => {
    for (let sentenceIndex = 0; sentenceIndex < 3; sentenceIndex++) {
      const op = { type: 'UNDERSTOOD' as const, clientId: randomUUID(), sentenceIndex, activeMs: 100 }
      await Promise.all([studyAction(ids.a, sessionId, op, db), studyAction(ids.a, sessionId, op, db)])
    }
    const resumed = await startStudy(ids.a, randomUUID(), db)
    expect(resumed.question?.index).toBe(0)
    expect(resumed.question).not.toHaveProperty('answerIndex')
    for (let questionIndex = 0; questionIndex < 5; questionIndex++) {
      const op = { type: 'ANSWER' as const, clientId: randomUUID(), questionIndex, choice: questionIndex === 0 ? 1 : 0, activeMs: 100 }
      const result = await studyAction(ids.a, sessionId, op, db)
      expect((await studyAction(ids.a, sessionId, op, db)).session.feedback).toEqual(result.session.feedback)
      await expect(studyAction(ids.a, sessionId, { ...op, clientId: randomUUID(), choice: 0 }, db)).rejects.toMatchObject({ status: 409 })
    }
    const restored = await readStudySession(ids.a, sessionId, db)
    expect(restored).toMatchObject({ status: 'COMPLETE', questionIndex: 5, assisted: true })
    expect(restored.feedback.filter((answer) => answer.correct).length).toBe(4)
    expect(restored.feedback[0]).toMatchObject({ choice: 1, correct: false, answerIndex: 0 })
    expect(restored.practice?.translation.source).toBeTruthy()
    const home = await studyHome(ids.a, db)
    expect(home).toMatchObject({ todayCompleted: 1, reading: { answered: 5, correct: 4, assistedSessions: 1 } })
    expect(home).not.toHaveProperty('passProbability')
    expect((await studyArchive(ids.a, undefined, db)).items[0]).toMatchObject({ id: sessionId, answered: 5, correct: 4 })
    expect((await studyArchive(ids.b, undefined, db)).items).toEqual([])
  })
  it('preserves old target snapshots and does not repeat a corrected version', async () => {
    await setStudyGoal(ids.a, { ...goal, targetScore: 600 }, randomUUID(), db)
    expect((await readStudySession(ids.a, sessionId, db)).goal.targetScore).toBe(500)
    const updated = studyFixture(testSlug); updated.version = 2
    const imported = await importStudyPassage(ids.admin, updated, db)
    passageIds.add(imported.id)
    await reviewStudyPassage(ids.admin, imported.id, 'APPROVED', '第二版原创测试材料授权核验通过。', db)
    await expect(startStudy(ids.a, randomUUID(), db)).rejects.toThrow('已核验')
    const next = studyFixture(`another-${testSlug}`)
    const nextId = await importStudyPassage(ids.admin, next, db)
    passageIds.add(nextId.id)
    await reviewStudyPassage(ids.admin, nextId.id, 'APPROVED', '另一个原创测试版本核验通过。', db)
    const nextSession = await startStudy(ids.a, randomUUID(), db)
    publicLookupSessionId = nextSession.id
    expect(nextSession.passage.title).toBe(next.title)
  })
  it('uses an exact public dictionary match before asking the AI resolver', async () => {
    const publicWord = await db.publicWord.create({ data: { word: 'can', translation: '可以；能够', updatedAt: new Date() } })
    publicWordIds.add(publicWord.id)
    const tokenIndex = englishTokens(studyFixture().content.sentences[0].text).findIndex((token) => token.text === 'can')
    expect(publicLookupSessionId).toBeTruthy()
    const result = await studyAction(ids.a, publicLookupSessionId!, { type: 'LOOKUP', clientId: randomUUID(), sentenceIndex: 0, tokenIndex, activeMs: 10 }, db, async () => {
      throw new Error('AI resolver should not run for an exact public match')
    })
    expect(result.receipt.lookup).toMatchObject({ source: 'PUBLIC', meaning: '可以；能够', lemma: 'can' })
  })
  it('persists work revisions without rewriting reading scores or reading time', async () => {
    const original = await readStudySession(ids.a, sessionId, db)
    const draft = { type: 'WORK_DRAFT' as const, clientId: randomUUID(), kind: 'TRANSLATION' as const, text: 'My first translation.', revision: null, activeMs: 100 }
    const saved = await studyAction(ids.a, sessionId, draft, db)
    expect(saved.session.works.TRANSLATION).toMatchObject({ text: draft.text, submitted: false, revision: draft.clientId })
    expect((await studyAction(ids.a, sessionId, draft, db)).receipt).toEqual(saved.receipt)
    await expect(studyAction(ids.a, sessionId, { ...draft, clientId: randomUUID(), text: 'Stale overwrite.' }, db)).rejects.toMatchObject({ status: 409 })
    const submitted = await studyAction(ids.a, sessionId, { ...draft, type: 'WORK_SUBMIT', clientId: randomUUID(), revision: draft.clientId, text: 'This is my finished translation.' }, db)
    expect(submitted.session.works.TRANSLATION).toMatchObject({ text: 'This is my finished translation.', submitted: true, wordCount: 5 })
    expect(submitted.session.feedback).toEqual(original.feedback)
    expect(submitted.session.activeMs).toBe(original.activeMs)
    expect(submitted.session.completedAt).toBe(original.completedAt)
    expect((await readStudySession(ids.a, sessionId, db)).works.TRANSLATION?.submitted).toBe(true)
    const unfinished = await startStudy(ids.a, randomUUID(), db)
    await expect(studyAction(ids.a, unfinished.id, { ...draft, clientId: randomUUID() }, db)).rejects.toMatchObject({ status: 409 })
    await expect(studyAction(ids.b, sessionId, draft, db)).rejects.toMatchObject({ status: 404 })
  })
  it('archives self-reported full-paper evidence with retry, deduplication, isolation and retraction', async () => {
    const score = { type: 'ADD', clientId: randomUUID(), score: 500, takenDateISO: new Date().toISOString().slice(0, 10), level: 'CET4', source: 'MOCK', assisted: false, paper: 'Original test full paper 1' }
    const result = await recordStudyScore(ids.a, score, db)
    expect(await recordStudyScore(ids.a, { ...score }, db)).toEqual(result)
    await expect(recordStudyScore(ids.a, { ...score, clientId: randomUUID() }, db)).rejects.toMatchObject({ status: 409 })
    for (let i = 2; i <= 5; i++) await recordStudyScore(ids.a, { ...score, clientId: randomUUID(), paper: `Original test full paper ${i}`, score: i === 2 ? 650 : 600 }, db)
    const evidence = await studyScores(ids.a, db)
    expect(evidence.evidence).toMatchObject({ status: 'observed', sampleCount: 5, attainmentCount: 4 })
    expect((await studyScores(ids.b, db)).records).toEqual([])
    const id = (result.score as { id: string }).id
    await expect(recordStudyScore(ids.b, { type: 'RETRACT', id, clientId: randomUUID() }, db)).rejects.toMatchObject({ status: 404 })
    const retract = { type: 'RETRACT', id, clientId: randomUUID() }
    expect(await recordStudyScore(ids.a, retract, db)).toEqual({ id })
    expect(await recordStudyScore(ids.a, retract, db)).toEqual({ id })
    expect((await studyScores(ids.a, db)).evidence).toMatchObject({ status: 'insufficient', sampleCount: 4 })
    await recordStudyScore(ids.a, { ...score, clientId: randomUUID(), score: 650 }, db)
    expect((await studyScores(ids.a, db)).evidence).toMatchObject({ status: 'observed', sampleCount: 5, attainmentCount: 5 })
    expect(await db.studyEvent.count({ where: { userId: ids.a, type: 'SCORE_RETRACTED' } })).toBe(1)
  })
  it('enforces bans, ownership, and database score bounds', async () => {
    await db.user.update({ where: { id: ids.b }, data: { isBanned: true } })
    await expect(startStudy(ids.b, randomUUID(), db)).rejects.toMatchObject({ status: 403 })
    await expect(db.studyGoal.update({ where: { userId: ids.a }, data: { targetScore: 900 } })).rejects.toThrow()
    await expect(studyArchive(ids.b, sessionId, db)).rejects.toMatchObject({ status: 400 })
    const row = await db.studySession.findUniqueOrThrow({ where: { id: sessionId }, include: { passage: true } })
    expect((await sessionView(db, ids.a, row)).feedback.length).toBe(5)
    await expect(sessionView(db, ids.b, row)).rejects.toMatchObject({ status: 404 })
    await expect(studyEvents(ids.b, sessionId, undefined, db)).rejects.toMatchObject({ status: 404 })
    expect((await studyEvents(ids.a, sessionId, undefined, db)).items.filter((event) => event.type === 'ANSWER').length).toBe(5)
  })
  it('keeps evidence after rights withdrawal without serving the withdrawn article', async () => {
    await reviewStudyPassage(ids.admin, passageId, 'REJECTED', '测试授权撤下，保留学习档案。', db)
    await expect(readStudySession(ids.a, sessionId, db)).rejects.toMatchObject({ status: 409 })
    expect((await studyArchive(ids.a, undefined, db)).items.find((row) => row.id === sessionId)?.correct).toBe(4)
  })
})
