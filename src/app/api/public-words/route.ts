import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { cascadePublicWordToPrivate } from '@/lib/publicWordCascade';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const word = searchParams.get('word') || undefined;
    const minQuality = searchParams.get('minQuality') ? parseInt(searchParams.get('minQuality')!) : undefined;
    const maxQuality = searchParams.get('maxQuality') ? parseInt(searchParams.get('maxQuality')!) : undefined;
    const sortBy = searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (word) {
      where.word = { contains: word.toLowerCase() };
    }
    if (minQuality !== undefined || maxQuality !== undefined) {
      where.qualityScore = {};
      if (minQuality !== undefined) where.qualityScore.gte = minQuality;
      if (maxQuality !== undefined) where.qualityScore.lte = maxQuality;
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [words, total] = await Promise.all([
      prisma.publicWord.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.publicWord.count({ where })
    ]);

    const stats = await prisma.publicWord.aggregate({
      _count: { id: true },
      _avg: { qualityScore: true },
      _max: { qualityScore: true },
      _min: { qualityScore: true },
    });

    const qualityDistribution = await prisma.publicWord.groupBy({
      by: ['qualityScore'],
      _count: { id: true },
      orderBy: { qualityScore: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        words,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          totalWords: stats._count.id,
          avgQuality: Math.round(stats._avg.qualityScore || 0),
          maxQuality: stats._max.qualityScore || 0,
          minQuality: stats._min.qualityScore || 0,
          qualityDistribution: qualityDistribution.map((q: { qualityScore: number; _count: { id: number } }) => ({
            score: q.qualityScore,
            count: q._count.id
          }))
        }
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Public words fetch error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids');

    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      const result = await prisma.publicWord.deleteMany({
        where: { id: { in: idList } }
      });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    await prisma.publicWord.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Public word delete error');
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Word not found' }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, word, phonetic, pos, translation, example, exampleTranslation, qualityScore } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const existing = await prisma.publicWord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Word not found' }, { status: 404 });
    }

    if (word !== undefined) {
      const normalized = String(word).toLowerCase().trim();
      if (normalized !== existing.word) {
        return NextResponse.json(
          { success: false, error: 'Renaming words is not supported. Please create a new word instead.' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (phonetic !== undefined) updateData.phonetic = phonetic || null;
    if (pos !== undefined) updateData.pos = pos || null;
    if (translation !== undefined) updateData.translation = translation;
    if (example !== undefined) updateData.example = example || null;
    if (exampleTranslation !== undefined) updateData.exampleTranslation = exampleTranslation || null;
    if (qualityScore !== undefined) updateData.qualityScore = Math.max(0, Math.min(100, qualityScore));

    const updated = await prisma.publicWord.update({
      where: { id },
      data: updateData
    });

    await cascadePublicWordToPrivate({
      word: updated.word,
      translation: updated.translation,
      phonetic: updated.phonetic,
      pos: updated.pos,
      example: updated.example,
      exampleTranslation: updated.exampleTranslation
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ err: error }, 'Public word update error');
    if (error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Word not found' }, { status: 404 });
    }
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Word already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { word, phonetic, pos, translation, example, exampleTranslation, qualityScore } = body;

    if (!word || !translation) {
      return NextResponse.json({ success: false, error: 'Word and translation are required' }, { status: 400 });
    }

    const created = await prisma.publicWord.create({
      data: {
        id: randomUUID(),
        word: word.toLowerCase().trim(),
        phonetic: phonetic || null,
        pos: pos || null,
        translation,
        example: example || null,
        exampleTranslation: exampleTranslation || null,
        qualityScore: qualityScore !== undefined ? Math.max(0, Math.min(100, qualityScore)) : 0,
        updatedAt: new Date(),
      }
    });

    await cascadePublicWordToPrivate({
      word: created.word,
      translation: created.translation,
      phonetic: created.phonetic,
      pos: created.pos,
      example: created.example,
      exampleTranslation: created.exampleTranslation
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    logger.error({ err: error }, 'Public word create error');
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Word already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
