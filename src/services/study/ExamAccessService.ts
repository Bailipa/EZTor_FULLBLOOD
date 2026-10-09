import { Prisma } from '@prisma/client'
import { StudyInputError } from '@/features/study/domain'

type AccessDb = Pick<Prisma.TransactionClient, 'examAccess' | 'examPaper'>
export function examPaperKey(slug: string) {
  return slug.replace(/-(?:passage\d+(?:-q\d+-\d+)?|full|listening)$/, '')
}
// Public access follows approved original content, never a client-supplied slug prefix.
export async function defaultExamKeys(db: AccessDb) {
  const papers = await db.examPaper.findMany({ where: { originType: 'ORIGINAL', rightsStatus: 'APPROVED' }, select: { slug: true }, distinct: ['slug'] })
  return [...new Set(papers.map((paper) => examPaperKey(paper.slug)))]
}
export async function requireExamAccess(db: AccessDb, userId: string, slug: string) {
  const grant = await db.examAccess.findUnique({ where: { userId_paperKey: { userId, paperKey: examPaperKey(slug) } } })
  if (grant) return
  const key = examPaperKey(slug)
  const original = await db.examPaper.findFirst({ where: { originType: 'ORIGINAL', rightsStatus: 'APPROVED', slug: { in: [key, `${key}-full`, `${key}-listening`] } }, select: { id: true } })
  if (!original) throw new StudyInputError('暂时没有试卷可用', 403)
}
export async function accessiblePaperWhere(db: AccessDb, userId: string) {
  const [grants, defaults] = await Promise.all([db.examAccess.findMany({ where: { userId }, select: { paperKey: true } }), defaultExamKeys(db)])
  const keys = [...new Set([...grants.map((grant) => grant.paperKey), ...defaults])]
  return { OR: keys.flatMap((paperKey) => [{ slug: { in: [paperKey, `${paperKey}-full`, `${paperKey}-listening`] } }, { slug: { startsWith: `${paperKey}-passage` } }]) }
}
// All callers alias the paper/passage table as p. Values remain SQL parameters.
export function examAccessSql(userId: string) {
  return Prisma.sql`(EXISTS (SELECT 1 FROM "ExamPaper" original WHERE original."originType"='ORIGINAL' AND original."rightsStatus"='APPROVED'
    AND regexp_replace(original.slug, '-(full|listening)$', '') = regexp_replace(p.slug, '-(passage[0-9]+(-q[0-9]+-[0-9]+)?|full|listening)$', ''))
    OR EXISTS (SELECT 1 FROM "ExamAccess" access WHERE access."userId" = ${userId}
    AND access."paperKey" = regexp_replace(p.slug, '-(passage[0-9]+(-q[0-9]+-[0-9]+)?|full|listening)$', '')))`
}
