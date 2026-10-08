import { studyApi, studyBody } from '@/services/study/api'
import { acknowledgeExamAnalysis, generateExamAnalysis, readExamAnalysis } from '@/services/study/ExamAnalysisService'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async userId => readExamAnalysis(userId, (await params).id))
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async userId => generateExamAnalysis(userId, (await params).id))
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async userId => {
    const body = await studyBody(req, 1000)
    return acknowledgeExamAnalysis(userId, (await params).id, body?.token)
  })
}
