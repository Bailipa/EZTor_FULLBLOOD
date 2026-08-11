import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || ''
  const zoneId = url.searchParams.get('zoneId') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (zoneId) {
    where.zoneId = zoneId
  }
  if (search) {
    where.OR = [
      { nickname: { contains: search, mode: 'insensitive' } },
      { User: { username: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [profiles, total] = await Promise.all([
    prisma.userGameProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { combatPower: 'desc' },
      include: {
        User: { select: { username: true, isAiFree: true } },
        WarZone: { select: { name: true } },
      },
    }),
    prisma.userGameProfile.count({ where }),
  ])

  const identities = profiles.length
    ? await prisma.externalIdentity.findMany({
        where: { provider: 'xiaoying', localUserId: { in: profiles.map((p) => p.userId) } },
        select: { localUserId: true, subject: true, createdAt: true },
      })
    : []
  const identityByUserId = new Map(identities.map((i) => [i.localUserId, i]))

  // AI 询问次数（按用户聚合）
  const aiCounts = profiles.length
    ? await prisma.aiAskLog.groupBy({
        by: ['userId'],
        where: { userId: { in: profiles.map((p) => p.userId) } },
        _count: { _all: true },
      })
    : []
  const aiCountMap = new Map(aiCounts.map((c) => [c.userId, c._count._all]))

  return NextResponse.json({
    success: true,
    data: profiles.map((p) => {
      const ident = identityByUserId.get(p.userId)
      return {
        id: p.id,
        userId: p.userId,
        username: p.User.username,
        isAiFree: p.User.isAiFree,
        aiAskCount: aiCountMap.get(p.userId) ?? 0,
        nickname: p.nickname,
        combatPower: p.combatPower,
        monthlyPower: p.monthlyPower,
        weeklyPower: p.weeklyPower,
        dailyPowerGained: p.dailyPowerGained,
        dailyPowerCap: p.dailyPowerCap,
        currentStreak: p.currentStreak,
        longestStreak: p.longestStreak,
        zoneId: p.zoneId,
        zoneName: p.WarZone?.name ?? null,
        zoneTitle: p.zoneTitle,
        unlockedFeatures: p.unlockedFeatures,
        lastActiveDate: p.lastActiveDate,
        createdAt: p.createdAt.toISOString(),
        provider: ident ? 'xiaoying' : 'local',
        externalSubject: ident?.subject ?? null,
        externalBoundAt: ident?.createdAt.toISOString() ?? null,
      }
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}
