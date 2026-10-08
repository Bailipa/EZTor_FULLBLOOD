import { studyApi, studyBody } from '@/services/study/api'
import { reviewStudyPassage } from '@/services/study/ContentService'
import prisma from '@/lib/prisma'
import { StudyInputError } from '@/features/study/domain'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async () => {
    const row = await prisma.studyPassage.findUnique({ where: { id: (await params).id } })
    if (!row) throw new StudyInputError('材料不存在', 404)
    return row
  }, true)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => {
    const body = await studyBody(req)
    return reviewStudyPassage(userId, (await params).id, body.status, body.reason)
  }, true)
}
