import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { checkCsrfHeader } from '@/lib/csrf'
import { logger } from '@/lib/logger'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = checkCsrfHeader(req)
    if (!csrf.valid) {
      return NextResponse.json(
        { success: false, error: csrf.reason || 'Invalid origin' },
        { status: 403 },
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await req.json()
    const wordIds = body.wordIds
    const words = body.words
    const pattern = body.pattern

    // 支持三种模式：
    // - wordIds: 用户生词本里已有的私有 Word 行 id（原有逻辑）
    // - words: 公共词库的单词原文列表（AI 确认加词用），服务端校验真实性后 mirror 写入
    // - pattern: {mode, value} 按模式重查公共词库并加入全部匹配（AI"全部加入"用）
    if (
      (!wordIds || !Array.isArray(wordIds)) &&
      (!words || !Array.isArray(words)) &&
      (!pattern || typeof pattern !== 'object')
    ) {
      return NextResponse.json(
        { success: false, error: 'wordIds, words or pattern is required' },
        { status: 400 },
      )
    }

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
      include: {
        _count: { select: { ReviewGroupWord: true } },
      },
    })

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Group not found or unauthorized' },
        { status: 404 },
      )
    }

    // 模式一：按私有 Word id 链接（原逻辑）
    if (Array.isArray(wordIds) && wordIds.length > 0) {
      const validWords = await prisma.word.findMany({
        where: {
          id: { in: wordIds },
          userId: session.user.id,
        },
        select: { id: true },
      })

      const validWordIds = new Set(validWords.map((w) => w.id))

      const existingLinks = await prisma.reviewGroupWord.findMany({
        where: {
          reviewGroupId: id,
          wordId: { in: wordIds },
        },
        select: { wordId: true },
      })

      const existingWordIds = new Set(existingLinks.map((l) => l.wordId))

      const newWordIds = wordIds.filter(
        (wid: string) => validWordIds.has(wid) && !existingWordIds.has(wid),
      )

      if (newWordIds.length > 0) {
        await prisma.reviewGroupWord.createMany({
          data: newWordIds.map((wordId: string) => ({
            id: crypto.randomUUID(),
            reviewGroupId: id,
            wordId,
          })),
        })
      }

      return NextResponse.json({ success: true, addedCount: newWordIds.length })
    }

    // 模式二/三：按公共词库原文加词（AI 确认加词用），单次上限 500；
    // 支持 words 列表 或 pattern {mode, value} 按模式重查全部匹配（"全部加入"用）
    const MAX_BATCH_TOTAL = 2000
    const MAX_BATCH_WORDS = 500

    let cleanWords: string[] = []
    let patternMode = ''

    if (Array.isArray(words) && words.length > 0) {
      cleanWords = (words as string[])
        .map((w) => String(w).trim().toLowerCase())
        .filter((w) => w.length > 0 && w.length <= 500)
        .slice(0, MAX_BATCH_WORDS)
    } else if (pattern && typeof pattern === 'object') {
      const p = pattern as { mode?: string; value?: string }
      const mode = p.mode
      const value = String(p.value ?? '').trim().toLowerCase()
      if (!['ends_with', 'starts_with', 'contains'].includes(mode ?? '') || !value || value.length > 30) {
        return NextResponse.json({ success: false, error: '无效的搜索模式' }, { status: 400 })
      }
      patternMode = mode as string
      const wordFilter =
        patternMode === 'ends_with'
          ? { endsWith: value }
          : patternMode === 'starts_with'
            ? { startsWith: value }
            : { contains: value }
      const rows = await prisma.publicWord.findMany({
        where: { word: { ...wordFilter, mode: 'insensitive' } },
        orderBy: { word: 'asc' },
        take: MAX_BATCH_TOTAL,
        select: { word: true },
      })
      cleanWords = rows.map((r) => r.word.toLowerCase())
    }

    if (cleanWords.length === 0) {
      return NextResponse.json({ success: false, error: '无效的单词列表' }, { status: 400 })
    }

    const publicWords = await prisma.publicWord.findMany({
      where: { word: { in: cleanWords, mode: 'insensitive' } },
      select: { id: true, word: true },
    })
    const foundMap = new Map(publicWords.map((p) => [p.word.toLowerCase(), p.id]))
    const validList = cleanWords.filter((w) => foundMap.has(w))
    const notFound = patternMode ? [] : cleanWords.filter((w) => !foundMap.has(w))

    if (validList.length === 0) {
      return NextResponse.json({
        success: true,
        addedCount: 0,
        skippedDuplicates: 0,
        notFound,
      })
    }

    // mirror 模式：为每个公共词 upsert 私有 Word 行（sourceType=PUBLIC，释义字段留 NULL）
    const privateIds: string[] = []
    for (const w of validList) {
      const publicWordId = foundMap.get(w)!
      const row = await prisma.word
        .upsert({
          where: { word_userId: { word: w, userId: session.user.id } },
          update: { publicWordId, updatedAt: new Date() },
          create: {
            id: crypto.randomUUID(),
            word: w,
            translation: null,
            phonetic: null,
            pos: null,
            example: null,
            exampleTranslation: null,
            userId: session.user.id,
            sourceType: 'PUBLIC',
            publicWordId,
            updatedAt: new Date(),
          },
        })
        .catch(() => null)
      if (row) privateIds.push(row.id)
    }

    const existingLinks = await prisma.reviewGroupWord.findMany({
      where: { reviewGroupId: id, wordId: { in: privateIds } },
      select: { wordId: true },
    })
    const existingWordIds = new Set(existingLinks.map((l) => l.wordId))
    const toAdd = privateIds.filter((wid) => !existingWordIds.has(wid))
    const skippedDuplicates = privateIds.length - toAdd.length

    if (toAdd.length > 0) {
      await prisma.reviewGroupWord.createMany({
        data: toAdd.map((wordId: string) => ({
          id: crypto.randomUUID(),
          reviewGroupId: id,
          wordId,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      addedCount: toAdd.length,
      skippedDuplicates,
      notFound,
    })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to add words to group:')
    return NextResponse.json({ success: false, error: 'Failed to add words' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = checkCsrfHeader(req)
    if (!csrf.valid) {
      return NextResponse.json(
        { success: false, error: csrf.reason || 'Invalid origin' },
        { status: 403 },
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const wordId = searchParams.get('wordId')

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
    })

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Group not found or unauthorized' },
        { status: 404 },
      )
    }

    if (action === 'clear_all') {
      await prisma.reviewGroupWord.deleteMany({
        where: { reviewGroupId: id },
      })
      return NextResponse.json({ success: true, message: 'Group cleared' })
    }

    if (action === 'batch') {
      const body = await req.json()
      const wordIds = body.wordIds
      if (Array.isArray(wordIds) && wordIds.length > 0) {
        await prisma.reviewGroupWord.deleteMany({
          where: {
            reviewGroupId: id,
            wordId: { in: wordIds },
          },
        })
        return NextResponse.json({ success: true, message: 'Words removed from group' })
      }
      return NextResponse.json({ success: false, error: 'Invalid wordIds array' }, { status: 400 })
    }

    if (wordId) {
      await prisma.reviewGroupWord.deleteMany({
        where: {
          reviewGroupId: id,
          wordId: wordId,
        },
      })
      return NextResponse.json({ success: true, message: 'Word removed from group' })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to remove words from group:')
    return NextResponse.json({ success: false, error: 'Failed to remove words' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')
    const cursorParam = searchParams.get('cursor')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
    })

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Group not found or unauthorized' },
        { status: 404 },
      )
    }

    const where = { reviewGroupId: id }

    const [groupWords, total] = await Promise.all([
      prisma.reviewGroupWord.findMany({
        where,
        include: {
          Word: {
            include: {
              publicWord: {
                select: {
                  phonetic: true,
                  pos: true,
                  translation: true,
                  example: true,
                  exampleTranslation: true,
                },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
        take: limit + 1,
        ...(cursorParam ? { cursor: { id: cursorParam }, skip: 1 } : {}),
      }),
      prisma.reviewGroupWord.count({ where }),
    ])

    const hasMore = groupWords.length > limit
    const data = hasMore ? groupWords.slice(0, -1) : groupWords
    const nextCursor = hasMore ? data[data.length - 1].id : null
    const words = data.map((gw) => ({
      id: gw.Word.id,
      word: gw.Word.word,
      phonetic: gw.Word.phonetic ?? gw.Word.publicWord?.phonetic ?? null,
      pos: gw.Word.pos ?? gw.Word.publicWord?.pos ?? null,
      translation: gw.Word.translation ?? gw.Word.publicWord?.translation ?? '',
      example: gw.Word.example ?? gw.Word.publicWord?.example ?? null,
      exampleTranslation:
        gw.Word.exampleTranslation ?? gw.Word.publicWord?.exampleTranslation ?? null,
      correctCount: gw.Word.correctCount,
      incorrectCount: gw.Word.incorrectCount,
      updatedAt: gw.Word.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data: words,
      pagination: { total, hasMore, nextCursor },
    })
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to fetch group words:')
    return NextResponse.json({ success: false, error: 'Failed to fetch words' }, { status: 500 })
  }
}
