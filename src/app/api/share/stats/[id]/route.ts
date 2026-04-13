import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse } from "@/lib/apiErrorHandler";

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
        importer: {
          select: {
            username: true,
          },
        },
        targetGroup: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform import data
    const transformedImports = imports.map((imp) => ({
      importerName: imp.importer.username,
      importedAt: imp.createdAt.toISOString(),
      wordsImported: imp.wordsImported,
      wordsSkipped: imp.wordsSkipped,
      targetGroupName: imp.targetGroup.name,
    }));

    return createSuccessResponse({
      viewCount: share.viewCount,
      importCount: share.importedCount,
      imports: transformedImports,
    });
  } catch (error: any) {
    console.error("[Share Stats API] Error:", error);
    return createErrorResponse("获取统计信息失败", 500);
  }
}
