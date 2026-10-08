import { studyApi, studyBody } from '@/services/study/api'
import { savePracticeTiming } from '@/services/study/PracticeTimingService'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async userId => savePracticeTiming(userId, (await params).id, await studyBody(req, 2000)))
}
