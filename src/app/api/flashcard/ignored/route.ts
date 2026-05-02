import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { logger } from '@/lib/logger';

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const ignoredWords = await prisma.ignoredWord.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: ignoredWords });

  } catch (err: unknown) {
    logger.error({ err }, "Failed to fetch ignored words:");
    return NextResponse.json({ success: false, error: 'Failed to fetch ignored words' }, { status: 500 });
  }
}
