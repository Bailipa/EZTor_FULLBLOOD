import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

// 管理员：AI 询问使用统计（按用户聚合）
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!admin?.isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const skip = (page - 1) * limit

  const where = search
    ? { User: { OR: [{ username: { contains: search, mode: 'insensitive' as const } }, { nickname: { contains: search, mode: 'insensitive' as const } }] } }
    : {}

  const [groups, total] = await Promise.all([
    prisma.aiAskLog.groupBy({
      by: ['userId'],
      where,
      _count: { _all: true },
      _sum: { cost: true },
      _max: { createdAt: true },
      orderBy: { _count: { userId: 'desc' } },
      skip,
      take: limit,
    }),
    prisma.aiAskLog.groupBy({
      by: ['userId'],
      where,
      _count: { _all: true },
    }),
  ])

  const userIds = groups.map((g) => g.userId)
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, isAiFree: true, GameProfile: { select: { nickname: true } } },
      })
    : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  const data = groups.map((g) => {
    const u = userMap.get(g.userId)
    return {
      userId: g.userId,
      username: u?.username ?? '?',
      nickname: u?.GameProfile?.nickname ?? null,
      isAiFree: u?.isAiFree ?? false,
      askCount: g._count._all,
      totalCost: g._sum.cost ?? 0,
      lastUsedAt: g._max.createdAt?.toISOString() ?? null,
    }
  })

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, limit, total: total.length, totalPages: Math.ceil(total.length / limit) },
  })
}
