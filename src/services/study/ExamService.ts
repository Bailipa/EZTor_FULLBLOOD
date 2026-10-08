import { Prisma, type PrismaClient, type ExamAttempt, type ExamPaper } from '@prisma/client'
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import prisma from '@/lib/prisma'
import { requireExamAccess, accessiblePaperWhere, examAccessSql } from './ExamAccessService'
import { isCurrentPaper, MINIMUM_CET_YEAR } from '@/features/study/paperAvailability'
import { clientId, StudyInputError, type StudyLevel } from '@/features/study/domain'
import {
  EXAM_STAGES,
  emptyExamState,
  examMinutes,
  examNext,
  examText,
  examUrl,
  parseExamContent,
} from '@/features/study/examDomain'
import type {
  ExamAction,
  ExamMode,
  ExamPaperKind,
  ExamPaperMetadata,
  ExamSessionView,
  ExamStage,
  ExamState,
} from '@/features/study/examTypes'
type Row = ExamAttempt & { paper: ExamPaper }
async function admin(tx: Prisma.TransactionClient, userId: string) {
  await lock(tx, userId)
  const user = await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) throw new StudyInputError('需要管理员权限', 403)
}
const json = (v: unknown) => v as Prisma.InputJsonValue
const metadataSelect = {
  id: true,
  slug: true,
  version: true,
  title: true,
  level: true,
  kind: true,
  originType: true,
  sourceName: true,
  sourceUrl: true,
  contentHash: true,
} as const
const meta = (p: Pick<ExamPaper, keyof typeof metadataSelect>): ExamPaperMetadata => ({
  id: p.id,
  slug: p.slug,
  version: p.version,
  title: p.title,
  level: p.level as StudyLevel,
  kind: p.kind as ExamPaperKind,
  originType: p.originType as ExamPaperMetadata['originType'],
  sourceName: p.sourceName,
  sourceUrl: p.sourceUrl,
  contentHash: p.contentHash,
})
async function lock(tx: Prisma.TransactionClient, userId: string) {
  const rows = await tx.$queryRaw<
    { isBanned: boolean; banExpiresAt: Date | null }[]
  >`SELECT "isBanned", "banExpiresAt" FROM "User" WHERE id=${userId} FOR UPDATE`
  if (!rows[0]) throw new StudyInputError('请重新登录', 401)
  if (rows[0].isBanned && (!rows[0].banExpiresAt || rows[0].banExpiresAt > new Date()))
    throw new StudyInputError('账号不可用', 403)
}
async function owned(db: Prisma.TransactionClient, userId: string, id: string) {
  const row = await db.examAttempt.findFirst({ where: { id, userId }, include: { paper: true } })
  if (!row) throw new StudyInputError('考试记录不存在', 404)
  await requireExamAccess(db, userId, row.paper.slug)
  if (row.paper.rightsStatus !== 'APPROVED')
    throw new StudyInputError('试卷来源审核未通过或已撤回', 409)
  return row
}
function stateOf(row: Row) {
  return structuredClone(row.state) as unknown as ExamState
}
function submit(row: Row, state: ExamState, at: Date, expired: boolean) {
  const stage = row.status as ExamStage,
    draft = state.drafts[stage] ?? { answers: {}, text: '' }
  state.submissions[stage] = {
    ...draft,
    submittedAt: at.toISOString(),
    expired,
    elapsedMs: Math.max(0, at.getTime() - row.stageStartedAt.getTime()),
  }
  row.status = examNext(row.mode as ExamMode, stage)
  row.stageStartedAt = at
  row.deadlineAt =
    row.status === 'COMPLETE' || row.mode !== 'FULL'
      ? null
      : new Date(
          at.getTime() +
            examMinutes(row.paper.level as StudyLevel, row.status as ExamStage, parseExamContent(row.paper.content, row.paper.level as StudyLevel, row.paper.kind as ExamPaperKind).LISTENING.audio.reduce((sum, audio) => sum + audio.durationSeconds, 0)) * 60000,
        )
  if (row.status === 'COMPLETE') row.completedAt = at
}
async function advance(tx: Prisma.TransactionClient, row: Row, now: Date) {
  if (!row.deadlineAt || now < row.deadlineAt) return row
  const state = stateOf(row)
  while (row.deadlineAt && now >= row.deadlineAt) submit(row, state, row.deadlineAt, true)
  row.state = json(state) as Prisma.JsonValue
  await tx.examAttempt.update({
    where: { id: row.id },
    data: {
      status: row.status,
      state: json(state),
      stageStartedAt: row.stageStartedAt,
      deadlineAt: row.deadlineAt,
      completedAt: row.completedAt,
      revision: { increment: 1 },
    },
  })
  row.revision++
  return row
}
export function examSessionView(row: Row, now = new Date()): ExamSessionView {
  const content = parseExamContent(
      row.paper.content,
      row.paper.level as StudyLevel,
      row.paper.kind as ExamPaperKind,
    ),
    state = stateOf(row)
  const current = row.status === 'COMPLETE' ? null : content[row.status as ExamStage]!
  const questions = [
    ...(row.mode === 'FULL' || row.mode === 'LISTENING' ? content.LISTENING.questions : []),
    ...(row.mode === 'FULL' || row.mode === 'READING' ? content.READING!.questions : []),
  ]
  const submittedAnswers = Object.assign(
    {},
    ...Object.values(state.submissions).map((s) => s.answers),
  ) as Record<string, number>
  const graded = questions.filter((q) => q.answerIndex >= 0 && !(q.audioId === undefined && content.LISTENING.audioUnavailableReason && content.LISTENING.questions.some((item) => item.id === q.id)))
  const correct = graded.filter((q) => submittedAnswers[q.id] === q.answerIndex)
  return {
    id: row.id,
    revision: row.revision,
    mode: row.mode as ExamMode,
    status: row.status as ExamSessionView['status'],
    paper: meta(row.paper),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    stageStartedAt: row.stageStartedAt.toISOString(),
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    serverNow: now.toISOString(),
    assisted: row.assisted,
    replayCount: row.replayCount,
    drafts: state.drafts,
    readingMarks: state.readingMarks ?? [],
    readingHighlights: state.readingHighlights ?? [],
    stageContent: current
      ? {
          instructions: current.instructions,
          passages: current.passages,
          questions: current.questions.map(({ answerIndex: _, explanation: __, ...q }) => q),
          audio: current.audio.map(({ transcript: _, identity: __, ...a }) => a),
          ...(current.prompt ? { prompt: current.prompt } : {}),
          ...(current.promptImageUrl ? { promptImageUrl: current.promptImageUrl } : {}),
          ...(current.wordBankUnavailableReason ? { wordBankUnavailableReason: current.wordBankUnavailableReason } : {}),
          ...(current.matchingUnavailableReason ? { matchingUnavailableReason: current.matchingUnavailableReason } : {}),
          ...(current.unavailableReason ? { unavailableReason: current.unavailableReason } : {}),
          ...(current.audioUnavailableReason ? { audioUnavailableReason: current.audioUnavailableReason } : {}),
          ...(current.sourceFileUrl ? { sourceFileUrl: current.sourceFileUrl } : {}),
          ...(current.sourceNotice ? { sourceNotice: current.sourceNotice } : {}),
          ...(current.minimumWords
            ? { minimumWords: current.minimumWords, maximumWords: current.maximumWords }
            : {}),
        }
      : null,
    result:
      row.status === 'COMPLETE'
        ? {
            objective: {
              earnedWeight: correct.reduce((s, q) => s + q.weight, 0),
              totalWeight: graded.reduce((s, q) => s + q.weight, 0),
              correct: correct.length,
              total: graded.length,
              ungraded: questions.length - graded.length,
              limitations: EXAM_STAGES.filter((stage) => row.mode === 'FULL' || row.mode === stage).flatMap((stage) => {
                const section = content[stage]
                return section ? [section.unavailableReason, section.audioUnavailableReason, section.wordBankUnavailableReason, section.matchingUnavailableReason, section.sourceNotice].filter((reason): reason is string => !!reason) : []
              }),
              firstCorrect: graded.filter(
                (q) => state.firstAnswers[q.id]?.choice === q.answerIndex,
              ).length,
              firstAnswered: graded.filter((q) => state.firstAnswers[q.id]).length,
            },
            subjectiveSubmissions: subjective(row).submissions,
            feedback: questions.map((q) => ({
              questionId: q.id,
              choice: submittedAnswers[q.id] ?? null,
              answerIndex: graded.some((item) => item.id === q.id) ? q.answerIndex : -1,
              explanation: q.explanation,
            })),
            transcripts: (row.mode === 'FULL' || row.mode === 'LISTENING' ? content.LISTENING.audio : []).filter((a) => a.transcript).map((a) => ({
              id: a.id,
              transcript: a.transcript,
            })),
            referenceTranslation: row.mode === 'FULL' || row.mode === 'TRANSLATION' ? content.TRANSLATION!.reference ?? null : null,
          }
        : null,
  }
}
function subjective(row: Row) {
  const content = parseExamContent(
      row.paper.content,
      row.paper.level as StudyLevel,
      row.paper.kind as ExamPaperKind,
    ),
    state = stateOf(row)
  return {
    level: row.paper.level as StudyLevel,
    submissions: (['WRITING', 'TRANSLATION'] as const).flatMap((kind) => {
      const submitted = state.submissions[kind],
        section = content[kind]
      return submitted && section
        ? [
            {
              kind,
              text: submitted.text,
              revision: `${row.id}:${kind}:${submitted.submittedAt}`,
              prompt: section.prompt!,
              reference: section.reference ?? '',
              rubric:
                kind === 'WRITING'
                  ? '任务完成、论证组织、语言准确性与词汇丰富度'
                  : '意义完整准确、语法与用词、行文通顺',
              minimumWords: section.minimumWords,
              maximumWords: section.maximumWords,
              submittedAt: submitted.submittedAt,
              expired: submitted.expired,
            },
          ]
        : []
    }),
  }
}
export async function getExamSubjectiveSubmissions(
  userId: string,
  id: string,
  db: PrismaClient = prisma,
) {
  const row = await owned(db, userId, id)
  if (row.status !== 'COMPLETE') throw new StudyInputError('完成考试后才能评分', 409)
  return subjective(row)
}
export async function listExamPapers(
  userId: string,
  level: string | null,
  mode: string | null,
  cursor: string | null,
  db: PrismaClient = prisma,
) {
  if (
    (level && !['CET4', 'CET6'].includes(level)) ||
    (mode && !['FULL', 'LISTENING', 'READING', 'TRANSLATION', 'WRITING'].includes(mode))
  )
    throw new StudyInputError('试卷筛选无效')
  const kind = mode ? 'FULL' : null
  const cursorRow = cursor
    ? await db.examPaper.findFirst({
        where: {
          id: cursor,
          ...await accessiblePaperWhere(db, userId),
          rightsStatus: 'APPROVED',
          ...(level ? { level } : {}),
          ...(kind ? { kind } : {}),
        },
        select: metadataSelect,
      })
    : null
  if (cursor && (!cursorRow || !isCurrentPaper(cursorRow.slug))) throw new StudyInputError('目录分页标识无效')
  const rank = (type: string) => (type === 'PAST_EXAM' ? 0 : type === 'OFFICIAL_SAMPLE' ? 1 : 2)
  const rows = await db.$queryRaw<ExamPaperMetadata[]>`
    SELECT p.id,p.slug,p.version,p.title,p.level,p.kind,p."originType",p."sourceName",p."sourceUrl",p."contentHash"
    FROM "ExamPaper" p WHERE ${examAccessSql(userId)} AND p."rightsStatus"='APPROVED' AND (${level}::text IS NULL OR p.level=${level}) AND (${kind}::text IS NULL OR p.kind=${kind})
    AND CASE WHEN p.slug ~ '^cet[46]-[0-9]{4}-' THEN substring(p.slug from 6 for 4)::int >= ${MINIMUM_CET_YEAR} ELSE TRUE END
    AND NOT EXISTS (SELECT 1 FROM "ExamPaper" n WHERE n.slug=p.slug AND n."rightsStatus"='APPROVED' AND n.version>p.version)
    AND (${cursor}::text IS NULL OR (CASE p."originType" WHEN 'PAST_EXAM' THEN 0 WHEN 'OFFICIAL_SAMPLE' THEN 1 ELSE 2 END,p.id)>(${cursorRow ? rank(cursorRow.originType) : -1},${cursor ?? ''}))
    ORDER BY CASE p."originType" WHEN 'PAST_EXAM' THEN 0 WHEN 'OFFICIAL_SAMPLE' THEN 1 ELSE 2 END,p.id LIMIT 21`
  return { items: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null }
}
export async function startExam(
  userId: string,
  input: Record<string, unknown>,
  db: PrismaClient = prisma,
) {
  const operationId = clientId(input.clientId),
    paperId = examText(input.paperId, 100),
    mode = input.mode as ExamMode
  if (!['FULL', 'LISTENING', 'READING', 'TRANSLATION', 'WRITING'].includes(mode)) throw new StudyInputError('考试模式无效')
  return db.$transaction(async (tx) => {
    await lock(tx, userId)
    const intent = { type: 'START', paperId, mode }
    const prior = await tx.examEvent.findUnique({
      where: { userId_clientId: { userId, clientId: operationId } },
    })
    if (prior) {
      if (!isDeepStrictEqual(prior.input, intent))
        throw new StudyInputError('操作标识已用于其他内容', 409)
      return examSessionView(
        await advance(tx, await owned(tx, userId, prior.attemptId), new Date()),
      )
    }
    const replay = await tx.examAttempt.findUnique({
      where: { userId_startKey: { userId, startKey: operationId } },
      include: { paper: true },
    })
    if (replay) {
      if (replay.paperId !== paperId || replay.mode !== mode)
        throw new StudyInputError('操作标识已用于其他试卷', 409)
      return examSessionView(await advance(tx, await owned(tx, userId, replay.id), new Date()))
    }
    const paper = await tx.examPaper.findUnique({ where: { id: paperId } })
    if (!paper || !isCurrentPaper(paper.slug) || paper.rightsStatus !== 'APPROVED' || (mode !== 'LISTENING' && paper.kind !== 'FULL'))
      throw new StudyInputError('没有已核验的对应试卷', 409)
    await requireExamAccess(tx, userId, paper.slug)
    parseExamContent(paper.content, paper.level as StudyLevel, paper.kind as ExamPaperKind)
    const active = await tx.examAttempt.findFirst({
      where: {
        userId,
        paperId,
        mode,
        status: { not: 'COMPLETE' },
        paper: { level: paper.level, rightsStatus: 'APPROVED' },
      },
      include: { paper: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (active) {
      const resumed = await advance(tx, active, new Date())
      if (resumed.status !== 'COMPLETE') {
        await tx.examEvent.create({
          data: {
            userId,
            attemptId: resumed.id,
            clientId: operationId,
            input: json(intent),
            receipt: json({ type: 'START', resumed: true }),
          },
        })
        return examSessionView(resumed)
      }
    }
    const goal = await tx.studyGoal.findUnique({ where: { userId } })
    const goalSnapshot = goal
      ? {
          level: goal.level,
          examDate: goal.examDate.toISOString().slice(0, 10),
          targetScore: goal.targetScore,
          revision: goal.revision,
        }
      : { level: paper.level }
    const now = new Date(),
      stage = mode === 'FULL' ? 'WRITING' : mode
    const row = await tx.examAttempt.create({
      data: {
        userId,
        paperId,
        startKey: operationId,
        mode,
        goalSnapshot: json(goalSnapshot),
        status: stage,
        state: json(emptyExamState()),
        stageStartedAt: now,
        deadlineAt:
          mode === 'FULL'
            ? new Date(now.getTime() + examMinutes(paper.level as StudyLevel, stage, parseExamContent(paper.content, paper.level as StudyLevel, paper.kind as ExamPaperKind).LISTENING.audio.reduce((sum, audio) => sum + audio.durationSeconds, 0)) * 60000)
            : null,
      },
      include: { paper: true },
    })
    await tx.examEvent.create({
      data: {
        userId,
        attemptId: row.id,
        clientId: operationId,
        input: json(intent),
        receipt: json({ type: 'START', resumed: false }),
      },
    })
    return examSessionView(row, now)
  })
}
export async function readExam(userId: string, id: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    await lock(tx, userId)
    const now = new Date()
    return examSessionView(await advance(tx, await owned(tx, userId, id), now), now)
  })
}
export async function examAction(
  userId: string,
  id: string,
  action: ExamAction,
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    await lock(tx, userId)
    const now = new Date()
    const highlighting = action.type === 'READING_HIGHLIGHT'
    let row = await owned(tx, userId, id)
    if (!highlighting) row = await advance(tx, row, now)
    const old = await tx.examEvent.findUnique({
      where: { userId_clientId: { userId, clientId: action.clientId } },
    })
    if (old) {
      if (old.attemptId !== id || !isDeepStrictEqual(old.input, action))
        throw new StudyInputError('操作标识已使用', 409)
      return { session: examSessionView(row, now), receipt: old.receipt }
    }
    if (row.revision !== action.revision)
      throw new StudyInputError('另一处已更新作答，请刷新恢复最新记录', 409)
    if (!highlighting && row.status !== action.stage)
      throw new StudyInputError('阶段已结束，请恢复最新考试记录', 409)
    const state = stateOf(row),
      content = parseExamContent(
        row.paper.content,
        row.paper.level as StudyLevel,
        row.paper.kind as ExamPaperKind,
      ),
      section = content[action.stage]!
    if (highlighting && (!section || !['FULL', 'READING'].includes(row.mode)))
      throw new StudyInputError('本练习没有阅读内容')
    if (action.type === 'READING_MARK' || action.type === 'READING_HIGHLIGHT' || action.type === 'READING_HELP') {
      const { mark } = action
      const passage = section.passages.find((p) => p.id === mark.passageId)
      if (!passage || passage.text.slice(mark.start, mark.end) !== mark.text)
        throw new StudyInputError('阅读标记与原文不一致')
      if (action.type === 'READING_HELP') row.assisted = true
      else if (action.type === 'READING_HIGHLIGHT') {
        const token = [...passage.text.matchAll(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g)].find((word) => word.index === mark.start && word.index + word[0].length === mark.end)
        if (!token) throw new StudyInputError('荧光标记只能用于完整的单个单词')
        const highlights = (state.readingHighlights ?? []).filter((m) => !(m.passageId === mark.passageId && m.start === mark.start && m.end === mark.end))
        if (action.marked) {
          if (highlights.length >= 1000) throw new StudyInputError('本份试卷最多保存1000处单词荧光标记')
          highlights.push(mark)
        }
        state.readingHighlights = highlights
      } else {
        const marks = (state.readingMarks ?? []).filter((m) => !(m.passageId === mark.passageId && m.start === mark.start && m.end === mark.end))
        if (action.marked) {
          if (marks.length >= 200) throw new StudyInputError('本份试卷最多保存200处标记')
          if (marks.some((m) => m.passageId === mark.passageId && m.start < mark.end && m.end > mark.start))
            throw new StudyInputError('这段文字已有标记，请先取消原标记')
          marks.push(mark)
        }
        state.readingMarks = marks
      }
    } else if (action.type === 'AUDIO_PLAY') {
      if (!section.audio.some((a) => a.id === action.audioId))
        throw new StudyInputError('音频不存在')
      const count = state.audioPlays[action.audioId] ?? 0
      state.audioPlays[action.audioId] = count + 1
      if (count > 0) {
        row.replayCount++
        if (row.mode === 'FULL') row.assisted = true
      }
    } else {
      const draft = state.drafts[action.stage] ?? { answers: {}, text: '' }
      if (action.answers) {
        if (!['READING', 'LISTENING'].includes(action.stage))
          throw new StudyInputError('当前阶段不接受选择题')
        for (const [key, choice] of Object.entries(action.answers)) {
          const q = section.questions.find((q) => q.id === key)
          if (!q || choice >= q.choices.length) throw new StudyInputError('题目或选项无效')
          if (!state.firstAnswers[key]) state.firstAnswers[key] = { choice, at: now.toISOString() }
          draft.answers[key] = choice
        }
      }
      if (action.text !== undefined) {
        if (!['WRITING', 'TRANSLATION'].includes(action.stage))
          throw new StudyInputError('当前阶段不接受文本')
        draft.text = action.text
      }
      state.drafts[action.stage] = draft
      if (action.type === 'SUBMIT_STAGE') submit(row, state, now, false)
    }
    row = await tx.examAttempt.update({
      where: { id },
      data: {
        state: json(state),
        status: row.status,
        deadlineAt: row.deadlineAt,
        stageStartedAt: row.stageStartedAt,
        completedAt: row.completedAt,
        assisted: row.assisted,
        replayCount: row.replayCount,
        revision: { increment: 1 },
      },
      include: { paper: true },
    })
    const receipt = { type: action.type, stage: action.stage, savedAt: now.toISOString() }
    await tx.examEvent.create({
      data: {
        userId,
        attemptId: id,
        clientId: action.clientId,
        input: json(action),
        receipt: json(receipt),
      },
    })
    return { session: examSessionView(row, now), receipt }
  })
}
export async function examArchive(
  userId: string,
  cursor: string | null,
  db: PrismaClient = prisma,
) {
  if (
    cursor &&
    !(await db.examAttempt.findFirst({ where: { id: cursor, userId }, select: { id: true } }))
  )
    throw new StudyInputError('归档分页标识无效')
  const rows = await db.examAttempt.findMany({
    where: { userId, paper: await accessiblePaperWhere(db, userId) },
    select: {
      id: true,
      mode: true,
      status: true,
      startedAt: true,
      completedAt: true,
      assisted: true,
      paper: { select: metadataSelect },
    },
    take: 21,
    orderBy: { id: 'desc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return {
    items: rows
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        mode: r.mode,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        assisted: r.assisted,
        paper: meta(r.paper),
      })),
    nextCursor: rows.length > 20 ? rows[19].id : null,
  }
}
export async function importExamPaper(
  userId: string,
  input: Record<string, unknown>,
  db: PrismaClient = prisma,
) {
  const level = input.level as StudyLevel,
    kind = input.kind as ExamPaperKind
  if (!['CET4', 'CET6'].includes(level) || !['FULL', 'LISTENING'].includes(kind))
    throw new StudyInputError('试卷级别或类型无效')
  const content = parseExamContent(input.content, level, kind),
    slug = examText(input.slug, 100),
    version = Number(input.version)
  if (
    !Number.isInteger(version) ||
    version < 1 ||
    version > 10000 ||
    !/^[a-z0-9][a-z0-9-]{1,99}$/.test(slug)
  )
    throw new StudyInputError('试卷版本无效')
  const originType = String(input.originType)
  if (
    !['PAST_EXAM', 'OFFICIAL_SAMPLE', 'ORIGINAL'].includes(originType) ||
    (originType !== 'ORIGINAL' && !input.sourceUrl)
  )
    throw new StudyInputError('试卷来源类型或原始出处缺失')
  const data = {
    slug,
    version,
    level,
    kind,
    originType,
    title: examText(input.title, 200),
    sourceName: examText(input.sourceName, 200),
    sourceUrl: input.sourceUrl ? examUrl(input.sourceUrl) : null,
    rightsHolder: examText(input.rightsHolder, 300),
    rightsEvidence: examText(input.rightsEvidence, 10000),
    rightsStatus: 'PENDING',
    content: json(content),
    contentHash: '',
  }
  data.contentHash = createHash('sha256')
    .update(JSON.stringify({ ...data, contentHash: undefined, rightsStatus: undefined }))
    .digest('hex')
  return db.$transaction(async (tx) => {
    await admin(tx, userId)
    const old = await tx.examPaper.findUnique({ where: { slug_version: { slug, version } } })
    if (old) {
      const { rightsStatus: _, ...intent } = data
      const { id: __, createdAt: ___, rightsStatus: ____, ...stored } = old
      if (!isDeepStrictEqual(intent, stored))
        throw new StudyInputError('已存在不可变版本，请使用新版本', 409)
      return meta(old)
    }
    const duplicate = await tx.examPaper.findUnique({ where: { contentHash: data.contentHash } })
    if (duplicate) throw new StudyInputError('试卷内容已存在', 409)
    const paper = await tx.examPaper.create({ data })
    await tx.auditLog.create({
      data: {
        userId,
        action: 'EXAM_IMPORT',
        entityType: 'ExamPaper',
        entityId: paper.id,
        newValue: JSON.stringify({ slug, version, contentHash: paper.contentHash }),
      },
    })
    return meta(paper)
  })
}
export async function reviewExamPaper(
  userId: string,
  id: string,
  input: Record<string, unknown>,
  db: PrismaClient = prisma,
) {
  if (!['APPROVED', 'REJECTED'].includes(String(input.rightsStatus)))
    throw new StudyInputError('审核状态无效')
  const evidence = examText(input.reviewEvidence, 10000)
  return db.$transaction(async (tx) => {
    await admin(tx, userId)
    const old = await tx.examPaper.findUnique({ where: { id } })
    if (!old) throw new StudyInputError('试卷不存在', 404)
    parseExamContent(old.content, old.level as StudyLevel, old.kind as ExamPaperKind)
    const paper = await tx.examPaper.update({
      where: { id },
      data: { rightsStatus: String(input.rightsStatus) },
    })
    await tx.auditLog.create({
      data: {
        userId,
        action: 'EXAM_REVIEW',
        entityType: 'ExamPaper',
        entityId: id,
        oldValue: old.rightsStatus,
        newValue: JSON.stringify({ status: paper.rightsStatus, evidence }),
      },
    })
    return meta(paper)
  })
}

export async function adminExamPaper(userId: string, id: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    await admin(tx, userId)
    const paper = await tx.examPaper.findUnique({ where: { id } })
    if (!paper) throw new StudyInputError('试卷不存在', 404)
    return paper
  })
}
