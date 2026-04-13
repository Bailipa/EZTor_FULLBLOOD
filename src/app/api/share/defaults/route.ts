import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';

/**
 * GET /api/share/defaults
 * 获取预配置的默认词库列表
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401);
    }

    // 获取所有激活的默认词库
    const defaults = await prisma.defaultVocabulary.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        sortOrder: 'asc'
      },
      include: {
        reviewGroup: {
          select: {
            name: true,
            userId: true
          }
        }
      }
    });

    // 转换数据格式
    const transformedData = defaults.map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      code: d.code,
      wordCount: d.wordCount,
      sortOrder: d.sortOrder,
      groupName: d.reviewGroup.name,
    }));

    return createSuccessResponse({ data: transformedData });
  } catch (error: any) {
    return handleApiError(error, 'share/defaults GET');
  }
}
