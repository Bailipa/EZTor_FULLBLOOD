import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50
    const cursor = searchParams.get('cursor')
    const where = { userId: session.user.id, incorrectCount: { gt: 0 } }

    const [words, total] = await Promise.all([
      prisma.word.findMany({
        where,
        orderBy: [{ incorrectCount: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          publicWord: {
            select: {
              phonetic: true,
              pos: true,
              translation: true,
              example: true,
            },
          },
        },
      }),
      prisma.word.count({ where }),
    ])

    const hasMore = words.length > limit
    const pageWords = hasMore ? words.slice(0, -1) : words
    const data = pageWords.map((word) => ({
      id: word.id,
      word: word.word,
      phonetic: word.phonetic ?? word.publicWord?.phonetic ?? null,
      pos: word.pos ?? word.publicWord?.pos ?? null,
      translation: word.translation ?? word.publicWord?.translation ?? '',
      example: word.example ?? word.publicWord?.example ?? null,
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      updatedAt: word.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        hasMore,
        nextCursor: hasMore ? pageWords[pageWords.length - 1].id : null,
      },
    })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to fetch dictation mistakes:')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch mistake words' },
      { status: 500 },
    )
  }
}
