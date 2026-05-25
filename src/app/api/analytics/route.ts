import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]/route'
import { logger } from '@/lib/logger'

export type EventType =
  | 'PAGE_VIEW'
  | 'TRANSLATE'
  | 'TRANSLATE_ONLY'
  | 'DICTATION_START'
  | 'DICTATION_COMPLETE'
  | 'DICTATION_ERROR'
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'SHARE'
  | 'ERROR'
  | 'API_ERROR'
  | 'GUEST_TRANSLATE'
  | 'GUEST_TRANSLATE_ERROR'

interface TrackEventBody {
  eventType: EventType | string
  metadata?: Record<string, unknown>
}

const EXCLUDED_USERNAMES = ['creator', 'tester']

function parseMetadataObject(
  metadata: string | object | null | undefined,
): Record<string, unknown> {
  if (!metadata) return {}
  if (typeof metadata === 'object') return metadata as Record<string, unknown>
  try {
    return JSON.parse(metadata)
  } catch (error) {
    logger.debug({ err: error }, 'Failed to parse metadata object')
    return {}
  }
}

function parseMetadataForResponse(
  metadata: string | object | null | undefined,
): Record<string, unknown> {
  if (!metadata) return {}
  if (typeof metadata === 'object') return metadata as Record<string, unknown>
  try {
    return JSON.parse(metadata)
  } catch (error) {
    logger.debug({ err: error }, 'Failed to parse metadata for response')
    return {}
  }
}

async function safePrismaQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: error, step: label, details: message }, `Analytics query ${label} failed`)
    return fallback
  }
}

export async function POST(req: Request) {
  try {
    const body: TrackEventBody = await req.json()
    const { eventType, metadata } = body

    if (!eventType) {
      return NextResponse.json({ success: false, error: 'Event type is required' }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const sessionId = req.headers.get('x-session-id') || null

    const event = await prisma.analyticsEvent.create({
      data: {
        id: randomUUID(),
        eventType: eventType as string,
        userId,
        sessionId,
        metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata || null,
        ipAddress,
        userAgent,
      },
    })

    return NextResponse.json({ success: true, data: { id: event.id } })
  } catch (error) {
    logger.error({ err: error }, 'Analytics track error')
    return NextResponse.json({ success: false, error: 'Failed to track event' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7d'
    const excludeTestUsers = searchParams.get('excludeTestUsers') !== 'false'

    const now = new Date()
    let startDate: Date

    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // STEP 0: get excluded users
    const excludedUsers = excludeTestUsers
      ? await safePrismaQuery('excludedUsers', () =>
          prisma.user.findMany({
            where: { username: { in: EXCLUDED_USERNAMES } },
            select: { id: true },
          }),
          [] as Array<{ id: string }>,
        )
      : []
    const excludedUserIds = excludedUsers.map((u: { id: string }) => u.id)

    const baseWhere = {
      createdAt: { gte: startDate },
      ...(excludeTestUsers && excludedUserIds.length > 0
        ? { userId: { notIn: excludedUserIds } }
        : {}),
    }

    // STEP 1: overview counts
    const [totalUsers, newUsers] = await safePrismaQuery('overviewCounts', () =>
      Promise.all([
        prisma.user.count({
          where: excludeTestUsers ? { username: { notIn: EXCLUDED_USERNAMES } } : {},
        }),
        prisma.user.count({
          where: {
            createdAt: { gte: startDate },
            ...(excludeTestUsers ? { username: { notIn: EXCLUDED_USERNAMES } } : {}),
          },
        }),
      ]),
      [0, 0] as [number, number],
    )

    const [totalTranslations, totalDictations] = await safePrismaQuery('eventCounts', () =>
      Promise.all([
        prisma.analyticsEvent.count({
          where: { ...baseWhere, eventType: 'TRANSLATE' },
        }),
        prisma.analyticsEvent.count({
          where: { ...baseWhere, eventType: { in: ['DICTATION_START', 'DICTATION_COMPLETE'] } },
        }),
      ]),
      [0, 0] as [number, number],
    )

    // STEP 2: user translate events
    const userTranslateEvents = await safePrismaQuery('userTranslateEvents', () =>
      prisma.analyticsEvent.findMany({
        where: { ...baseWhere, eventType: 'TRANSLATE' },
        select: { metadata: true, createdAt: true, userId: true },
      }),
      [] as Array<{ metadata: string | null; createdAt: Date; userId: string | null }>,
    )

    const userTranslateErrorEvents = await safePrismaQuery('userTranslateErrorEvents', () =>
      prisma.analyticsEvent.findMany({
        where: { ...baseWhere, eventType: { in: ['ERROR', 'API_ERROR'] } },
        select: { metadata: true, createdAt: true },
      }),
      [] as Array<{ metadata: string | null; createdAt: Date }>,
    )

    let totalUserQueries = 0
    let totalUserSuccess = 0
    let totalUserFailed = 0
    const userDailyStats: Record<string, { total: number; success: number; failed: number }> = {}
    const userErrorReasons: Record<string, number> = {}

    userTranslateEvents.forEach(
      (event: { metadata: string | null; createdAt: Date; userId: string | null }) => {
        const metadata = parseMetadataObject(event.metadata)
        const date = event.createdAt.toISOString().split('T')[0]
        const wordCount = typeof metadata.wordCount === 'number' ? metadata.wordCount : 0

        totalUserQueries += wordCount
        totalUserSuccess += wordCount

        if (!userDailyStats[date]) {
          userDailyStats[date] = { total: 0, success: 0, failed: 0 }
        }
        userDailyStats[date].total += wordCount
        userDailyStats[date].success += wordCount
      },
    )

    userTranslateErrorEvents.forEach((event: { metadata: string | null; createdAt: Date }) => {
      const metadata = parseMetadataObject(event.metadata)
      const date = event.createdAt.toISOString().split('T')[0]
      const error = typeof metadata.error === 'string' ? metadata.error : 'Unknown error'

      totalUserFailed += 1
      userErrorReasons[error] = (userErrorReasons[error] || 0) + 1

      if (!userDailyStats[date]) {
        userDailyStats[date] = { total: 0, success: 0, failed: 0 }
      }
      userDailyStats[date].total += 1
      userDailyStats[date].failed += 1
    })

    const userSuccessRate =
      totalUserQueries > 0 ? Math.round((totalUserSuccess / totalUserQueries) * 10000) / 100 : 0

    const userDailyTrend = Object.entries(userDailyStats)
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // STEP 3: guest events
    const guestTranslateEvents = await safePrismaQuery('guestTranslateEvents', () =>
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: startDate }, eventType: 'GUEST_TRANSLATE' },
        select: { metadata: true, createdAt: true },
      }),
      [] as Array<{ metadata: string | null; createdAt: Date }>,
    )

    const guestTranslateErrorEvents = await safePrismaQuery('guestTranslateErrorEvents', () =>
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: startDate }, eventType: 'GUEST_TRANSLATE_ERROR' },
        select: { metadata: true, createdAt: true },
      }),
      [] as Array<{ metadata: string | null; createdAt: Date }>,
    )

    let totalGuestQueries = 0
    let totalGuestFound = 0
    let totalGuestNotFound = 0
    const guestDailyStats: Record<string, { total: number; found: number; notFound: number }> = {}
    const guestErrorReasons: Record<string, number> = {}

    guestTranslateEvents.forEach((event: { metadata: string | null; createdAt: Date }) => {
      const metadata = parseMetadataObject(event.metadata)
      const date = event.createdAt.toISOString().split('T')[0]
      const totalWords = typeof metadata.totalWords === 'number' ? metadata.totalWords : 0
      const foundWords = typeof metadata.foundWords === 'number' ? metadata.foundWords : 0
      const notFoundWords = typeof metadata.notFoundWords === 'number' ? metadata.notFoundWords : 0

      totalGuestQueries += totalWords
      totalGuestFound += foundWords
      totalGuestNotFound += notFoundWords

      if (!guestDailyStats[date]) {
        guestDailyStats[date] = { total: 0, found: 0, notFound: 0 }
      }
      guestDailyStats[date].total += totalWords
      guestDailyStats[date].found += foundWords
      guestDailyStats[date].notFound += notFoundWords
    })

    guestTranslateErrorEvents.forEach((event: { metadata: string | null; createdAt: Date }) => {
      const metadata = parseMetadataObject(event.metadata)
      const error = typeof metadata.error === 'string' ? metadata.error : 'Unknown error'
      guestErrorReasons[error] = (guestErrorReasons[error] || 0) + 1
    })

    const guestSuccessRate =
      totalGuestQueries > 0 ? Math.round((totalGuestFound / totalGuestQueries) * 10000) / 100 : 0

    // STEP 4: top words (raw SQL - prone to failure, use safe wrapper)
    const topWordsRaw = await safePrismaQuery('topWordsRaw', () =>
      prisma.$queryRaw<Array<{ word: string; count: bigint }>>`
        SELECT LOWER("word") as word, COUNT(*)::int as count
        FROM "TranslationRecord"
        WHERE "createdAt" >= ${startDate}
        GROUP BY LOWER("word")
        ORDER BY count DESC
        LIMIT 20
      `,
      [] as Array<{ word: string; count: bigint }>,
    )

    const topWords = (Array.isArray(topWordsRaw) ? topWordsRaw : []).map((row) => ({
      word: row.word,
      count: Number(row.count),
    }))

    // STEP 5: avg response time
    const avgResponseTimeResult = await safePrismaQuery('avgResponseTime', () =>
      prisma.translationRecord.aggregate({
        where: { createdAt: { gte: startDate } },
        _avg: { responseTime: true },
      }),
      { _avg: { responseTime: null } } as { _avg: { responseTime: number | null } },
    )

    const avgResponseTime = avgResponseTimeResult._avg?.responseTime
      ? Math.round(avgResponseTimeResult._avg.responseTime * 100) / 100
      : 0

    // STEP 6: DAU (raw SQL)
    const dauRaw = await safePrismaQuery('dauRaw', () =>
      excludeTestUsers && excludedUserIds.length > 0
        ? prisma.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT DATE("createdAt") as date, COUNT(DISTINCT "userId")::int as count
          FROM "AnalyticsEvent"
          WHERE "createdAt" >= ${startDate}
          AND "userId" IS NOT NULL
          AND "userId" NOT IN (${Prisma.join(excludedUserIds)})
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `
        : prisma.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT DATE("createdAt") as date, COUNT(DISTINCT "userId")::int as count
          FROM "AnalyticsEvent"
          WHERE "createdAt" >= ${startDate}
          AND "userId" IS NOT NULL
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `,
      [] as Array<{ date: string; count: number }>,
    )

    const safeDau = Array.isArray(dauRaw) ? dauRaw : ([] as Array<{ date: string; count: number }>)
    const dau = safeDau.length > 0
      ? Math.round(safeDau.reduce((sum, r) => sum + r.count, 0) / safeDau.length)
      : 0

    // STEP 7: events by type
    const eventsByType = await safePrismaQuery('eventsByType', () =>
      prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: baseWhere,
        _count: true,
      }),
      [] as Array<{ eventType: string; _count: number }>,
    )

    const eventTypeMap: Record<string, number> = {}
    ;(Array.isArray(eventsByType) ? eventsByType : []).forEach(
      (item: { eventType: string; _count: number }) => {
        eventTypeMap[item.eventType] = item._count
      },
    )

    // STEP 8: daily trend (raw SQL)
    const eventsRaw = await safePrismaQuery('dailyTrendRaw', () =>
      excludeTestUsers && excludedUserIds.length > 0
        ? prisma.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT DATE("createdAt") as date, COUNT(*)::int as count
          FROM "AnalyticsEvent"
          WHERE "createdAt" >= ${startDate}
          AND ("userId" NOT IN (${Prisma.join(excludedUserIds)}) OR "userId" IS NULL)
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `
        : prisma.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT DATE("createdAt") as date, COUNT(*)::int as count
          FROM "AnalyticsEvent"
          WHERE "createdAt" >= ${startDate}
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `,
      [] as Array<{ date: string; count: number }>,
    )

    const safeEventsRaw = Array.isArray(eventsRaw) ? eventsRaw : ([] as Array<{ date: string; count: number }>)
    const dailyTrend = safeEventsRaw.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }))

    const guestDailyTrend = Object.entries(guestDailyStats)
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        found: stats.found,
        notFound: stats.notFound,
        successRate: stats.total > 0 ? Math.round((stats.found / stats.total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // STEP 9: recent events
    const recentEventsRaw = await safePrismaQuery('recentEvents', () =>
      prisma.analyticsEvent.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          eventType: true,
          userId: true,
          sessionId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      [] as Array<{
        id: string; eventType: string; userId: string | null; sessionId: string | null;
        metadata: string | null; ipAddress: string | null; userAgent: string | null; createdAt: Date
      }>,
    )

    const userIds = [
      ...new Set(recentEventsRaw.map((e: { userId: string | null }) => e.userId).filter(Boolean)),
    ] as string[]
    const users = userIds.length > 0
      ? await safePrismaQuery('userMap', () =>
          prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true },
          }),
          [] as Array<{ id: string; username: string }>,
        )
      : []
    const userMap = new Map(users.map((u) => [u.id, u.username]))

    const recentEvents = recentEventsRaw.map(
      (event: {
        id: string; eventType: string; userId: string | null; sessionId: string | null;
        metadata: string | null; ipAddress: string | null; userAgent: string | null; createdAt: Date
      }) => ({
        id: event.id,
        eventType: event.eventType,
        userId: event.userId,
        username: event.userId ? userMap.get(event.userId) || 'Unknown' : null,
        sessionId: event.sessionId,
        metadata: parseMetadataForResponse(event.metadata),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        createdAt: event.createdAt.toISOString(),
      }),
    )

    // STEP 10: page view stats (raw SQL)
    const pageViewWhere = excludeTestUsers && excludedUserIds.length > 0
      ? Prisma.sql`WHERE ae."eventType" = 'PAGE_VIEW' AND ae."createdAt" >= ${startDate} AND (ae."userId" NOT IN (${Prisma.join(excludedUserIds)}) OR ae."userId" IS NULL)`
      : Prisma.sql`WHERE ae."eventType" = 'PAGE_VIEW' AND ae."createdAt" >= ${startDate}`

    const topPagesRaw = await safePrismaQuery('topPages', () =>
      prisma.$queryRaw<Array<{ pageName: string; path: string; uniqueVisitors: number; totalViews: number }>>`
        SELECT
          COALESCE(ae."metadata"::json->>'pageName', 'Unknown') as "pageName",
          COALESCE(ae."metadata"::json->>'path', '/') as "path",
          COUNT(DISTINCT COALESCE(ae."userId", ae."sessionId"))::int as "uniqueVisitors",
          COUNT(*)::int as "totalViews"
        FROM "AnalyticsEvent" ae
        ${pageViewWhere}
        GROUP BY ae."metadata"::json->>'pageName', ae."metadata"::json->>'path'
        ORDER BY "uniqueVisitors" DESC
        LIMIT 15
      `,
      [] as Array<{ pageName: string; path: string; uniqueVisitors: number; totalViews: number }>,
    )

    const visitorTrendRaw = await safePrismaQuery('visitorTrend', () =>
      prisma.$queryRaw<Array<{ date: string; uniqueVisitors: number; guestVisitors: number; authenticatedVisitors: number }>>`
        SELECT
          DATE(ae."createdAt")::text as date,
          COUNT(DISTINCT COALESCE(ae."userId", ae."sessionId"))::int as "uniqueVisitors",
          COUNT(DISTINCT CASE WHEN ae."userId" IS NULL THEN ae."sessionId" END)::int as "guestVisitors",
          COUNT(DISTINCT ae."userId")::int as "authenticatedVisitors"
        FROM "AnalyticsEvent" ae
        ${pageViewWhere}
        GROUP BY DATE(ae."createdAt")
        ORDER BY date ASC
      `,
      [] as Array<{ date: string; uniqueVisitors: number; guestVisitors: number; authenticatedVisitors: number }>,
    )

    const safeTopPages = Array.isArray(topPagesRaw) ? topPagesRaw : []
    const safeVisitorTrend = Array.isArray(visitorTrendRaw) ? visitorTrendRaw : []

    const totalPageViews = safeTopPages.reduce((sum, p) => sum + p.totalViews, 0)
    const totalUniqueVisitors = safeVisitorTrend.reduce((sum, d) => sum + d.uniqueVisitors, 0)
    const totalGuestVisitors = safeVisitorTrend.reduce((sum, d) => sum + d.guestVisitors, 0)
    const totalAuthenticatedVisitors = safeVisitorTrend.reduce((sum, d) => sum + d.authenticatedVisitors, 0)

    const today = new Date().toISOString().split('T')[0]
    const todayStats = safeVisitorTrend.find((d) => d.date === today)

    return NextResponse.json(
      {
        success: true,
        data: {
          overview: {
            totalUsers,
            newUsers,
            dau,
            totalTranslations,
            totalDictations,
          },
          userStats: {
            totalQueries: totalUserQueries,
            totalSuccess: totalUserSuccess,
            totalFailed: totalUserFailed,
            successRate: userSuccessRate,
            queryCount: userTranslateEvents.length + userTranslateErrorEvents.length,
            errorCount: userTranslateErrorEvents.length,
            errorReasons: Object.entries(userErrorReasons)
              .map(([reason, count]) => ({ reason, count }))
              .sort((a, b) => b.count - a.count),
            dailyTrend: userDailyTrend,
          },
          guestStats: {
            totalQueries: totalGuestQueries,
            totalFound: totalGuestFound,
            totalNotFound: totalGuestNotFound,
            successRate: guestSuccessRate,
            queryCount: guestTranslateEvents.length + guestTranslateErrorEvents.length,
            errorCount: guestTranslateErrorEvents.length,
            avgResponseTime,
            errorReasons: Object.entries(guestErrorReasons)
              .map(([reason, count]) => ({ reason, count }))
              .sort((a, b) => b.count - a.count),
            dailyTrend: guestDailyTrend,
          },
          topWords,
          eventsByType: eventTypeMap,
          dailyTrend,
          recentEvents,
          pageViewStats: {
            totalPageViews,
            totalUniqueVisitors,
            totalGuestVisitors,
            totalAuthenticatedVisitors,
            todayPageViews: todayStats?.uniqueVisitors ?? 0,
            todayGuestVisitors: todayStats?.guestVisitors ?? 0,
            todayAuthenticatedVisitors: todayStats?.authenticatedVisitors ?? 0,
            topPages: safeTopPages,
            visitorTrend: safeVisitorTrend,
          },
          range,
          excludeTestUsers,
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: error, details: message }, 'Analytics fetch error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics', ...(process.env.NODE_ENV !== 'production' ? { details: message } : {}) },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7d'
    const excludeTestUsers = searchParams.get('excludeTestUsers') !== 'false'
    const format = searchParams.get('format') || 'json'

    const now = new Date()
    let startDate: Date
    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const excludedUsers = excludeTestUsers
      ? await prisma.user.findMany({
          where: { username: { in: EXCLUDED_USERNAMES } },
          select: { id: true },
        })
      : []
    const excludedUserIds = excludedUsers.map((u: { id: string }) => u.id)

    const baseWhere = {
      createdAt: { gte: startDate },
      ...(excludeTestUsers && excludedUserIds.length > 0
        ? { userId: { notIn: excludedUserIds } }
        : {}),
    }

    const eventsRaw = await prisma.analyticsEvent.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, eventType: true, userId: true, sessionId: true,
        metadata: true, ipAddress: true, userAgent: true, createdAt: true,
      },
    })

    const userIds = [
      ...new Set(eventsRaw.map((e: { userId: string | null }) => e.userId).filter(Boolean)),
    ] as string[]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u.username]))

    const events = eventsRaw.map(
      (event: {
        id: string; eventType: string; userId: string | null; sessionId: string | null;
        metadata: string | null; ipAddress: string | null; userAgent: string | null; createdAt: Date
      }) => ({
        id: event.id,
        eventType: event.eventType,
        userId: event.userId,
        username: event.userId ? userMap.get(event.userId) || 'Unknown' : null,
        sessionId: event.sessionId,
        metadata: parseMetadataForResponse(event.metadata),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        createdAt: event.createdAt.toISOString(),
      }),
    )

    if (format === 'csv') {
      const csvHeaders = ['ID', '事件类型', '用户ID', '用户名', '会话ID', '元数据', 'IP地址', 'User-Agent', '创建时间']
      const csvRows = events.map((event) => [
        event.id, event.eventType, event.userId, event.username, event.sessionId,
        JSON.stringify(event.metadata), event.ipAddress, event.userAgent, event.createdAt,
      ])
      const csv = [csvHeaders, ...csvRows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="analytics-${range}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ success: true, data: { events, total: events.length } })
  } catch (error) {
    logger.error({ err: error }, 'Analytics export error')
    return NextResponse.json({ success: false, error: 'Failed to export analytics' }, { status: 500 })
  }
}
