import { createCustomGroup, GroupLimitError } from '@/lib/reviewGroups'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler'

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const groups = await prisma.reviewGroup.findMany({
      where: { userId: session.user.id, isSystem: false },
      include: {
        _count: {
          select: { ReviewGroupWord: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return createSuccessResponse({ data: groups })
  } catch (err: unknown) {
    return handleApiError(err, 'review-groups GET')
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const { name } = await req.json()
    if (typeof name !== 'string' || name.trim() === '') {
      return createErrorResponse('自定义词库名称不能为空', 400)
    }

    const group = await createCustomGroup(session.user.id, name.trim())

    return createSuccessResponse({ data: group })
  } catch (err: unknown) {
    if (err instanceof GroupLimitError) return createErrorResponse(err.message, 400)
    if ((err as { code?: string }).code === 'P2002') {
      return createErrorResponse('该自定义词库名称已存在', 400)
    }
    return handleApiError(err, 'review-groups POST')
  }
}
