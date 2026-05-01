import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { checkCsrfHeader } from '@/lib/csrf';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const csrf = checkCsrfHeader(req);
    if (!csrf.valid) {
      return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 });
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { results } = body;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
    }

    let savedCount = 0;
    let errorCount = 0;

    for (const wordData of results) {
      if (wordData && wordData.word) {
        try {
          const word = String(wordData.word).toLowerCase().trim();
          const savedWord = await prisma.word.upsert({
            where: { 
              word_userId: {
                word,
                userId: session.user.id
              }
            },
            update: {
              word,
              phonetic: wordData.phonetic || null,
              pos: wordData.pos || null,
              translation: wordData.translation || '',
              example: wordData.example || null,
              exampleTranslation: wordData.exampleTranslation || null,
              updatedAt: new Date()
            },
            create: {
              word,
              phonetic: wordData.phonetic || null,
              pos: wordData.pos || null,
              translation: wordData.translation || '',
              example: wordData.example || null,
              exampleTranslation: wordData.exampleTranslation || null,
              userId: session.user.id,
              updatedAt: new Date()
            }
          });
          savedCount++;
        } catch (err) {
          logger.error({ err: err }, `Failed to sync word: ${wordData.word}`);
          logger.error({ errStr: JSON.stringify(err, Object.getOwnPropertyNames(err)) }, 'Error details:');
          errorCount++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sync complete. Saved: ${savedCount}, Errors: ${errorCount}` 
    });

  } catch (error: any) {
    logger.error({ err: error }, "Sync API Error:");
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
