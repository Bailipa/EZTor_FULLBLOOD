import { studyApi, studyBody } from '@/services/study/api'
import { importExamPaper } from '@/services/study/ExamService'
import prisma from '@/lib/prisma'
export async function GET(req: Request) {
  return studyApi(
    req,
    () =>
      prisma.examPaper.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          version: true,
          title: true,
          level: true,
          kind: true,
          originType: true,
          sourceName: true,
          sourceUrl: true,
          rightsHolder: true,
          rightsEvidence: true,
          rightsStatus: true,
          contentHash: true,
          createdAt: true,
        },
      }),
    true,
  )
}
export async function POST(req: Request) {
  return studyApi(
    req,
    async (userId) => importExamPaper(userId, await studyBody(req, 1500000)),
    true,
  )
}
