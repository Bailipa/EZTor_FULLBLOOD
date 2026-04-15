import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    const groups = await prisma.reviewGroup.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { ReviewGroupWord: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return createSuccessResponse({ data: groups });
  } catch (error: any) {
    return handleApiError(error, 'review-groups GET');
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    const { name } = await req.json();
    if (!name || name.trim() === '') {
      return createErrorResponse('分组名称不能为空', 400);
    }

    const count = await prisma.reviewGroup.count({
      where: { userId: session.user.id }
    });

    if (count >= 3) {
      return createErrorResponse('最多只能创建 3 个复习分组', 400);
    }

    const group = await prisma.reviewGroup.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        userId: session.user.id,
        updatedAt: new Date(),
      }
    });

    return createSuccessResponse({ data: group });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return createErrorResponse('该分组名称已存在', 400);
    }
    return handleApiError(error, 'review-groups POST');
  }
}
