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
    const cursorParam = searchParams.get('cursor');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;
    const where = { userId: session.user.id };

    const [words, total] = await Promise.all([
      prisma.word.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit + 1,
        ...(cursorParam ? { cursor: { id: cursorParam }, skip: 1 } : {}),
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
      }),
      prisma.word.count({ where })
    ]);

    const hasMore = words.length > limit;
    const data = hasMore ? words.slice(0, -1) : words;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({
      success: true,
      data,
      pagination: { total, hasMore, nextCursor }
    });

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
