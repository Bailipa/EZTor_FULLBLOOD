import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse } from "@/lib/apiErrorHandler";

/**
 * GET /api/share/list
 * Retrieve all shares created by current user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse("请先登录", 401);
    }

    const userId = session.user.id;

    // Query all shares created by current user
    const shares = await prisma.sharedVocabulary.findMany({
      where: {
        userId,
        deletedAt: null, // Only non-deleted shares
      },
      include: {
        reviewGroup: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform data to match response schema
    const transformedShares = shares.map((share) => ({
      id: share.id,
      code: share.code,
      name: share.name,
      reviewGroupName: share.reviewGroup.name,
      reviewGroupId: share.reviewGroupId,
      wordCount: share.wordCount,
      usedCount: share.usedCount,
      importedCount: share.importedCount,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
      maxUses: share.maxUses,
      isActive: share.isActive,
      createdAt: share.createdAt.toISOString(),
    }));

    return createSuccessResponse(transformedShares);
  } catch (error: any) {
    console.error("[Share List API] Error:", error);
    return createErrorResponse("获取分享列表失败", 500);
  }
}
