import { studyApi } from '@/services/study/api'
import { examArchive } from '@/services/study/ExamService'
export async function GET(req: Request) {
  return studyApi(req, (userId) => examArchive(userId, new URL(req.url).searchParams.get('cursor')))
}
