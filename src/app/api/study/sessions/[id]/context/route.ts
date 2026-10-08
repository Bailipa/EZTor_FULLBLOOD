import { studyApi } from '@/services/study/api'
import { readStudySession } from '@/services/study/StudyService'
import { StudyInputError } from '@/features/study/domain'
import { practicePrompt } from '@/features/study/practicePrompt'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return studyApi(req, async (userId) => {
    const session = await readStudySession(userId, (await params).id)
    if (!session.practice) throw new StudyInputError('请先完成本篇阅读题', 409)
    const kind = new URL(req.url).searchParams.get('practice')
    if (kind !== 'translation' && kind !== 'writing') throw new StudyInputError('练习类型无效')
    return { prompt: practicePrompt(session, kind) }
  })
}
