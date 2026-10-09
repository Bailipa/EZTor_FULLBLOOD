import { getClientIp } from '@/lib/onlineTracker'
import { after, NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { sanitizeWordList } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const clientIp = getClientIp(req)
  const userAgent = req.headers.get('user-agent') || 'unknown'
  const sessionId =
    req.headers.get('x-session-id')?.trim().slice(0, 128) ||
    req.cookies.get('eztor_analytics_session')?.value?.trim().slice(0, 128) ||
    randomUUID()

  const withSessionCookie = (response: NextResponse) => {
    if (!req.cookies.get('eztor_analytics_session')) {
      response.cookies.set('eztor_analytics_session', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 60,
        path: '/',
      })
    }
    return response
  }

  try {
    const rateLimitKey = `public:${clientIp}`
    const rateLimitResult = await rateLimit(rateLimitKey)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    const body = await req.json()
    const { words } = body

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words list is required' }, { status: 400 })
    }

    const sanitizedWords = sanitizeWordList(words)
    if (sanitizedWords.length === 0) {
      return NextResponse.json({ error: 'Invalid words list' }, { status: 400 })
    }
    if (sanitizedWords.length > 50) {
      return NextResponse.json({ error: '每批词库查询最多支持 50 个单词，请拆分后重试' }, { status: 400 })
    }

    const results = await prisma.publicWord.findMany({
      where: {
        word: {
          in: sanitizedWords.map((w) => w.toLowerCase()),
        },
      },
      select: {
        word: true,
        phonetic: true,
        pos: true,
        translation: true,
        example: true,
        exampleTranslation: true,
        qualityScore: true,
      },
    })

    const foundWords = new Set(results.map((r: { word: string }) => r.word))
    const notFound = sanitizedWords.filter((w) => !foundWords.has(w.toLowerCase()))

    const responseTime = Date.now() - startTime

    after(async () => {
      try {
        await prisma.analyticsEvent.create({
          data: {
            id: randomUUID(),
            eventType: 'GUEST_TRANSLATE',
            userId: null,
            sessionId,
            metadata: JSON.stringify({
              totalWords: sanitizedWords.length,
              foundWords: results.length,
              notFoundWords: notFound.length,
              responseTime,
            }),
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })

        if (results.length) {
          await prisma.translationRecord.createMany({
            data: results.map((result) => ({
              ...result,
              id: randomUUID(),
              isCached: true,
              responseTime,
              ipAddress: clientIp,
              userAgent,
            })),
          })
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to record public translation activity')
      }
    })

    return withSessionCookie(NextResponse.json({
      success: true,
      data: {
        results: results.map(
          (r: {
            word: string
            phonetic: string | null
            pos: string | null
            translation: string
            example: string | null
            exampleTranslation: string | null
          }) => ({
            word: r.word,
            phonetic: r.phonetic,
            pos: r.pos,
            translation: r.translation,
            example: r.example,
            exampleTranslation: r.exampleTranslation,
            isPublic: true,
          }),
        ),
        notFound,
        isGuestMode: true,
      },
    }))
  } catch (error) {
    logger.error({ err: error }, 'Public translate error')

    after(async () => {
      try {
        await prisma.analyticsEvent.create({
          data: {
            id: randomUUID(),
            eventType: 'GUEST_TRANSLATE_ERROR',
            userId: null,
            sessionId,
            metadata: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              responseTime: Date.now() - startTime,
            }),
            ipAddress: clientIp,
            userAgent: userAgent,
          },
        })
      } catch (recordError) {
        logger.error({ err: recordError }, 'Failed to record public translation error')
      }
    })

    return withSessionCookie(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
