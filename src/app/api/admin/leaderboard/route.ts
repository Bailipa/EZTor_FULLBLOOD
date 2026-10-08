import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'

async function isAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })

  return user?.isAdmin === true
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 })
  }

  const config = await prisma.appFeatureConfig.findUnique({
    where: { id: 'global' },
    select: { leaderboardEnabled: true },
  })

  return NextResponse.json({
    success: true,
    data: { leaderboardEnabled: config?.leaderboardEnabled ?? true },
  })
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ success: false, error: '需要管理员权限' }, { status: 403 })
  }

  const body = await request.json()
  if (typeof body.leaderboardEnabled !== 'boolean') {
    return NextResponse.json({ success: false, error: '无效的排行榜开关状态' }, { status: 400 })
  }

  const config = await prisma.appFeatureConfig.upsert({
    where: { id: 'global' },
    update: { leaderboardEnabled: body.leaderboardEnabled },
    create: { id: 'global', leaderboardEnabled: body.leaderboardEnabled, updatedAt: new Date() },
    select: { leaderboardEnabled: true },
  })

  return NextResponse.json({ success: true, data: config })
}
