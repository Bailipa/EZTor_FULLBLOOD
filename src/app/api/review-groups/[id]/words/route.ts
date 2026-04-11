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

    // Fix: Await the params object before destructuring its properties in Next.js 15+
    const { id } = await params;
    
    const body = await req.json();
    const wordIds = body.wordIds; // Array of Word IDs from the private library

    if (!wordIds || !Array.isArray(wordIds)) {
      return NextResponse.json({ success: false, error: 'wordIds array is required' }, { status: 400 });
    }

    // Verify ownership of the group
    const group = await prisma.reviewGroup.findUnique({
      where: { id },
      include: {
        _count: { select: { words: true } }
      }
    });

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
    }

    // Add words (ignore duplicates via Prisma nested connect/create or raw)
    // First, verify these words actually belong to the user
    const validWords = await prisma.word.findMany({
      where: {
        id: { in: wordIds },
        userId: session.user.id
      },
      select: { id: true }
    });

    const validWordIds = validWords.map(w => w.id);

    // Create the links
    let addedCount = 0;
    for (const wordId of validWordIds) {
      try {
        await prisma.reviewGroupWord.create({
          data: {
            reviewGroupId: id,
            wordId: wordId
          }
        });
        addedCount++;
      } catch (e: any) {
        // Ignore P2002 (Unique constraint failed) - means it's already in the group
        if (e.code !== 'P2002') {
          console.error("Error adding word to group:", e);
        }
      }
    }

    return NextResponse.json({ success: true, addedCount });
  } catch (error: any) {
    console.error("Failed to add words to group:", error);
    return NextResponse.json({ success: false, error: 'Failed to add words' }, { status: 500 });
  }
}

// Remove words from a group or clear all
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

    // Verify ownership
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

    // Fix: Await params
    const { id } = await params;

    // Verify ownership
    const group = await prisma.reviewGroup.findUnique({
      where: { id }
    });

    if (!group || group.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
    }

    const groupWords = await prisma.reviewGroupWord.findMany({
      where: { reviewGroupId: id },
      include: {
        word: true
      },
      orderBy: { addedAt: 'desc' }
    });

    const words = groupWords.map(gw => gw.word);

    return NextResponse.json({ success: true, data: words });
  } catch (error: any) {
    console.error("Failed to fetch group words:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch words' }, { status: 500 });
  }
}