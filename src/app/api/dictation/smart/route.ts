import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { safeQueryRaw } from '@/lib/safeQueryRaw'

const SMART_WORDS_QUERY = (userId: string, groupId: string, limit: number) => prisma.$queryRaw<Record<string, unknown>[]>`
  SELECT
    w.id,
    w.word,
    COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
    COALESCE(NULLIF(TRIM(w.pos), ''), pw.pos, '') AS pos,
    COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
    COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example,
    COALESCE(NULLIF(TRIM(w."exampleTranslation"), ''), pw."exampleTranslation", '') AS exampleTranslation,
    w."correctCount",
    w."incorrectCount",
    w."totalAttempts",
    w."updatedAt"
  FROM "Word" w
  JOIN "ReviewGroupWord" rgw ON w.id = rgw."wordId"
  LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
  WHERE w."userId" = ${userId}
    AND rgw."reviewGroupId" = ${groupId}
  ORDER BY
    w."totalAttempts" ASC,
    CASE WHEN w."totalAttempts" = 0 THEN 0
         ELSE CAST(w."incorrectCount" AS FLOAT) / w."totalAttempts"
    END DESC,
    RANDOM()
  LIMIT ${limit}
`

const ALL_WORDS_QUERY = (userId: string, limit: number) => prisma.$queryRaw<Record<string, unknown>[]>`
  SELECT
    w.id,
    w.word,
    COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
    COALESCE(NULLIF(TRIM(w.pos), ''), pw.pos, '') AS pos,
    COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
    COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example,
    COALESCE(NULLIF(TRIM(w."exampleTranslation"), ''), pw."exampleTranslation", '') AS exampleTranslation,
    w."correctCount",
    w."incorrectCount",
    w."totalAttempts",
    w."updatedAt"
  FROM "Word" w
  LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
  WHERE w."userId" = ${userId}
  ORDER BY
    w."totalAttempts" ASC,
    CASE WHEN w."totalAttempts" = 0 THEN 0
         ELSE CAST(w."incorrectCount" AS FLOAT) / w."totalAttempts"
    END DESC,
    RANDOM()
  LIMIT ${limit}
`
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')
    const groupId = searchParams.get('groupId')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20

    if (groupId && groupId !== 'all') {
      const group = await prisma.reviewGroup.findUnique({
        where: { id: groupId },
      })
      if (!group || group.userId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Group not found or unauthorized' },
          { status: 404 },
        )
      }

      const smartWords = await safeQueryRaw('dictationSmart_group', () => SMART_WORDS_QUERY(session.user.id, groupId, limit), [] as Record<string, unknown>[])

      return NextResponse.json({ success: true, data: smartWords })
    }

    const smartWords = await safeQueryRaw('dictationSmart_all', () => ALL_WORDS_QUERY(session.user.id, limit), [] as Record<string, unknown>[])

    return NextResponse.json({ success: true, data: smartWords })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to fetch smart dictation words:')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch smart data' },
      { status: 500 },
    )
  }
}
