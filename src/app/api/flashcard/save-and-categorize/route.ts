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

    const { word, category, isCorrect } = await req.json()

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    if (!category || !['known', 'unknown'].includes(category)) {
      return NextResponse.json({ success: false, error: 'Category must be "known" or "unknown"' }, { status: 400 })
    }

    const normalizedWord = String(word).toLowerCase().trim()
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    // 闪卡判定 "认识/不认识" 即一次 SRS 复习：known → 答对，unknown → 答错
    const judgedCorrect = category === 'known' && isCorrect !== false
    const srs = applyReview(SRS_DEFAULTS, judgedCorrect)

    // 1. 创建或更新 Word 记录（闪卡只更新totalAttempts，不更新正确/错误统计）
    const updateData = { totalAttempts: { increment: 1 } }

    const publicWord = await prisma.publicWord.findUnique({
      where: { word: normalizedWord },
    })

    const existingWords = await safeQueryRaw('saveAndCategorize', () => prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM "Word"
      WHERE "userId" = ${session.user.id}
        AND lower("word") = ${normalizedWord}
      LIMIT 1
    `, [] as Record<string, unknown>[])

    let wordId: string

    if (existingWords.length > 0) {
      const w = existingWords[0] as Record<string, unknown>
      const mergedSrs = applyReview(
        {
          repetitions: (w.repetitions as number) ?? SRS_DEFAULTS.repetitions,
          intervalDays: (w.intervalDays as number) ?? SRS_DEFAULTS.intervalDays,
          ease: (w.ease as number) ?? SRS_DEFAULTS.ease,
          lapses: (w.lapses as number) ?? SRS_DEFAULTS.lapses,
          dueDate: (w.dueDate as Date) ?? null,
        },
        judgedCorrect,
      )
      await prisma.word.update({
        where: { id: existingWords[0].id as string },
        data: {
          ...updateData,
          ...mergedSrs,
          updatedAt: new Date(),
        },
      })
      wordId = existingWords[0].id as string
    } else {
      const newWord = await prisma.word.create({
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
          correctCount: 0,
          incorrectCount: 0,
          totalAttempts: 1,
          ...srs,
          updatedAt: new Date(),
        },
      })
      wordId = newWord.id
    }

    // 2. 查找或创建系统分组
    const systemGroupName = category === 'known' ? '_known_words' : '_unknown_words'
    
    let systemGroup = await prisma.reviewGroup.findFirst({
      where: {
        userId: session.user.id,
        name: systemGroupName,
        isSystem: true
      }
    })

    if (!systemGroup) {
      systemGroup = await prisma.reviewGroup.create({
        data: {
          id: randomUUID(),
          name: systemGroupName,
          userId: session.user.id,
          isSystem: true,
          updatedAt: new Date()
        }
      })
    }

    // 3. 将单词添加到系统分组（如果不存在）
    const existingLink = await prisma.reviewGroupWord.findFirst({
      where: {
        reviewGroupId: systemGroup.id,
        wordId: wordId
      }
    })

    if (!existingLink) {
      await prisma.reviewGroupWord.create({
        data: {
          id: randomUUID(),
          reviewGroupId: systemGroup.id,
          wordId: wordId,
        }
      })
    }

    gameService.reportTaskProgress(session.user.id, 'FLASHCARD_INTERACT', 1).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to save and categorize word: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
