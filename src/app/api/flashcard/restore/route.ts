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

    const { word } = await req.json();

    if (!word) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    const normalizedWord = String(word).toLowerCase().trim();
    if (!normalizedWord) {
      return NextResponse.json({ success: false, error: 'Word is required' }, { status: 400 });
    }

    // Delete the ignored word record
    const deleted = await prisma.ignoredWord.deleteMany({
      where: {
        word: normalizedWord,
        userId: session.user.id
      }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: 'Word not found in ignored list' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Word restored' });

  } catch (error: any) {
    console.error("Failed to restore word:", error);
    return NextResponse.json({ success: false, error: 'Failed to restore word' }, { status: 500 });
  }
}
