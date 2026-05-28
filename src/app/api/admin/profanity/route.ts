import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { addProfanityWord, removeProfanityWord } from '@/lib/profanityFilter'
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

    const words = await prisma.customProfanity.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, data: words })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to fetch profanity words: ${msg}`)
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

    const { word } = await req.json()

    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    const trimmedWord = word.trim()

    const existing = await prisma.customProfanity.findUnique({ where: { word: trimmedWord } })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Word already exists' }, { status: 400 })
    }

    const profanity = await prisma.customProfanity.create({
      data: { word: trimmedWord }
    })

    addProfanityWord(trimmedWord)

    return NextResponse.json({ success: true, data: profanity })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to add profanity word: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
