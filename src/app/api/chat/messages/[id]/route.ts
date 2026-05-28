import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { broadcastMessage } from '@/lib/chatSSE'
import { logger } from '@/lib/logger'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '' })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const message = await prisma.chatMessage.update({
      where: { id },
      data: { isDeleted: true },
      include: {
        User: {
          select: {
            id: true,
            username: true,
          }
        }
      }
    })

    broadcastMessage({ ...message, isDeleted: true })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to delete message: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
