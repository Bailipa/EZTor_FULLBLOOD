import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const groupId = searchParams.get('groupId');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;

    let words;

    if (groupId) {
      // Verify group ownership and fetch words from specific group
      const group = await prisma.reviewGroup.findUnique({
        where: { id: groupId }
      });

      if (!group || group.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
      }

      // Fetch random words from the specific Review Group
      words = await prisma.$queryRaw`
        SELECT
          w.id,
          w.word,
          COALESCE(NULLIF(TRIM(w.phonetic), ''), pw.phonetic, '') AS phonetic,
          COALESCE(NULLIF(TRIM(w.pos), ''), pw.pos, '') AS pos,
          COALESCE(NULLIF(TRIM(w.translation), ''), pw.translation, '') AS translation,
          COALESCE(NULLIF(TRIM(w.example), ''), pw.example, '') AS example,
          COALESCE(NULLIF(TRIM(w."exampleTranslation"), ''), pw."exampleTranslation", '') AS exampleTranslation,
          w."correctCount",
          w."incorrectCount",
          w."updatedAt"
        FROM "Word" w
        JOIN "ReviewGroupWord" rgw ON w.id = rgw.wordId
        LEFT JOIN "PublicWord" pw ON pw.id = w."publicWordId"
        WHERE rgw."reviewGroupId" = ${groupId}
        ORDER BY RANDOM() 
        LIMIT ${limit}
      `;
    } else {
      // Fallback: Fetch random words from the PUBLIC word bank
      words = await prisma.$queryRaw`
        SELECT * FROM "PublicWord" 
        ORDER BY RANDOM() 
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ success: true, data: words });

  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch public flashcard words:");
    return NextResponse.json({ success: false, error: 'Failed to fetch flashcard data' }, { status: 500 });
  }
}
