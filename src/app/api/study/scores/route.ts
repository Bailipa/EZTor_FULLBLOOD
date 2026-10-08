import { studyApi, studyBody } from '@/services/study/api'
import { recordStudyScore, studyScores } from '@/services/study/StudyService'

export async function GET(req: Request) { return studyApi(req, (userId) => studyScores(userId)) }
export async function POST(req: Request) { return studyApi(req, async (userId) => recordStudyScore(userId, await studyBody(req))) }
