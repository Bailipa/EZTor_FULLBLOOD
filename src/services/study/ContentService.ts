import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parsePassage, StudyInputError } from '@/features/study/domain'

async function requireAdmin(tx: Prisma.TransactionClient, userId: string) {
  const users = await tx.$queryRaw<{ isAdmin: boolean; isBanned: boolean; banExpiresAt: Date | null }[]>`SELECT "isAdmin", "isBanned", "banExpiresAt" FROM "User" WHERE id = ${userId} FOR UPDATE`
  const user = users[0]
  if (!user?.isAdmin || (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date()))) throw new StudyInputError('需要管理员权限', 403)
}

export async function importStudyPassage(userId: string, raw: unknown, db: PrismaClient = prisma) {
  const input = parsePassage(raw)
  const contentHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, userId)
    const existing = await tx.studyPassage.findUnique({ where: { slug_version: { slug: input.slug, version: input.version } } })
    if (existing) {
      if (existing.contentHash !== contentHash) throw new StudyInputError('内容版本已存在；修改内容须使用新版本号', 409)
      return { id: existing.id, rightsStatus: existing.rightsStatus, contentHash }
    }
    const passage = await tx.studyPassage.create({ data: { ...input, content: input.content as unknown as Prisma.InputJsonValue, contentHash, rightsStatus: 'PENDING' } })
    await tx.auditLog.create({ data: { userId, action: 'IMPORT_STUDY_PASSAGE', entityType: 'StudyPassage', entityId: passage.id, newValue: JSON.stringify({ slug: input.slug, version: input.version, contentHash, rightsStatus: 'PENDING' }) } })
    return { id: passage.id, rightsStatus: passage.rightsStatus, contentHash }
  })
}

export async function reviewStudyPassage(userId: string, id: string, status: unknown, rawReason: unknown, db: PrismaClient = prisma) {
  if (status !== 'APPROVED' && status !== 'REJECTED') throw new StudyInputError('请选择通过或拒绝')
  if (typeof rawReason !== 'string' || rawReason.trim().length < 6 || rawReason.length > 2000) throw new StudyInputError('请记录具体核验依据或拒绝原因（6–2000字）')
  const reason = rawReason.trim()
  return db.$transaction(async (tx) => {
    await requireAdmin(tx, userId)
    await tx.$queryRaw`SELECT id FROM "StudyPassage" WHERE id = ${id} FOR UPDATE`
    const current = await tx.studyPassage.findUnique({ where: { id } })
    if (!current) throw new StudyInputError('材料不存在', 404)
    await tx.studyPassage.update({ where: { id }, data: { rightsStatus: status } })
    await tx.auditLog.create({ data: { userId, action: 'REVIEW_STUDY_PASSAGE', entityType: 'StudyPassage', entityId: id, oldValue: JSON.stringify({ rightsStatus: current.rightsStatus }), newValue: JSON.stringify({ rightsStatus: status, reason, contentHash: current.contentHash }) } })
    return { id, rightsStatus: status }
  })
}
