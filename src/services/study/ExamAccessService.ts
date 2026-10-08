import { Prisma } from '@prisma/client'
import { StudyInputError } from '@/features/study/domain'

type AccessDb = Pick<Prisma.TransactionClient, 'examAccess'>
export function examPaperKey(slug: string) {
  return slug.replace(/-(?:passage\d+(?:-q\d+-\d+)?|full|listening)$/, '')
}
export async function requireExamAccess(db: AccessDb, userId: string, slug: string) {
  const grant = await db.examAccess.findUnique({ where: { userId_paperKey: { userId, paperKey: examPaperKey(slug) } } })
  if (!grant) throw new StudyInputError('暂时没有试卷可用', 403)
}
export async function accessiblePaperWhere(db: AccessDb, userId: string) {
  const grants = await db.examAccess.findMany({ where: { userId }, select: { paperKey: true } })
  return { OR: grants.flatMap(({ paperKey }) => [{ slug: { in: [paperKey, `${paperKey}-full`, `${paperKey}-listening`] } }, { slug: { startsWith: `${paperKey}-passage` } }]) }
}
// All callers alias the paper/passage table as p. Values remain SQL parameters.
export function examAccessSql(userId: string) {
  return Prisma.sql`EXISTS (SELECT 1 FROM "ExamAccess" access WHERE access."userId" = ${userId}
    AND access."paperKey" = regexp_replace(p.slug, '-(passage[0-9]+(-q[0-9]+-[0-9]+)?|full|listening)$', ''))`
}
