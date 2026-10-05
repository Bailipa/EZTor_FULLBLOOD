import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { contributionTotals } from '@/lib/contributions'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = 20
  const [totals, ownProfile] = await Promise.all([
    contributionTotals(),
    prisma.contributionProfile.findUnique({
      where: { userId: session.user.id },
      select: { visibility: true },
    }),
  ])

  const userIds = Array.from(totals.keys())
  const profiles = userIds.length > 0
    ? await prisma.contributionProfile.findMany({
        where: {
          userId: { in: userIds },
          visibility: { in: ['anonymous', 'nickname'] },
          User: { isBanned: false },
        },
        select: {
          userId: true,
          visibility: true,
          publicAlias: true,
          User: { select: { GameProfile: { select: { nickname: true } } } },
        },
      })
    : []
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]))

  const allRows = Array.from(totals).flatMap(([userId, count]) => {
    const profile = profileByUserId.get(userId)
    if (!profile) return []
    const nickname = profile.visibility === 'nickname' ? profile.User.GameProfile?.nickname : null
    return [{
      displayName: nickname || profile.publicAlias,
      count,
      alias: profile.publicAlias,
    }]
  }).sort((a, b) => b.count - a.count || a.alias.localeCompare(b.alias))

  const myAlias = profiles.find((profile) => profile.userId === session.user.id)?.publicAlias
  const myRowIndex = myAlias ? allRows.findIndex((row) => row.alias === myAlias) : -1
  const myRank = myRowIndex >= 0 ? allRows.findIndex((row) => row.count === allRows[myRowIndex].count) + 1 : null
  const myPage = myRowIndex >= 0 ? Math.floor(myRowIndex / pageSize) + 1 : null
  const rankByCount = new Map<number, number>()
  allRows.forEach((row, index) => {
    if (!rankByCount.has(row.count)) rankByCount.set(row.count, index + 1)
  })
  const rows = allRows.slice((page - 1) * pageSize, page * pageSize).map((row, index) => {
    const absoluteIndex = (page - 1) * pageSize + index
    return {
      rank: rankByCount.get(row.count) || absoluteIndex + 1,
      displayName: row.displayName,
      count: row.count,
      isMe: row.alias === myAlias,
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      enabled: true,
      period: 'all',
      asOf: new Date().toISOString(),
      rows,
      page,
      pageSize,
      myPage,
      totalParticipants: allRows.length,
      totalPages: Math.max(1, Math.ceil(allRows.length / pageSize)),
      myCount: totals.get(session.user.id) || 0,
      myRank,
      visibility: ownProfile?.visibility || 'private',
    },
  })
}
