import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { checkCsrfHeader } from '@/lib/csrf'

/** Add a public word to the user's private library and optionally a review group. */
export async function POST(req: Request) {
  try {
    const csrf = checkCsrfHeader(req)
    if (!csrf.valid) {
      return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { word, targetGroupId } = await req.json()
    const normalizedWord = String(word || '').trim().toLowerCase()
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    const publicWord = await prisma.publicWord.findUnique({ where: { word: normalizedWord } })
    if (!publicWord) {
      return NextResponse.json({ success: false, error: 'Public word not found' }, { status: 404 })
    }

    if (targetGroupId) {
      const group = await prisma.reviewGroup.findUnique({
        where: { id: targetGroupId },
        select: { userId: true },
      })
      if (!group || group.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: 'Invalid target group' }, { status: 400 })
      }
    }

    const savedWord = await prisma.$transaction(async (tx) => {
      const saved = await tx.word.upsert({
        where: { word_userId: { word: normalizedWord, userId: session.user.id } },
        update: { publicWordId: publicWord.id, sourceType: 'PUBLIC', updatedAt: new Date() },
        create: {
          id: randomUUID(),
          word: normalizedWord,
          userId: session.user.id,
          sourceType: 'PUBLIC',
          publicWordId: publicWord.id,
          translation: null,
          phonetic: null,
          pos: null,
          example: null,
          exampleTranslation: null,
          correctCount: 0,
          incorrectCount: 0,
          totalAttempts: 0,
          updatedAt: new Date(),
        },
      })

      if (targetGroupId) {
        await tx.reviewGroupWord.createMany({
          data: [{ id: randomUUID(), reviewGroupId: targetGroupId, wordId: saved.id }],
          skipDuplicates: true,
        })
      }
      return saved
    })

    return NextResponse.json({ success: true, exists: true, wordId: savedWord.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to save word to vocabulary book: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
