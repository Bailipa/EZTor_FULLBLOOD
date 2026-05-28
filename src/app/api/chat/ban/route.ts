import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '' })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const bans = await prisma.chatBan.findMany({
      include: {
        User: {
          select: {
            id: true,
            username: true,
          }
        }
      },
      orderBy: { bannedAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: bans })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to fetch bans: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '' })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { userId, reason } = await req.json()

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
    }

    const existingBan = await prisma.chatBan.findUnique({ where: { userId } })
    if (existingBan) {
      return NextResponse.json({ success: false, error: 'User is already banned' }, { status: 400 })
    }

    const ban = await prisma.chatBan.create({
      data: {
        userId,
        reason,
        bannedBy: session.user.id,
      },
      include: {
        User: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    })

    await prisma.chatMessage.updateMany({
      where: { userId },
      data: { isHidden: true }
    })

    return NextResponse.json({ success: true, data: ban })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to ban user: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
