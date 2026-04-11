import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

const DEFAULT_QUOTES = [
  '坚持学习，每天进步一点点',
  '不积跬步，无以至千里',
  '学习是一场马拉松，不是短跑',
  '今天的努力，是明天的收获',
  '每天背单词，英语不再难',
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        username: true, 
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    const totalWords = await prisma.word.count({
      where: { userId },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayWords = await prisma.word.count({
      where: {
        userId,
        createdAt: { gte: today },
      },
    });

    const wordsWithStats = await prisma.word.findMany({
      where: { userId },
      select: {
        correctCount: true,
        incorrectCount: true,
      },
    });

    let totalCorrect = 0;
    let totalIncorrect = 0;
    wordsWithStats.forEach((w) => {
      totalCorrect += w.correctCount;
      totalIncorrect += w.incorrectCount;
    });

    const totalAttempts = totalCorrect + totalIncorrect;
    const accuracy = totalAttempts > 0 
      ? Math.round((totalCorrect / totalAttempts) * 100) 
      : 0;

    const daysSinceJoin = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (request.headers.get('host')
        ? `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`
        : 'http://localhost:3000');

    return NextResponse.json({
      success: true,
      data: {
        username: user.username,
        totalWords,
        todayWords,
        accuracy,
        studyDays: daysSinceJoin,
        baseUrl: baseUrl.replace(/\/$/, ''),
        quotes: DEFAULT_QUOTES,
      },
    });
  } catch (error) {
    console.error('Share stats error:', error);
    return NextResponse.json(
      { success: false, error: '获取数据失败' },
      { status: 500 }
    );
  }
}
