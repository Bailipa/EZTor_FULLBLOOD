import { Prisma, type PrismaClient, type ExamAttempt, type ExamPaper } from '@prisma/client'
import prisma from '@/lib/prisma'
import { examSessionView } from './ExamService'
import { StudyInputError, type StudyLevel } from '@/features/study/domain'
import { parseExamContent } from '@/features/study/examDomain'
import type { ExamPaperKind, ExamState, ExamSection, ReadingMark } from '@/features/study/examTypes'
import type { ReadingMarkItem, ReadingMarkPage } from '@/features/study/readingMarkTypes'

type Row = ExamAttempt & { paper: ExamPaper }
function markedContent(row: Row) {
  const section = parseExamContent(row.paper.content, row.paper.level as StudyLevel, row.paper.kind as ExamPaperKind).READING
  const marks = (row.state as unknown as ExamState).readingMarks ?? []
  return { section, marks: marks.filter((mark) => {
    const passage = section?.passages.find((p) => p.id === mark.passageId)
    return passage && Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end > mark.start && passage.text.slice(mark.start, mark.end) === mark.text
  }) }
}
function paragraphLabel(text: string, start: number) {
  const paragraphs = [...text.matchAll(/[^\r\n]+/g)].filter((line) => line[0].trim())
  const number = paragraphs.findIndex((line) => line.index! + line[0].length > start) + 1
  const digits = '零一二三四五六七八九'
  const label = number < 10 ? digits[number] : number < 100
    ? `${number < 20 ? '' : digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ''}`
    : String(number)
  return `第${label}段`
}
function item(row: Row, mark: ReadingMark, section: ExamSection): ReadingMarkItem {
  const types = { WORD_BANK: '选词填空', MATCHING: '段落匹配', DETAIL: '仔细阅读' }
  const kind = section.questions.find((q) => q.passageId === mark.passageId)?.type
  const label = kind && kind in types ? types[kind as keyof typeof types] : '阅读材料'
  return { ...mark, attemptId: row.id, paperTitle: row.paper.title, paperLevel: row.paper.level,
    source: `${label} · 阅读 · ${paragraphLabel(section.passages.find((p) => p.id === mark.passageId)!.text, mark.start)}` }
}
export async function readingMarks(userId: string, cursor: string | null, db: PrismaClient = prisma): Promise<ReadingMarkPage> {
  const ids = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT a.id FROM "ExamAttempt" a JOIN "ExamPaper" p ON p.id = a."paperId"
    WHERE a."userId" = ${userId} AND p."rightsStatus" = 'APPROVED'
      AND CASE WHEN jsonb_typeof(a.state->'readingMarks') = 'array'
        THEN jsonb_array_length(a.state->'readingMarks') > 0 ELSE false END
      ${cursor ? Prisma.sql`AND a.id < ${cursor}` : Prisma.empty}
    ORDER BY a.id DESC LIMIT 11`)
  const rows = await db.examAttempt.findMany({ where: { userId, id: { in: ids.slice(0, 10).map((r) => r.id) }, paper: { rightsStatus: 'APPROVED' } }, include: { paper: true }, orderBy: { id: 'desc' } })
  return { items: rows.flatMap((row) => { const { section, marks } = markedContent(row); return marks.map((mark) => item(row, mark, section!)) }), nextCursor: ids.length > 10 ? ids[9].id : null }
}
export async function readingMarkSource(userId: string, attemptId: string, passageId: string, start: number, end: number, db: PrismaClient = prisma) {
  const row = await db.examAttempt.findFirst({ where: { id: attemptId, userId, paper: { rightsStatus: 'APPROVED' } }, include: { paper: true } })
  if (!row) throw new StudyInputError('标记来源不存在或试卷已不可用', 404)
  const { section, marks } = markedContent(row)
  const mark = marks.find((m) => m.passageId === passageId && m.start === start && m.end === end)
  if (!mark) throw new StudyInputError('这处标记已取消或不存在', 404)
  return { ...item(row, mark, section!), session: examSessionView(row),
    readingContent: { instructions: section!.instructions, passages: section!.passages,
      questions: section!.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, choices: q.choices, weight: q.weight, passageId: q.passageId })), audio: [] },
    questionId: section!.questions.find((q) => q.passageId === passageId)?.id ?? null }
}
