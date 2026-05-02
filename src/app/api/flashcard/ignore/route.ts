import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { word } = await req.json();

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    const normalizedWord = String(word).toLowerCase().trim();
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    // Check if the word exists in the public word bank
    const publicWord = await prisma.publicWord.findUnique({
      where: { word: normalizedWord }
    });

    if (!publicWord) {
      return NextResponse.json({ success: false, error: 'Word not found' }, { status: 404 });
    }

    // Check if the word is already ignored
    const existingIgnoredWord = await prisma.ignoredWord.findUnique({
      where: {
        word_userId: {
          word: normalizedWord,
          userId: session.user.id
        }
      }
    });

    if (existingIgnoredWord) {
      return NextResponse.json({ success: true, message: 'Word already ignored' });
    }

    // Create ignored word record
    await prisma.ignoredWord.create({
      data: {
        id: randomUUID(),
        word: normalizedWord,
        userId: session.user.id,
        translation: publicWord.translation,
        phonetic: publicWord.phonetic,
        example: publicWord.example,
        exampleTranslation: publicWord.exampleTranslation
      }
    });

    return NextResponse.json({ success: true, message: 'Word marked as ignored' });

  } catch (err: unknown) {
    logger.error({ err }, "Failed to ignore word:");
    return NextResponse.json({ success: false, error: 'Failed to ignore word' }, { status: 500 });
  }
}
