import { studyApi, studyBody } from '@/services/study/api'
import { gradeStudyWork, parseGradeInput, readGrade } from '@/services/study/GradingService'
import { clientId, StudyInputError } from '@/features/study/domain'
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: Request) {
  return studyApi(req, userId => readGrade(userId, parseGradeInput(Object.fromEntries(new URL(req.url).searchParams))))
}
export async function POST(req: Request) {
  return studyApi(req, async userId => {
    if (!(await rateLimit(`study-grade:${userId}`, { maxRequests: 8, windowMs: 60000 })).success) throw new StudyInputError('评分请求较多，请稍后重试；作品已保存', 429)
    const body = await studyBody(req)
    return gradeStudyWork(userId, { ...parseGradeInput(body), clientId: clientId(body.clientId) })
  })
}
