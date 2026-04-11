import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

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

    const priorityLimit = Math.ceil(limit * 0.7);
    const timeDecayLimit = limit - priorityLimit;

    if (groupId && groupId !== 'all') {
      const group = await prisma.reviewGroup.findUnique({
        where: { id: groupId }
      });
      if (!group || group.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: 'Group not found or unauthorized' }, { status: 404 });
      }

      const priorityWords = await prisma.$queryRaw<any[]>`
        SELECT w.* 
        FROM Word w
        JOIN ReviewGroupWord rgw ON w.id = rgw.wordId
        WHERE w.userId = ${session.user.id} AND rgw.reviewGroupId = ${groupId}
        ORDER BY 
          (w.correctCount + w.incorrectCount) ASC, 
          w.incorrectCount DESC
        LIMIT ${priorityLimit}
      `;

      const priorityIds = priorityWords.map(w => w.id);
      
      let timeDecayWords: any[] = [];
      if (priorityIds.length > 0) {
        timeDecayWords = await prisma.$queryRaw<any[]>`
          SELECT w.* 
          FROM Word w
          JOIN ReviewGroupWord rgw ON w.id = rgw.wordId
          WHERE w.userId = ${session.user.id} 
            AND rgw.reviewGroupId = ${groupId}
            AND w.id NOT IN (${Prisma.join(priorityIds)})
          ORDER BY w.updatedAt ASC
          LIMIT ${timeDecayLimit}
        `;
      } else {
        timeDecayWords = await prisma.$queryRaw<any[]>`
          SELECT w.* 
          FROM Word w
          JOIN ReviewGroupWord rgw ON w.id = rgw.wordId
          WHERE w.userId = ${session.user.id} AND rgw.reviewGroupId = ${groupId}
          ORDER BY w.updatedAt ASC
          LIMIT ${timeDecayLimit}
        `;
      }

      let combinedWords = [...priorityWords, ...timeDecayWords];
      combinedWords.sort(() => Math.random() - 0.5);
      return NextResponse.json({ success: true, data: combinedWords });
    }

    const priorityWords = await prisma.$queryRaw<any[]>`
      SELECT w.* 
      FROM Word w
      WHERE w.userId = ${session.user.id}
      ORDER BY 
        (w.correctCount + w.incorrectCount) ASC, 
        w.incorrectCount DESC
      LIMIT ${priorityLimit}
    `;

    const priorityIds = priorityWords.map(w => w.id);
    
    let timeDecayWords: any[] = [];
    if (priorityIds.length > 0) {
      timeDecayWords = await prisma.$queryRaw<any[]>`
        SELECT w.* 
        FROM Word w
        WHERE w.userId = ${session.user.id}
          AND w.id NOT IN (${Prisma.join(priorityIds)})
        ORDER BY w.updatedAt ASC
        LIMIT ${timeDecayLimit}
      `;
    } else {
      timeDecayWords = await prisma.$queryRaw<any[]>`
        SELECT w.* 
        FROM Word w
        WHERE w.userId = ${session.user.id}
        ORDER BY w.updatedAt ASC
        LIMIT ${timeDecayLimit}
      `;
    }

    let combinedWords = [...priorityWords, ...timeDecayWords];
    combinedWords.sort(() => Math.random() - 0.5);

    return NextResponse.json({ success: true, data: combinedWords });

  } catch (error: any) {
    console.error("Failed to fetch smart dictation words:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch smart data' }, { status: 500 });
  }
}