import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    const { id } = await params;

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: { ReviewGroupWord: true }
        }
      }
    });

    if (!group || group.userId !== session.user.id) {
      return createErrorResponse('分组不存在或无权访问', 404);
    }

    return createSuccessResponse({ data: group });
  } catch (error: any) {
    return handleApiError(error, 'review-groups/[id] GET');
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    const { id } = await params;
    const { name } = await req.json();

    if (!name || name.trim() === '') {
      return createErrorResponse('分组名称不能为空', 400);
    }

    const group = await prisma.reviewGroup.findUnique({
      where: { id }
    });

    if (!group || group.userId !== session.user.id) {
      return createErrorResponse('分组不存在或无权访问', 404);
    }

    const updatedGroup = await prisma.reviewGroup.update({
      where: { id },
      data: { name: name.trim() }
    });

    return createSuccessResponse({ data: updatedGroup });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return createErrorResponse('该分组名称已存在', 400);
    }
    return handleApiError(error, 'review-groups/[id] PATCH');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    const { id } = await params;

    const group = await prisma.reviewGroup.findUnique({
      where: { id }
    });

    if (!group || group.userId !== session.user.id) {
      return createErrorResponse('分组不存在或无权访问', 404);
    }

    // 删除相关的sharedVocabularyImport记录
    await prisma.sharedVocabularyImport.deleteMany({
      where: {
        targetGroupId: id,
        importerId: session.user.id
      }
    });

    await prisma.reviewGroup.delete({
      where: { id }
    });

    return createSuccessResponse({});
  } catch (error: any) {
    return handleApiError(error, 'review-groups/[id] DELETE');
  }
}
