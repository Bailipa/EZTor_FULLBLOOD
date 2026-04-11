import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { word, isCorrect } = await req.json();

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    const normalizedWord = String(word).toLowerCase().trim();
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    const updateData = isCorrect 
      ? { correctCount: { increment: 1 } }
      : { incorrectCount: { increment: 1 } };

    // Since flashcards now come from the public bank, the user might not have this word in their private DB yet.
    // If it exists, update it. If it doesn't, create it with initial stats.
    
    // First try to find the word in the public bank to get its translation/details just in case we need to create it
    const publicWord = await prisma.publicWord.findUnique({
      where: { word: normalizedWord }
    });

    const createData = {
      word: normalizedWord,
      userId: session.user.id,
      translation: publicWord?.translation || 'Unknown (Added from flashcard)',
      phonetic: publicWord?.phonetic || null,
      pos: publicWord?.pos || null,
      example: publicWord?.example || null,
      exampleTranslation: publicWord?.exampleTranslation || null,
      correctCount: isCorrect ? 1 : 0,
      incorrectCount: isCorrect ? 0 : 1,
    };

    await prisma.word.upsert({
      where: { 
        word_userId: {
          word: normalizedWord,
          userId: session.user.id
        }
      },
      update: {
        ...updateData,
        updatedAt: new Date(), // 强制更新时间戳，以便智能排序使用
      },
      create: createData,
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Failed to update dictation stats:", error);
    return NextResponse.json({ success: false, error: 'Failed to update stats' }, { status: 500 });
  }
}
