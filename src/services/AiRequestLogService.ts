import prisma from '@/lib/prisma'

export type AiRequestStatus = 'STARTED' | 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'ABORTED'

/** Store the user's actual question before any model call, never the assembled prompt or response. */
export async function startAiRequestLog(userId: string, prompt: string, isAiFree: boolean) {
  return prisma.$transaction(async (tx) => {
    // Serialize per-account pruning so concurrent requests cannot exceed the cap.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const request = await tx.aiAskLog.create({
      data: { userId, prompt: prompt.slice(0, 4000), cost: 0, isAiFree, turns: 0 },
    })
    const audit = await tx.auditLog.create({
      data: {
        userId, action: 'AI_ASK', entityType: 'AI_ASK', entityId: request.id,
        newValue: JSON.stringify({ status: 'STARTED', turns: 0, deducted: false, isAiFree }),
      },
    })
    const excess = await tx.aiAskLog.findMany({
      where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 200, select: { id: true },
    })
    if (excess.length) await tx.aiAskLog.deleteMany({ where: { id: { in: excess.map(({ id }) => id) } } })
    return { requestId: request.id, auditId: audit.id, isAiFree }
  })
}

export async function finishAiRequestLog(
  request: Awaited<ReturnType<typeof startAiRequestLog>>,
  status: Exclude<AiRequestStatus, 'STARTED'>,
  turns = 0,
) {
  await prisma.$transaction([
    // A sufficiently old in-flight request can have been pruned by later requests.
    prisma.aiAskLog.updateMany({ where: { id: request.requestId }, data: { turns } }),
    prisma.auditLog.update({
      where: { id: request.auditId },
      data: { newValue: JSON.stringify({ status, turns, deducted: false, isAiFree: request.isAiFree }) },
    }),
  ])
}
