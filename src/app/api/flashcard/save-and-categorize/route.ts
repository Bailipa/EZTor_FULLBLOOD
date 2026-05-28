import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { safeQueryRaw } from '@/lib/safeQueryRaw'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

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

    // 1. 创建或更新 Word 记录
    const updateData = isCorrect
      ? { correctCount: { increment: 1 }, totalAttempts: { increment: 1 } }
      : { incorrectCount: { increment: 1 }, totalAttempts: { increment: 1 } }

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
      await prisma.word.update({
        where: { id: existingWords[0].id as string },
        data: {
          ...updateData,
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
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          totalAttempts: 1,
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

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to save and categorize word: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
