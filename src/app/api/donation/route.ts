import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const config = await prisma.donationConfig.findUnique({
      where: { id: 'global' },
      select: {
        title: true,
        description: true,
        imageUrl: true,
        linkUrl: true,
        isActive: true,
      }
    });

    if (!config || !config.isActive) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    logger.error({ err: error }, 'Failed to get donation config');
    return NextResponse.json({ success: false, error: 'Failed to get donation config' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, imageUrl, linkUrl, isActive } = body;

    const config = await prisma.donationConfig.upsert({
      where: { id: 'global' },
      update: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
      create: {
        id: 'global',
        title: title || 'Support EZTor',
        description: description || null,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl || null,
        isActive: isActive !== undefined ? isActive : true,
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update donation config');
    return NextResponse.json({ success: false, error: 'Failed to update donation config' }, { status: 500 });
  }
}
