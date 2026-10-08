import { parseAction } from '@/features/study/domain'
import { studyApi, studyBody } from '@/services/study/api'
import { readStudySession, studyAction } from '@/services/study/StudyService'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => readStudySession(userId, (await params).id))
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => studyAction(userId, (await params).id, parseAction(await studyBody(req))))
}
