import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { removeProfanityWord } from '@/lib/profanityFilter'
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

    if (!isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const profanity = await prisma.customProfanity.delete({ where: { id } })

    removeProfanityWord(profanity.word)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to delete profanity word: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
