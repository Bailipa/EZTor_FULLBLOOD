import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { logger } from '@/lib/logger';

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
  | 'GUEST_TRANSLATE_ERROR';

interface TrackEventBody {
  eventType: EventType | string;
  metadata?: Record<string, unknown>;
}

const EXCLUDED_USERNAMES = ['creator', 'tester'];

function parseMetadataObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    logger.debug({ err: error }, 'Failed to parse metadata object');
  }
  return {};
}

function parseMetadataForResponse(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    logger.debug({ err: error }, 'Failed to parse metadata for response');
  }
  return null;
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         'unknown';
}

function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'unknown';
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body: TrackEventBody = await req.json();
    
    const { eventType, metadata } = body;

    if (!eventType) {
      return NextResponse.json(
        { success: false, error: 'Event type is required' },
        { status: 400 }
      );
    }

    const sessionId = req.headers.get('x-session-id') || generateSessionId();

    await (prisma as any).analyticsEvent.create({
      data: {
        id: randomUUID(),
        eventType,
        userId: session?.user?.id || null,
        sessionId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req)
      }
    });

    return NextResponse.json({ 
      success: true,
      sessionId
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics track error');
    return NextResponse.json(
      { success: false, error: 'Failed to track event' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!(user as any)?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '7d';
    const excludeTestUsers = searchParams.get('excludeTestUsers') !== 'false';
    
    const now = new Date();
    let startDate: Date;
    
    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const excludedUsers = excludeTestUsers 
      ? await prisma.user.findMany({
          where: { username: { in: EXCLUDED_USERNAMES } },
          select: { id: true }
        })
      : [];
    const excludedUserIds = excludedUsers.map((u: { id: string }) => u.id);

    const baseWhere = {
      createdAt: { gte: startDate },
      ...(excludeTestUsers && excludedUserIds.length > 0 
        ? { userId: { notIn: excludedUserIds } } 
        : {})
    };

    const [totalUsers, newUsers, totalWords] = await Promise.all([
      prisma.user.count({
        where: excludeTestUsers 
          ? { username: { notIn: EXCLUDED_USERNAMES } }
          : {}
      }),
      prisma.user.count({ 
        where: { 
          createdAt: { gte: startDate },
          ...(excludeTestUsers ? { username: { notIn: EXCLUDED_USERNAMES } } : {})
        } 
      }),
      prisma.word.count()
    ]);

    const [totalTranslations, totalDictations, totalErrors] = await Promise.all([
      (prisma as any).analyticsEvent.count({
        where: { ...baseWhere, eventType: 'TRANSLATE' }
      }),
      (prisma as any).analyticsEvent.count({
        where: { ...baseWhere, eventType: { in: ['DICTATION_START', 'DICTATION_COMPLETE'] } }
      }),
      (prisma as any).analyticsEvent.count({
        where: { ...baseWhere, eventType: { in: ['ERROR', 'API_ERROR'] } }
      })
    ]);

    const userTranslateEvents = await (prisma as any).analyticsEvent.findMany({
      where: { 
        ...baseWhere,
        eventType: 'TRANSLATE',
        userId: { not: null }
      },
      select: { metadata: true, createdAt: true, userId: true }
    });

    const userTranslateErrorEvents = await (prisma as any).analyticsEvent.findMany({
      where: { 
        ...baseWhere,
        eventType: { in: ['ERROR', 'API_ERROR'] },
        userId: { not: null }
      },
      select: { metadata: true, createdAt: true }
    });

    let totalUserQueries = 0;
    let totalUserSuccess = 0;
    let totalUserFailed = 0;
    const userDailyStats: Record<string, { total: number; success: number; failed: number }> = {};
    const userErrorReasons: Record<string, number> = {};

    userTranslateEvents.forEach((event: any) => {
      const metadata = parseMetadataObject(event.metadata);
      const date = event.createdAt.toISOString().split('T')[0];
      const wordCount = typeof metadata.wordCount === 'number' ? metadata.wordCount : 1;
      
      totalUserQueries += wordCount;
      totalUserSuccess += wordCount;

      if (!userDailyStats[date]) {
        userDailyStats[date] = { total: 0, success: 0, failed: 0 };
      }
      userDailyStats[date].total += wordCount;
      userDailyStats[date].success += wordCount;
    });

    userTranslateErrorEvents.forEach((event: any) => {
      const metadata = parseMetadataObject(event.metadata);
      const date = event.createdAt.toISOString().split('T')[0];
      const error = typeof metadata.error === 'string' ? metadata.error : 'Unknown error';
      
      totalUserFailed += 1;
      userErrorReasons[error] = (userErrorReasons[error] || 0) + 1;
      
      if (!userDailyStats[date]) {
        userDailyStats[date] = { total: 0, success: 0, failed: 0 };
      }
      userDailyStats[date].total += 1;
      userDailyStats[date].failed += 1;
    });

    const userSuccessRate = totalUserQueries > 0 
      ? Math.round((totalUserSuccess / totalUserQueries) * 10000) / 100 
      : 0;

    const userDailyTrend = Object.entries(userDailyStats)
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 10000) / 100 : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const guestTranslateEvents = await (prisma as any).analyticsEvent.findMany({
      where: { 
        createdAt: { gte: startDate }, 
        eventType: 'GUEST_TRANSLATE' 
      },
      select: { metadata: true, createdAt: true }
    });

    const guestTranslateErrorEvents = await (prisma as any).analyticsEvent.findMany({
      where: { 
        createdAt: { gte: startDate }, 
        eventType: 'GUEST_TRANSLATE_ERROR' 
      },
      select: { metadata: true, createdAt: true }
    });

    let totalGuestQueries = 0;
    let totalGuestFound = 0;
    let totalGuestNotFound = 0;
    const guestDailyStats: Record<string, { total: number; found: number; notFound: number }> = {};
    const guestErrorReasons: Record<string, number> = {};

    guestTranslateEvents.forEach((event: any) => {
      const metadata = parseMetadataObject(event.metadata);
      const date = event.createdAt.toISOString().split('T')[0];
      const totalWords = typeof metadata.totalWords === 'number' ? metadata.totalWords : 0;
      const foundWords = typeof metadata.foundWords === 'number' ? metadata.foundWords : 0;
      const notFoundWords = typeof metadata.notFoundWords === 'number' ? metadata.notFoundWords : 0;
      
      totalGuestQueries += totalWords;
      totalGuestFound += foundWords;
      totalGuestNotFound += notFoundWords;

      if (!guestDailyStats[date]) {
        guestDailyStats[date] = { total: 0, found: 0, notFound: 0 };
      }
      guestDailyStats[date].total += totalWords;
      guestDailyStats[date].found += foundWords;
      guestDailyStats[date].notFound += notFoundWords;
    });

    guestTranslateErrorEvents.forEach((event: any) => {
      const metadata = parseMetadataObject(event.metadata);
      const error = typeof metadata.error === 'string' ? metadata.error : 'Unknown error';
      guestErrorReasons[error] = (guestErrorReasons[error] || 0) + 1;
    });

    const guestSuccessRate = totalGuestQueries > 0 
      ? Math.round((totalGuestFound / totalGuestQueries) * 10000) / 100 
      : 0;

    const translationRecords = await (prisma as any).translationRecord.findMany({
      where: { createdAt: { gte: startDate } },
      select: { word: true, createdAt: true, responseTime: true }
    });

    const wordFrequency: Record<string, number> = {};
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    translationRecords.forEach((record: any) => {
      if (!record.word || typeof record.word !== 'string') return;
      const word = record.word.toLowerCase();
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      
      if (record.responseTime) {
        totalResponseTime += record.responseTime;
        responseTimeCount++;
      }
    });

    const avgResponseTime = responseTimeCount > 0 
      ? Math.round((totalResponseTime / responseTimeCount) * 100) / 100 
      : 0;

    const topWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    const dailyActiveUsers = await (prisma as any).analyticsEvent.groupBy({
      by: ['userId'],
      where: { 
        ...baseWhere,
        userId: { not: null } 
      },
      _count: true
    });

    const dau = dailyActiveUsers.length;

    const eventsByType = await (prisma as any).analyticsEvent.groupBy({
      by: ['eventType'],
      where: baseWhere,
      _count: true
    });

    const eventTypeMap: Record<string, number> = {};
    eventsByType.forEach((item: any) => {
      eventTypeMap[item.eventType] = item._count;
    });

    const events = await (prisma as any).analyticsEvent.findMany({
      where: baseWhere,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    const dateMap = new Map<string, number>();
    events.forEach((event: any) => {
      const date = event.createdAt.toISOString().split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    const dailyTrend = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const guestDailyTrend = Object.entries(guestDailyStats)
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        found: stats.found,
        notFound: stats.notFound,
        successRate: stats.total > 0 ? Math.round((stats.found / stats.total) * 10000) / 100 : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recentEventsRaw = await (prisma as any).analyticsEvent.findMany({
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
        createdAt: true
      }
    });

    const userIds = [...new Set(recentEventsRaw.map((e: any) => e.userId).filter(Boolean))] as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.username]));

    const recentEvents = recentEventsRaw.map((event: any) => ({
      id: event.id,
      eventType: event.eventType,
      userId: event.userId,
      username: event.userId ? userMap.get(event.userId) || 'Unknown' : null,
      sessionId: event.sessionId,
      metadata: parseMetadataForResponse(event.metadata),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          newUsers,
          dau,
          totalWords,
          totalTranslations,
          totalDictations,
          totalErrors
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
          dailyTrend: userDailyTrend
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
          dailyTrend: guestDailyTrend
        },
        topWords,
        eventsByType: eventTypeMap,
        dailyTrend,
        recentEvents,
        range,
        excludeTestUsers
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error, details: message }, 'Analytics fetch error');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics',
        ...(process.env.NODE_ENV !== 'production' ? { details: message } : {}),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!(user as any)?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const exportRange = searchParams.get('range') || '7d';
    const format = searchParams.get('format') || 'json';
    const excludeTestUsers = searchParams.get('excludeTestUsers') !== 'false';
    
    const now = new Date();
    let startDate: Date;
    
    switch (exportRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const excludedUsers = excludeTestUsers 
      ? await prisma.user.findMany({
          where: { username: { in: EXCLUDED_USERNAMES } },
          select: { id: true }
        })
      : [];
    const excludedUserIds = excludedUsers.map((u: { id: string }) => u.id);

    const eventsRaw = await (prisma as any).analyticsEvent.findMany({
      where: { 
        createdAt: { gte: startDate },
        ...(excludeTestUsers && excludedUserIds.length > 0 
          ? { userId: { notIn: excludedUserIds } } 
          : {})
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        eventType: true,
        userId: true,
        sessionId: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true
      }
    });

    const userIds = [...new Set(eventsRaw.map((e: any) => e.userId).filter(Boolean))] as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.username]));

    const events = eventsRaw.map((event: any) => ({
      id: event.id,
      eventType: event.eventType,
      userId: event.userId,
      username: event.userId ? userMap.get(event.userId) || 'Unknown' : null,
      sessionId: event.sessionId,
      metadata: parseMetadataForResponse(event.metadata),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt.toISOString()
    }));

    if (format === 'csv') {
      const escapeCSV = (str: string) => {
        let cleanStr = str.replace(/"/g, '""');
        if (/^[=+\-@]/.test(cleanStr)) {
          cleanStr = "'" + cleanStr;
        }
        return `"${cleanStr}"`;
      };
      
      const csvHeader = 'ID,事件类型,用户ID,用户名,Session ID,元数据,IP地址,User Agent,创建时间\n';
      const csvRows = events.map((e: any) => 
        `${escapeCSV(e.id)},${escapeCSV(e.eventType)},${escapeCSV(e.userId || '')},${escapeCSV(e.username || '')},${escapeCSV(e.sessionId || '')},${escapeCSV(JSON.stringify(e.metadata || {}))},${escapeCSV(e.ipAddress || '')},${escapeCSV(e.userAgent || '')},${escapeCSV(e.createdAt)}`
      ).join('\n');
      
      return new Response('\uFEFF' + csvHeader + csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="analytics_${exportRange}_${now.toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exportRange,
        exportedAt: now.toISOString(),
        totalCount: events.length,
        excludeTestUsers,
        events
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Analytics export error');
    return NextResponse.json(
      { success: false, error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}
