import prisma from '@/lib/prisma'
import { studyApi, studyBody } from '@/services/study/api'
import { examPaperKey } from '@/services/study/ExamAccessService'
import { StudyInputError } from '@/features/study/domain'
import { isCurrentPaper } from '@/features/study/paperAvailability'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async () => {
    const { id } = await params
    if (!await prisma.user.findUnique({ where: { id }, select: { id: true } })) throw new StudyInputError('用户不存在', 404)
    const [papers, passages, grants] = await Promise.all([
      prisma.examPaper.findMany({ where: { rightsStatus: 'APPROVED' }, select: { slug: true, title: true, level: true }, orderBy: { version: 'desc' } }),
      prisma.studyPassage.findMany({ where: { rightsStatus: 'APPROVED' }, select: { slug: true, title: true, level: true }, orderBy: { version: 'desc' } }),
      prisma.examAccess.findMany({ where: { userId: id }, select: { paperKey: true } }),
    ])
    const allowed = new Set(grants.map((grant) => grant.paperKey))
    const catalogue = new Map<string, { key: string; title: string; level: string; enabled: boolean }>()
    for (const paper of [...papers, ...passages]) {
      const key = examPaperKey(paper.slug)
      if (!isCurrentPaper(key) || catalogue.has(key)) continue
      const identity = key.match(/^cet[46]-(\d{4})-(\d{2})-set(\d+)$/)
      catalogue.set(key, { key, title: identity ? `${identity[1]}年${Number(identity[2])}月 · 第${identity[3]}套` : paper.title, level: paper.level, enabled: allowed.has(key) })
    }
    return [...catalogue.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, true)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (adminId) => {
    const { id } = await params
    const body = await studyBody(req)
    if (typeof body.paperKey !== 'string' || !body.paperKey || body.paperKey.length > 200 || typeof body.enabled !== 'boolean') throw new StudyInputError('请选择试卷和开放状态')
    const { paperKey, enabled } = body
    return prisma.$transaction(async (tx) => {
      // Match the same account lock used by answer writes, so revocation cannot race a save.
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`
      if (!users.length) throw new StudyInputError('用户不存在', 404)
      const [papers, passages] = await Promise.all([
        tx.examPaper.findMany({ where: { rightsStatus: 'APPROVED' }, select: { slug: true } }),
        tx.studyPassage.findMany({ where: { rightsStatus: 'APPROVED' }, select: { slug: true } }),
      ])
      if (!isCurrentPaper(paperKey) || ![...papers, ...passages].some((p) => examPaperKey(p.slug) === paperKey)) throw new StudyInputError('试卷不存在或暂不可用', 404)
      const previous = await tx.examAccess.findUnique({ where: { userId_paperKey: { userId: id, paperKey } } })
      if (enabled) await tx.examAccess.upsert({ where: { userId_paperKey: { userId: id, paperKey } }, create: { userId: id, paperKey }, update: {} })
      else await tx.examAccess.deleteMany({ where: { userId: id, paperKey } })
      if (!!previous !== enabled) await tx.auditLog.create({ data: { userId: adminId, action: 'SET_EXAM_ACCESS', entityType: 'User', entityId: id,
        oldValue: JSON.stringify({ paperKey, enabled: !!previous }), newValue: JSON.stringify({ paperKey, enabled }) } })
      return { paperKey, enabled }
    })
  }, true)
}
