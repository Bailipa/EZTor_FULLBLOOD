import { studyApi } from '@/services/study/api'
import { studyEvents } from '@/services/study/StudyService'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => studyEvents(userId, (await params).id, new URL(req.url).searchParams.get('cursor') || undefined))
}
