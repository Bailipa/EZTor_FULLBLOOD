import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sanitizeWordList } from '@/lib/security';
import { rateLimit, getClientKey } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                   req.headers.get('x-real-ip') ||
                   'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  try {
    const rateLimitKey = `public:${clientIp}`;
    const rateLimitResult = await rateLimit(rateLimitKey);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await req.json();
    const { words } = body;

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Words list is required' }, { status: 400 });
    }

    const sanitizedWords = sanitizeWordList(words);
    if (sanitizedWords.length === 0) {
      return NextResponse.json({ error: 'Invalid words list' }, { status: 400 });
    }

    const results = await prisma.publicWord.findMany({
      where: {
        word: {
          in: sanitizedWords.map(w => w.toLowerCase())
        }
      },
      select: {
        word: true,
        phonetic: true,
        pos: true,
        translation: true,
        example: true,
        exampleTranslation: true,
        qualityScore: true,
      }
    });

    const foundWords = new Set(results.map((r: { word: string }) => r.word));
    const notFound = sanitizedWords.filter(w => !foundWords.has(w.toLowerCase()));
    
    const responseTime = Date.now() - startTime;

    await (prisma as any).analyticsEvent.create({
      data: {
        eventType: 'GUEST_TRANSLATE',
        userId: null,
        sessionId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        metadata: JSON.stringify({
          totalWords: sanitizedWords.length,
          foundWords: results.length,
          notFoundWords: notFound.length,
          responseTime
        }),
        ipAddress: clientIp,
        userAgent: userAgent
      }
    });

    await Promise.all(
      results.map((r: {
        word: string;
        phonetic: string | null;
        pos: string | null;
        translation: string;
        example: string | null;
        exampleTranslation: string | null;
      }) => 
        (prisma as any).translationRecord.create({
          data: {
            word: r.word,
            phonetic: r.phonetic,
            pos: r.pos,
            translation: r.translation,
            example: r.example,
            exampleTranslation: r.exampleTranslation,
            isCached: true,
            responseTime,
            ipAddress: clientIp,
            userAgent: userAgent,
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        results: results.map((r: {
          word: string;
          phonetic: string | null;
          pos: string | null;
          translation: string;
          example: string | null;
          exampleTranslation: string | null;
        }) => ({
          word: r.word,
          phonetic: r.phonetic,
          pos: r.pos,
          translation: r.translation,
          example: r.example,
          exampleTranslation: r.exampleTranslation,
          isPublic: true,
        })),
        notFound,
        isGuestMode: true,
      }
    });
  } catch (error) {
    console.error('Public translate error:', error);
    
    await (prisma as any).analyticsEvent.create({
      data: {
        eventType: 'GUEST_TRANSLATE_ERROR',
        userId: null,
        sessionId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        metadata: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime
        }),
        ipAddress: clientIp,
        userAgent: userAgent
      }
    });
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
