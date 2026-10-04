import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getContributionT0 } from '@/lib/contributionLedger'

// Direct submissions have exact attribution from their first record. Older AI entries
// still require the trusted T0; never infer ownership of legacy/imported words.
export function creditedWordWhere(): Prisma.ContributionLedgerWhereInput {
  const t0 = getContributionT0()
  return { OR: [
    { source: 'USER_UPLOAD' },
    ...(t0 ? [{ source: 'USER_AI', occurredAt: { gte: t0, lte: new Date() } }] : []),
  ] }
}

export async function contributionTotals() {
  const [words, corrections] = await Promise.all([
    prisma.contributionLedger.groupBy({
      by: ['contributorUserId'], where: { ...creditedWordWhere(), status: 'VALID', contributorUserId: { not: null } }, _count: { _all: true },
    }),
    prisma.contributionSubmission.groupBy({
      by: ['userId'], where: { kind: 'CORRECTION', status: 'APPROVED' }, _sum: { points: true },
    }),
  ])
  const totals = new Map<string, number>()
  words.forEach((row) => { if (row.contributorUserId) totals.set(row.contributorUserId, row._count._all) })
  corrections.forEach((row) => { if (row._sum.points) totals.set(row.userId, (totals.get(row.userId) || 0) + row._sum.points) })
  return totals
}
