import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { safeQueryRaw } from '@/lib/safeQueryRaw'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

/**
 * 把公共词库单词加入用户生词本（幂等）。
 * 只创建 Word 记录，不更新对错统计、不推进任何每日任务
 * （区别于 /api/dictation/update：那是默写/复习答题上报）。
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { word } = await req.json()

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    const normalizedWord = String(word).toLowerCase().trim()
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 })
    }

    const publicWord = await prisma.publicWord.findUnique({
      where: { word: normalizedWord },
    })

    const existingWords = await safeQueryRaw('vocabularySave', () => prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT id FROM "Word"
      WHERE "userId" = ${session.user.id}
        AND lower("word") = ${normalizedWord}
      LIMIT 1
    `, [] as Record<string, unknown>[])

    if (existingWords.length === 0) {
      try {
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
            correctCount: 0,
            incorrectCount: 0,
            totalAttempts: 0,
            updatedAt: new Date(),
          },
        })
      } catch (err: unknown) {
        // P2002：并发下两条请求同时创建同一单词，视为已存在（幂等）
        if ((err as { code?: string }).code === 'P2002') {
          return NextResponse.json({ success: true })
        }
        throw err
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to save word to vocabulary book: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
