import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]/route'
import { logger } from '@/lib/logger'
import { safeQueryRaw } from '@/lib/safeQueryRaw'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')
    const groupId = searchParams.get('groupId')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20

    let words

    if (groupId) {
      // 需要登录才能访问特定分组
      if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

      // Verify group ownership and fetch words from specific group
      const group = await prisma.reviewGroup.findUnique({
        where: { id: groupId },
      })

      if (!group || group.userId !== userId) {
        return NextResponse.json(
          { success: false, error: 'Group not found or unauthorized' },
          { status: 404 },
        )
      }

      // Fetch words from the specific Review Group
      // SRS 调度：到期/超期词优先（最老到期在前），未到期的按随机填充
      words = await safeQueryRaw('flashcard_group', () => prisma.$queryRaw`
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
          w."dueDate",
          w."updatedAt"
        FROM "Word" w
        JOIN "ReviewGroupWord" rgw ON w.id = rgw."wordId"
        LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
        WHERE rgw."reviewGroupId" = ${groupId}
        ORDER BY
          CASE WHEN w."dueDate" IS NULL OR w."dueDate" <= NOW() THEN 0 ELSE 1 END,
          w."dueDate" ASC NULLS FIRST,
          RANDOM()
        LIMIT ${limit}
      `, [] as Record<string, unknown>[])
    } else {
      // 游客也可以访问公共词库
      words = await safeQueryRaw('flashcard_public', () => prisma.$queryRaw`
        SELECT * FROM "PublicWord" 
        OFFSET floor(random() * (SELECT count(*) FROM "PublicWord")) 
        LIMIT ${limit}
      `, [] as Record<string, unknown>[])
    }

    return NextResponse.json({ success: true, data: words })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to fetch public flashcard words:')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flashcard data' },
      { status: 500 },
    )
  }
}
