import { clientId } from '@/features/study/domain'
import { studyApi, studyBody } from '@/services/study/api'
import { setStudyGoal } from '@/services/study/StudyService'

export async function PUT(req: Request) {
  return studyApi(req, async (userId) => {
    const body = await studyBody(req)
    return setStudyGoal(userId, body, clientId(body.clientId))
  })
}
