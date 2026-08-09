import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { logger } from '@/lib/logger'
import { safeQueryRaw } from '@/lib/safeQueryRaw'

export const dynamic = 'force-dynamic' // 禁止缓存，每次获取最新的随机数据

async function fetchPublicWords(limit: number) {
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
  return publicWords
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    const { searchParams } = new URL(req.url)
    // 默认取 20 条，最多 50 条
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20
    // dryRun=1：只判断词库是否有词（弹幕开关的 hasWords 检查），不标记"已展示"，
    // 避免未真正显示的词被吞掉系统性遍历的轮次。
    const dryRun = searchParams.get('dryRun') === '1'

    // 未登录：降级返回公共词池（游客/系统托盘/快捷键也能开弹幕），
    // 而不是 401 —— 否则退出登录后悬浮层拉词失败、屏幕突然变空。
    if (!session?.user?.id) {
      const publicWords = await fetchPublicWords(limit)
      return NextResponse.json({ success: true, data: publicWords })
    }

    // 获取用户词库中所有单词的总数
    const totalCount = await prisma.word.count({
      where: { userId: session.user.id },
    })

    if (totalCount === 0) {
      // 用户无词时，从公共词池取随机词（用于干扰项等场景）
      const publicWords = await fetchPublicWords(limit)
      return NextResponse.json({ success: true, data: publicWords })
    }

    // 系统性遍历全库：每词记录最近展示的轮次（Word.danmakuCycle），
    // 用户记录当前轮次（User.danmakuCycle）。每次只在"本周期未展示过"的池里
    // 随机取一窗；本周期全部展示完后轮次 +1（danmakuCycle < 新轮次 的词自动重新可用，
    // 无需清表）。保证覆盖完整私人词库、周期内不重复。
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { danmakuCycle: true },
    })
    let cycle = user?.danmakuCycle ?? 1

    let eligibleCount = await prisma.word.count({
      where: { userId: session.user.id, danmakuCycle: { lt: cycle } },
    })
    if (eligibleCount === 0) {
      // 本周期已全部展示 → 进入下一周期，全部词重新可用
      const next = cycle + 1
      await prisma.user.update({
        where: { id: session.user.id },
        data: { danmakuCycle: next },
      })
      cycle = next
      eligibleCount = totalCount
    }

    // 随机 OFFSET 替代 ORDER BY RANDOM()：避免对整张词表排序（12k 词实测 <5ms）。
    // skip 上限取 eligibleCount - limit，保证窗口完整落池内（避免边缘批次变短）。
    const maxSkip = Math.max(0, eligibleCount - limit)
    const skip = eligibleCount > limit ? Math.floor(Math.random() * (maxSkip + 1)) : 0
    const randomWords: {
      id: string
      word: string
      translation: string
      phonetic: string
      example: string
    }[] = await safeQueryRaw('danmaku', () => prisma.$queryRaw`
      SELECT
        w.id,
        w.word,
        COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
        COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
        COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example
      FROM "Word" w
      LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
      WHERE w."userId" = ${session.user.id}
        AND w."danmakuCycle" < ${cycle}
      OFFSET ${skip}
      LIMIT ${limit}
    `, [] as { id: string; word: string; translation: string; phonetic: string; example: string }[])

    // 标记本批已展示（进入本周期已展示集，周期内不再重复）
    // dryRun（hasWords 检查）不标记，避免吞词。
    if (!dryRun && randomWords.length > 0) {
      try {
        await prisma.word.updateMany({
          where: { id: { in: randomWords.map((w) => w.id) } },
          data: { danmakuCycle: cycle },
        })
      } catch {
        // 标记失败只影响去重，不阻断取词
      }
    }

    // 词库真的不足 limit（词很少）时，才从公共词池补充；
    // 周期末剩余不足 limit 时保持短批，不混入公共词，保证"遍历私人词库"语义。
    if (randomWords.length < limit && totalCount < limit) {
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
      // 公共补位词没有私人词库 id（标记发生在补位之前，不会被误标为已展示）
      randomWords.push(...supplements.map((w) => ({ ...w, id: '' })))
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
