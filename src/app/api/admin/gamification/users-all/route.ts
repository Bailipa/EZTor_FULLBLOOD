import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

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
  const search = url.searchParams.get('search')?.trim() || ''
  const excludeZoneId = url.searchParams.get('excludeZoneId') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (search) {
    where.username = { contains: search, mode: 'insensitive' }
  }
  if (excludeZoneId) {
    where.GameProfile = { is: { zoneId: { not: excludeZoneId } } }
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        createdAt: true,
        GameProfile: {
          select: {
            id: true,
            nickname: true,
            zoneId: true,
            WarZone: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  const identities = users.length
    ? await prisma.externalIdentity.findMany({
        where: { provider: 'xiaoying', localUserId: { in: users.map((u) => u.id) } },
        select: { localUserId: true, subject: true, createdAt: true },
      })
    : []
  const identityByUserId = new Map(identities.map((i) => [i.localUserId, i]))

  return NextResponse.json({
    success: true,
    data: users.map((u) => {
      const ident = identityByUserId.get(u.id)
      return {
        id: u.id,
        username: u.username,
        createdAt: u.createdAt.toISOString(),
        nickname: u.GameProfile?.nickname ?? null,
        hasProfile: !!u.GameProfile,
        profileId: u.GameProfile?.id ?? null,
        currentZoneId: u.GameProfile?.zoneId ?? null,
        currentZoneName: u.GameProfile?.WarZone?.name ?? null,
        provider: ident ? 'xiaoying' : 'local',
        externalSubject: ident?.subject ?? null,
        externalBoundAt: ident?.createdAt.toISOString() ?? null,
      }
    }),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
}
