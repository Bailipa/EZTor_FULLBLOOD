import { clientId } from '@/features/study/domain'
import { studyApi, studyBody } from '@/services/study/api'
import { startStudy } from '@/services/study/StudyService'

export async function POST(req: Request) {
  return studyApi(req, async (userId) => {
    const body = await studyBody(req)
    return startStudy(userId, clientId(body.clientId))
  })
}
