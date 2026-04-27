import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic'; // 禁止缓存，每次获取最新的随机数据

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    // 默认取 20 条，最多 50 条
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

    // 获取数据库中所有单词的总数
    const count = await prisma.word.count({
      where: { userId: session.user.id }
    });
    
    if (count === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // SQLite 没有很好的原生 ORDER BY RANDOM() 性能优化，但对于个人生词本来说数据量小，直接用也可以。
    // 这里使用 Prisma 的 queryRaw 执行原生 SQL 以获取随机记录
    const randomWords = await prisma.$queryRaw`
      SELECT
        w.word,
        COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
        COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
        COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example
      FROM Word w
      LEFT JOIN PublicWord pw ON pw.id = w.publicWordId
      WHERE w.userId = ${session.user.id}
      ORDER BY RANDOM() 
      LIMIT ${limit}
    `;

    return NextResponse.json({ success: true, data: randomWords });

  } catch (error: any) {
    console.error("Failed to fetch danmaku words:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch danmaku data' }, { status: 500 });
  }
}
