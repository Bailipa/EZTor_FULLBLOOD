import { studyApi, studyBody } from '@/services/study/api'
import { listExamPapers, startExam } from '@/services/study/ExamService'
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  return studyApi(req, () => listExamPapers(q.get('level'), q.get('mode') ?? q.get('kind'), q.get('cursor')))
}
export async function POST(req: Request) {
  return studyApi(req, async (userId) => startExam(userId, await studyBody(req)))
}
