import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { generateUniqueCode } from "@/lib/share/codeGenerator";
import { createSuccessResponse, createErrorResponse } from "@/lib/apiErrorHandler";
import { logger } from '@/lib/logger';

/**
 * POST /api/share/:id/regenerate
 * Generate new key, invalidate old key
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse("请先登录", 401);
    }

    const userId = session.user.id;
    const { id } = await params;

    // Verify share exists and belongs to current user
    const share = await prisma.sharedVocabulary.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        isActive: true,
        code: true,
      },
    });

    if (!share) {
      return createErrorResponse("分享记录不存在", 404);
    }

    // Verify ownership
    if (share.userId !== userId) {
      return createErrorResponse("无权操作他人的分享", 403);
    }

    if (!share.isActive) {
      return createErrorResponse("该分享已被撤销，无法重新生成", 400);
    }

    // Generate new unique code
    const newCode = await generateUniqueCode();

    // Update record with new code
    const updatedShare = await prisma.sharedVocabulary.update({
      where: { id },
      data: {
        code: newCode,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    return createSuccessResponse({
      code: newCode,
      version: updatedShare.version,
      message: "密钥已重新生成",
    });
  } catch (error: any) {
    logger.error({ err: error }, "[Share Regenerate API] Error:");
    return createErrorResponse("重新生成密钥失败", 500);
  }
}
