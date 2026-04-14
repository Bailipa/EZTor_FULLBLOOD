import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { generateUniqueCode } from '@/lib/share/codeGenerator';
import { sanitizeInput } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('请先登录', 401);
    }

    const userId = session.user.id;
    const body = await req.json();

    const { reviewGroupId, name, description, expiresAt, maxUses } = body;

    if (!reviewGroupId || typeof reviewGroupId !== 'string') {
      return createErrorResponse('分组 ID 不能为空', 400);
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return createErrorResponse('分享名称不能为空', 400);
    }

    const sanitizedName = sanitizeInput(name.trim(), 100);
    const sanitizedDescription = description ? sanitizeInput(description, 500) : null;

    const reviewGroup = await prisma.reviewGroup.findUnique({
      where: { id: reviewGroupId }
    });

    if (!reviewGroup) {
      return createErrorResponse('复习分组不存在', 404);
    }

    if (reviewGroup.userId !== userId) {
      return createErrorResponse('无权分享他人的复习分组', 403);
    }

    const wordCount = await prisma.reviewGroupWord.count({
      where: { reviewGroupId }
    });

    if (wordCount === 0) {
      return createErrorResponse('该分组中没有单词，无法分享', 400);
    }

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      const date = new Date(expiresAt);
      if (isNaN(date.getTime())) {
        return createErrorResponse('过期时间格式无效，请使用 ISO 8601 格式', 400);
      }
      parsedExpiresAt = date;
    }

    let parsedMaxUses: number | null = null;
    if (maxUses !== undefined && maxUses !== null) {
      if (typeof maxUses !== 'number' || maxUses <= 0 || !Number.isInteger(maxUses)) {
        return createErrorResponse('最大使用次数必须是正整数', 400);
      }
      parsedMaxUses = maxUses;
    }

    const code = await generateUniqueCode();

    const sharedVocabulary = await prisma.sharedVocabulary.create({
      data: {
        code,
        name: sanitizedName,
        description: sanitizedDescription,
        userId,
        reviewGroupId,
        expiresAt: parsedExpiresAt,
        maxUses: parsedMaxUses,
        wordCount,
        shareType: 'REVIEW_GROUP',
        usedCount: 0,
        isActive: true,
        importedCount: 0,
        viewCount: 0,
        version: 1
      }
    });

    const host = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
    const shareUrl = host ? `${protocol}://${host}/share/import?code=${code}` : null;

    return createSuccessResponse({
      data: {
        code: sharedVocabulary.code,
        name: sharedVocabulary.name,
        description: sharedVocabulary.description,
        expiresAt: sharedVocabulary.expiresAt?.toISOString() || null,
        maxUses: sharedVocabulary.maxUses,
        shareUrl
      }
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return createErrorResponse('分享密钥已存在，请重试', 400);
    }
    if (error.code === 'P2003') {
      return createErrorResponse('关联的复习分组不存在', 404);
    }
    return handleApiError(error, 'share/create POST');
  }
}
