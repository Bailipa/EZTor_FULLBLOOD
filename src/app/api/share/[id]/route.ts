import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse } from "@/lib/apiErrorHandler";
import { logger } from '@/lib/logger';

/**
 * DELETE /api/share/:id
 * Revoke/soft-delete a share
 */
export async function DELETE(
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
      return createErrorResponse("该分享已被撤销", 400);
    }

    // Soft delete: set deletedAt and isActive = false
    await prisma.sharedVocabulary.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return createSuccessResponse({ message: "分享已成功撤销" });
  } catch (err: unknown) {
    logger.error({ err }, "[Share Delete API] Error:");
    return createErrorResponse("撤销分享失败", 500);
  }
}
