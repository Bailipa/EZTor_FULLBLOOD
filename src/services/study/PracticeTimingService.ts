import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { StudyInputError } from '@/features/study/domain'
import { parsePracticeTiming, TIMING_STAGES } from '@/features/study/practiceTiming'
import type { ExamState } from '@/features/study/examTypes'
import { requireExamAccess } from './ExamAccessService'

export async function savePracticeTiming(userId: string, attemptId: string, input: unknown) {
  const timing = parsePracticeTiming(input)
  if (!timing) throw new StudyInputError('计时数据无效')
  return prisma.$transaction(async tx => {
    // Serialize saves and check account state inside the same transaction as the write.
    const accounts = await tx.$queryRaw<{ isBanned: boolean; banExpiresAt: Date | null }[]>`SELECT "isBanned", "banExpiresAt" FROM "User" WHERE id=${userId} FOR UPDATE`
    const account = accounts[0]
    if (!account) throw new StudyInputError('请重新登录', 401)
    if (account.isBanned && (!account.banExpiresAt || account.banExpiresAt > new Date())) throw new StudyInputError('账号不可用', 403)
    const attempt = await tx.examAttempt.findFirst({ where: { id: attemptId, userId }, include: { paper: { select: { slug: true, rightsStatus: true } } } })
    if (!attempt) throw new StudyInputError('考试记录不存在', 404)
    await requireExamAccess(tx, userId, attempt.paper.slug)
    if (attempt.paper.rightsStatus !== 'APPROVED') throw new StudyInputError('试卷暂不可用', 409)
    const state = attempt.state as unknown as ExamState
    const stages = attempt.mode === 'FULL' ? TIMING_STAGES : TIMING_STAGES.filter(stage => stage === attempt.mode)
    if (attempt.status !== 'COMPLETE' || stages.length === 0 || !stages.every(stage => state.submissions?.[stage])) throw new StudyInputError('完成本次练习后才能保存用时', 409)
    if (TIMING_STAGES.some(stage => !stages.includes(stage) && timing.modules[stage] !== 0)) throw new StudyInputError('计时数据包含本次练习之外的模块')
    if (state.listeningReuse?.status === 'REUSE' && state.listeningReuse.inheritedElapsedMs !== undefined) {
      timing.modules.LISTENING = state.listeningReuse.inheritedElapsedMs
      timing.totalMs = Object.values(timing.modules).reduce((sum, ms) => sum + ms, 0)
      timing.tracked ||= timing.totalMs > 0
    }
    if (attempt.practiceTiming !== null) return parsePracticeTiming(attempt.practiceTiming)
    await tx.examAttempt.update({ where: { id: attempt.id }, data: { practiceTiming: timing as unknown as Prisma.InputJsonValue } })
    return timing
  })
}
