import { studyApi, studyBody } from '@/services/study/api'
import { adminExamPaper, reviewExamPaper } from '@/services/study/ExamService'
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(
    req,
    async (userId) => reviewExamPaper(userId, (await params).id, await studyBody(req)),
    true,
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => adminExamPaper(userId, (await params).id), true)
}
