import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { logger } from '@/lib/logger'

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const result = await prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: oneDayAgo } }
    })

    return NextResponse.json({ success: true, deletedCount: result.count })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to clear messages: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
