import prisma from '@/lib/prisma'

export async function isLeaderboardEnabled() {
  const config = await prisma.appFeatureConfig.findUnique({
    where: { id: 'global' },
    select: { leaderboardEnabled: true },
  })

  return config?.leaderboardEnabled ?? true
}
