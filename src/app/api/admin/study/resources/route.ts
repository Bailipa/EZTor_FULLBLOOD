import { studyApi } from '@/services/study/api'
import { uploadExamResource } from '@/services/study/ExamResourceService'

export const runtime = 'nodejs'
export async function POST(req: Request) {
  return studyApi(req, (userId) => uploadExamResource(req, userId), true)
}
