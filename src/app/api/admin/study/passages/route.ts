import { studyApi, studyBody } from '@/services/study/api'
import { importStudyPassage } from '@/services/study/ContentService'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  return studyApi(req, () => prisma.studyPassage.findMany({ take: 50, orderBy: { createdAt: 'desc' }, select: {
    id: true, slug: true, version: true, title: true, level: true, kind: true, sourceName: true, sourceUrl: true, rightsHolder: true, rightsEvidence: true, rightsStatus: true, contentHash: true, createdAt: true,
  } }), true)
}
export async function POST(req: Request) {
  return studyApi(req, async (userId) => importStudyPassage(userId, await studyBody(req, 300000)), true)
}
