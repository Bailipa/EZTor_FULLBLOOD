import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse } from "@/lib/apiErrorHandler";
import { logger } from '@/lib/logger';

/**
 * GET /api/share/stats/:id
 * Retrieve share statistics
 */
export async function GET(
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
        viewCount: true,
        importedCount: true,
      },
    });

    if (!share) {
      return createErrorResponse("分享记录不存在", 404);
    }

    // Verify ownership
    if (share.userId !== userId) {
      return createErrorResponse("无权查看他人的分享统计", 403);
    }

    // Query import records
    const imports = await prisma.sharedVocabularyImport.findMany({
      where: { sharedId: id },
      include: {
        User: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get target group names separately
    const targetGroupIds = [...new Set(imports.map(imp => imp.targetGroupId))];
    const targetGroups = await prisma.reviewGroup.findMany({
      where: {
        id: { in: targetGroupIds },
      },
      select: {
        id: true,
        name: true,
      },
    });
    const groupMap = new Map(targetGroups.map(g => [g.id, g.name]));

    // Transform import data
    const transformedImports = imports.map((imp) => ({
      importerName: imp.User.username,
      importedAt: imp.createdAt.toISOString(),
      wordsImported: imp.wordsImported,
      wordsSkipped: imp.wordsSkipped,
      targetGroupName: groupMap.get(imp.targetGroupId) || "未知分组",
    }));

    return createSuccessResponse({
      viewCount: share.viewCount,
      importCount: share.importedCount,
      imports: transformedImports,
    });
  } catch (error: any) {
    logger.error({ err: error }, "[Share Stats API] Error:");
    return createErrorResponse("获取统计信息失败", 500);
  }
}
