import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    const { results } = await req.json();

    if (!results || !Array.isArray(results) || results.length === 0) {
      return createErrorResponse('未提供有效数据', 400);
    }

    let savedCount = 0;
    for (const item of results) {
      if (!item.word) continue;

      const normalizedWord = String(item.word).toLowerCase().trim();
      if (!normalizedWord) continue;

      const wordData = {
        word: normalizedWord,
        phonetic: item.phonetic || null,
        pos: item.pos || null,
        translation: item.translation || '',
        example: item.example || null,
        exampleTranslation: item.exampleTranslation || null,
        correctCount: item.correctCount ? parseInt(item.correctCount, 10) : 0,
        incorrectCount: item.incorrectCount ? parseInt(item.incorrectCount, 10) : 0,
      };

      let retries = 3;
      while (retries > 0) {
        try {
          await prisma.word.upsert({
            where: { 
              word_userId: {
                word: wordData.word,
                userId: session.user.id
              }
            },
            update: {
              ...wordData,
              updatedAt: new Date()
            },
            create: {
              ...wordData,
              userId: session.user.id
            }
          });
          savedCount++;
          break;
        } catch (dbErr: any) {
          if (dbErr.message?.includes('database is locked')) {
            retries--;
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          } else {
            console.error(`[Import] Failed to save word ${wordData.word}:`, dbErr.code || dbErr.message);
            break;
          }
        }
      }
    }

    return createSuccessResponse({ savedCount });
  } catch (error: any) {
    return handleApiError(error, 'import-csv');
  }
}
