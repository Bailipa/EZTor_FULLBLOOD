import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: profileId } = await params
  const body = await req.json()

  const profile = await prisma.userGameProfile.findUnique({
    where: { id: profileId },
    select: { id: true, userId: true, zoneId: true },
  })
  if (!profile) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
  }

  const allowedFields = [
    'nickname', 'combatPower', 'monthlyPower', 'weeklyPower',
    'dailyPowerGained', 'dailyPowerCap', 'currentStreak', 'longestStreak',
    'zoneTitle', 'unlockedFeatures', 'lastActiveDate',
  ]

  const data: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field]
    }
  }

  if (body.zoneId !== undefined) {
    const newZoneId = body.zoneId || null
    if (newZoneId !== profile.zoneId) {
      const ops = []

      if (profile.zoneId) {
        ops.push(
          prisma.warZone.update({
            where: { id: profile.zoneId },
            data: { memberCount: { decrement: 1 } },
          }),
        )
      }

      if (newZoneId) {
        const targetZone = await prisma.warZone.findUnique({
          where: { id: newZoneId },
          select: { id: true },
        })
        if (!targetZone) {
          return NextResponse.json({ success: false, error: '目标学区不存在' }, { status: 400 })
        }
        ops.push(
          prisma.warZone.update({
            where: { id: newZoneId },
            data: { memberCount: { increment: 1 } },
          }),
        )
      }

      data.zoneId = newZoneId

      await prisma.$transaction(ops)
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: '没有要修改的字段' }, { status: 400 })
  }

  await prisma.userGameProfile.update({
    where: { id: profileId },
    data,
  })

  return NextResponse.json({ success: true })
}
