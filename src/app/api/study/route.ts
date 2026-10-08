import { studyApi } from '@/services/study/api'
import { studyHome } from '@/services/study/StudyService'

export async function GET(req: Request) { return studyApi(req, (userId) => studyHome(userId)) }
