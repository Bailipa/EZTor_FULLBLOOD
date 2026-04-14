import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkCsrfHeader } from '@/lib/csrf';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = checkCsrfHeader(req);
    if (!csrf.valid) {
      return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const body = await req.json();
    const wordIds = body.wordIds;

    if (!wordIds || !Array.isArray(wordIds)) {
      return NextResponse.json({ success: false, error: 'wordIds array is required' }, { status: 400 });
    }

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
      include: {
        _count: { select: { ReviewGroupWord: true } }
      }
    });

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
    }

    const validWords = await prisma.word.findMany({
      where: {
        id: { in: wordIds },
        userId: session.user.id
      },
      select: { id: true }
    });

    const validWordIds = new Set(validWords.map(w => w.id));

    const existingLinks = await prisma.reviewGroupWord.findMany({
      where: {
        reviewGroupId: id,
        wordId: { in: wordIds }
      },
      select: { wordId: true }
    });

    const existingWordIds = new Set(existingLinks.map(l => l.wordId));

    const newWordIds = wordIds.filter((wid: string) => validWordIds.has(wid) && !existingWordIds.has(wid));

    if (newWordIds.length > 0) {
      await prisma.reviewGroupWord.createMany({
        data: newWordIds.map((wordId: string) => ({
          id: crypto.randomUUID(),
          reviewGroupId: id,
          wordId
        }))
      });
    }

    return NextResponse.json({ success: true, addedCount: newWordIds.length });
  } catch (error: any) {
    console.error("Failed to add words to group:", error);
    return NextResponse.json({ success: false, error: 'Failed to add words' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = checkCsrfHeader(req);
    if (!csrf.valid) {
      return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const wordId = searchParams.get('wordId');

    const group = await prisma.reviewGroup.findUnique({
      where: { id }
    });

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
    }

    if (action === 'clear_all') {
      await prisma.reviewGroupWord.deleteMany({
        where: { reviewGroupId: id }
      });
      return NextResponse.json({ success: true, message: 'Group cleared' });
    }

    if (action === 'batch') {
      const body = await req.json();
      const wordIds = body.wordIds;
      if (Array.isArray(wordIds) && wordIds.length > 0) {
        await prisma.reviewGroupWord.deleteMany({
          where: {
            reviewGroupId: id,
            wordId: { in: wordIds }
          }
        });
        return NextResponse.json({ success: true, message: 'Words removed from group' });
      }
      return NextResponse.json({ success: false, error: 'Invalid wordIds array' }, { status: 400 });
    }

    if (wordId) {
      await prisma.reviewGroupWord.deleteMany({
        where: {
          reviewGroupId: id,
          wordId: wordId
        }
      });
      return NextResponse.json({ success: true, message: 'Word removed from group' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to remove words from group:", error);
    return NextResponse.json({ success: false, error: 'Failed to remove words' }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const cursorParam = searchParams.get('cursor');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    const group = await prisma.reviewGroup.findUnique({
      where: { id }
    });

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
    }

    const where = { reviewGroupId: id };

    const [groupWords, total] = await Promise.all([
      prisma.reviewGroupWord.findMany({
        where,
        include: {
          Word: true
        },
        orderBy: { addedAt: 'desc' },
        take: limit + 1,
        ...(cursorParam ? { cursor: { id: cursorParam }, skip: 1 } : {})
      }),
      prisma.reviewGroupWord.count({ where })
    ]);

    const hasMore = groupWords.length > limit;
    const data = hasMore ? groupWords.slice(0, -1) : groupWords;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    const words = data.map(gw => gw.Word);

    return NextResponse.json({
      success: true,
      data: words,
      pagination: { total, hasMore, nextCursor }
    });
  } catch (error: any) {
    console.error("Failed to fetch group words:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch words' }, { status: 500 });
  }
}
