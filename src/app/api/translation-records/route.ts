import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

const MAX_RECORDS_PER_USER = 1000;
const MAX_RECORDS_TOTAL = 50000;

async function cleanupOldRecords() {
  const totalRecords = await prisma.translationRecord.count();
  
  if (totalRecords > MAX_RECORDS_TOTAL) {
    const deleteCount = totalRecords - MAX_RECORDS_TOTAL + 1000;
    const oldestRecords = await prisma.translationRecord.findMany({
      orderBy: { createdAt: 'asc' },
      take: deleteCount,
      select: { id: true }
    });
    
    await prisma.translationRecord.deleteMany({
      where: { id: { in: oldestRecords.map(r => r.id) } }
    });
  }
}

export async function GET(req: NextRequest) {
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId') || undefined;
    const word = searchParams.get('word') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (word) where.word = { contains: word.toLowerCase() };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      prisma.translationRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          word: true,
          phonetic: true,
          pos: true,
          translation: true,
          example: true,
          exampleTranslation: true,
          isCached: true,
          responseTime: true,
          ipAddress: true,
          createdAt: true
        }
      }),
      prisma.translationRecord.count({ where })
    ]);

    const userIds = [...new Set(records.map(r => r.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u.username]));

    const enrichedRecords = records.map(record => ({
      ...record,
      username: record.userId ? userMap.get(record.userId) || 'Unknown' : '游客'
    }));

    const stats = await prisma.translationRecord.aggregate({
      _count: { id: true },
      _avg: { responseTime: true }
    });

    const cachedCount = await prisma.translationRecord.count({
      where: { isCached: true }
    });

    return NextResponse.json({
      success: true,
      data: {
        records: enrichedRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          totalRecords: stats._count.id,
          avgResponseTime: Math.round(stats._avg.responseTime || 0),
          cachedCount,
          cacheRate: stats._count.id > 0 ? Math.round((cachedCount / stats._count.id) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('Translation records fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch translation records' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;

    const body = await req.json();
    const { word, phonetic, pos, translation, example, exampleTranslation, isCached, responseTime } = body;

    if (!word || !translation) {
      return NextResponse.json(
        { success: false, error: 'Word and translation are required' },
        { status: 400 }
      );
    }

    if (userId) {
      const userRecordCount = await prisma.translationRecord.count({
        where: { userId }
      });

      if (userRecordCount >= MAX_RECORDS_PER_USER) {
        const oldestRecords = await prisma.translationRecord.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: { id: true }
        });

        await prisma.translationRecord.deleteMany({
          where: { id: { in: oldestRecords.map(r => r.id) } }
        });
      }
    }

    await cleanupOldRecords();

    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      null;
    const userAgent = req.headers.get('user-agent') || null;

    const record = await prisma.translationRecord.create({
      data: {
        userId,
        word: word.toLowerCase().trim(),
        phonetic: phonetic || null,
        pos: pos || null,
        translation,
        example: example || null,
        exampleTranslation: exampleTranslation || null,
        isCached: isCached || false,
        responseTime: responseTime || null,
        ipAddress,
        userAgent
      }
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Translation record create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create translation record' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
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
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '0');

    if (olderThanDays > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.translationRecord.deleteMany({
        where: { createdAt: { lt: cutoffDate } }
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} records older than ${olderThanDays} days`
      });
    }

    const result = await prisma.translationRecord.deleteMany();
    return NextResponse.json({
      success: true,
      message: `Deleted all ${result.count} translation records`
    });
  } catch (error) {
    console.error('Translation records delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete translation records' },
      { status: 500 }
    );
  }
}
