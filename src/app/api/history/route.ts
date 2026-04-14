import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 9999999) : 9999999;

    // 获取当前用户按更新时间倒序的生词记录
    const words = await prisma.word.findMany({
      where: { userId: session.user.id },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        word: true,
        pos: true,
        translation: true,
        phonetic: true,
        example: true,
        exampleTranslation: true,
        correctCount: true,
        incorrectCount: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ success: true, data: words });

  } catch (error: any) {
    console.error("Failed to fetch history words:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history data' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const wordId = searchParams.get('id');
    const action = searchParams.get('action');

    if (action === 'clear_all') {
      await prisma.word.deleteMany({
        where: { userId: session.user.id }
      });
      return NextResponse.json({ success: true, message: 'All records cleared' });
    }

    if (action === 'batch') {
      const body = await req.json();
      const wordIds = body.wordIds;
      if (Array.isArray(wordIds) && wordIds.length > 0) {
        await prisma.word.deleteMany({
          where: { 
            id: { in: wordIds },
            userId: session.user.id
          }
        });
        return NextResponse.json({ success: true, message: 'Words deleted successfully' });
      }
      return NextResponse.json({ success: false, error: 'Invalid wordIds array' }, { status: 400 });
    }

    if (wordId) {
      const existingWord = await prisma.word.findUnique({
        where: { id: wordId }
      });
      
      if (!existingWord) {
         return NextResponse.json({ success: false, error: 'Word not found' }, { status: 404 });
      }

      if (existingWord.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      await prisma.word.delete({
        where: { id: wordId }
      });
      return NextResponse.json({ success: true, message: 'Word deleted successfully' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request parameters' }, { status: 400 });

  } catch (error: any) {
    console.error("Failed to delete history:", error);
    return NextResponse.json({ success: false, error: 'Failed to delete history data' }, { status: 500 });
  }
}