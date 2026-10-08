import { studyApi } from '@/services/study/api'
import { readExam } from '@/services/study/ExamService'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => readExam(userId, (await params).id))
}
