import { studyApi } from '@/services/study/api'
import { studyArchive } from '@/services/study/StudyService'

export async function GET(req: Request) {
  return studyApi(req, (userId) => studyArchive(userId, new URL(req.url).searchParams.get('cursor') || undefined))
}
