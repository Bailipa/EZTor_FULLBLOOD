import { studyApi, studyBody } from '@/services/study/api'
import { examAction } from '@/services/study/ExamService'
import { parseExamAction } from '@/features/study/examDomain'
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) =>
    examAction(userId, (await params).id, parseExamAction(await studyBody(req, 60000))),
  )
}
