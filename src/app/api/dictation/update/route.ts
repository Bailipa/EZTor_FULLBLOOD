import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { safeQueryRaw } from '@/lib/safeQueryRaw'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { gameService } from '@/features/gamification/services/GameService'
import { applyReview, SRS_DEFAULTS } from '@/lib/srs'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { word, isCorrect } = await req.json()

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    const normalizedWord = String(word).toLowerCase().trim()
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    const updateData = isCorrect
      ? { correctCount: { increment: 1 }, totalAttempts: { increment: 1 } }
      : { incorrectCount: { increment: 1 }, totalAttempts: { increment: 1 } }

    const publicWord = await prisma.publicWord.findUnique({
      where: { word: normalizedWord },
    })

    const existingWords = await safeQueryRaw('dictationUpdate', () => prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM "Word"
      WHERE "userId" = ${session.user.id}
        AND lower("word") = ${normalizedWord}
      LIMIT 1
    `, [] as Record<string, unknown>[])

    if (existingWords.length > 0) {
      const w = existingWords[0] as Record<string, unknown>
      const srs = applyReview(
        {
          repetitions: (w.repetitions as number) ?? SRS_DEFAULTS.repetitions,
          intervalDays: (w.intervalDays as number) ?? SRS_DEFAULTS.intervalDays,
          ease: (w.ease as number) ?? SRS_DEFAULTS.ease,
          lapses: (w.lapses as number) ?? SRS_DEFAULTS.lapses,
          dueDate: (w.dueDate as Date) ?? null,
        },
        isCorrect,
      )
      await prisma.word.update({
        where: { id: existingWords[0].id as string },
        data: {
          ...updateData,
          ...srs,
          updatedAt: new Date(),
        },
      })
    } else {
      const srs = applyReview(SRS_DEFAULTS, isCorrect)
      await prisma.word.create({
        data: {
          id: randomUUID(),
          word: String(word).trim(),
          userId: session.user.id,
          sourceType: 'PUBLIC',
          publicWordId: publicWord?.id || null,
          translation: null,
          phonetic: null,
          pos: null,
          example: null,
          exampleTranslation: null,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          totalAttempts: 1,
          ...srs,
          updatedAt: new Date(),
        },
      })
    }

    gameService.reportTaskProgress(session.user.id, 'COMPLETE_REVIEWS', 1).catch(() => {})
    gameService.reportAccuracyTask(session.user.id).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to update dictation stats: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
