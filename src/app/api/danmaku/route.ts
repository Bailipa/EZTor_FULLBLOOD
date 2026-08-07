import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { logger } from '@/lib/logger'
import { safeQueryRaw } from '@/lib/safeQueryRaw'

export const dynamic = 'force-dynamic' // 禁止缓存，每次获取最新的随机数据

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    // 默认取 20 条，最多 50 条
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20

    // 获取用户词库中所有单词的总数
    const count = await prisma.word.count({
      where: { userId: session.user.id },
    })

    if (count === 0) {
      // 用户无词时，从公共词池取随机词（用于干扰项等场景）
      const publicWords: { word: string; translation: string; phonetic: string; example: string }[] =
        await safeQueryRaw('danmaku_public', () => prisma.$queryRaw`
        SELECT
          word,
          translation,
          phonetic,
          example
        FROM "PublicWord"
        OFFSET floor(random() * (SELECT count(*) FROM "PublicWord"))
        LIMIT ${limit}
      `, [] as { word: string; translation: string; phonetic: string; example: string }[])
      return NextResponse.json({ success: true, data: publicWords })
    }

    // 从用户词库取随机词。
    // 用随机 OFFSET 替代 ORDER BY RANDOM()：避免对整张词表排序，
    // 词量越大收益越明显（12k 词下实测约 200ms -> <5ms）。
    const skip = Math.floor(Math.random() * count)
    const randomWords: { word: string; translation: string; phonetic: string; example: string }[] =
      await safeQueryRaw('danmaku', () => prisma.$queryRaw`
      SELECT
        w.word,
        COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
        COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
        COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example
      FROM "Word" w
      LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
      WHERE w."userId" = ${session.user.id}
      OFFSET ${skip}
      LIMIT ${limit}
    `, [] as { word: string; translation: string; phonetic: string; example: string }[])

    // 用户词数不足时，从公共词池补充（用于干扰项等场景）
    if (randomWords.length < limit) {
      const existingWords = new Set(randomWords.map((w: { word: string }) => w.word.toLowerCase()))
      const need = limit - randomWords.length
      const publicWords: { word: string; translation: string; phonetic: string; example: string }[] =
        await safeQueryRaw('danmaku_supplement', () => prisma.$queryRaw`
        SELECT
          word,
          translation,
          phonetic,
          example
        FROM "PublicWord"
        OFFSET floor(random() * (SELECT count(*) FROM "PublicWord"))
        LIMIT ${need + existingWords.size}
      `, [] as { word: string; translation: string; phonetic: string; example: string }[])
      const supplements = publicWords
        .filter((w: { word: string }) => !existingWords.has(w.word.toLowerCase()))
        .slice(0, need)
      randomWords.push(...supplements)
    }

    return NextResponse.json({ success: true, data: randomWords })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to fetch danmaku words:')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch danmaku data' },
      { status: 500 },
    )
  }
}
