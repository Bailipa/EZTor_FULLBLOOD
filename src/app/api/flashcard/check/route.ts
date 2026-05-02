import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logger } from '@/lib/logger';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const word = searchParams.get('word');

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    const normalizedWord = String(word).toLowerCase().trim();
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    // Check if the word exists in the user's vocabulary book
    const existingWord = await prisma.word.findUnique({
      where: {
        word_userId: {
          word: normalizedWord,
          userId: session.user.id
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      isInVocabularyBook: !!existingWord 
    });

  } catch (err: unknown) {
    logger.error({ err }, "Failed to check vocabulary book status:");
    return NextResponse.json({ success: false, error: 'Failed to check vocabulary book status' }, { status: 500 });
  }
}
