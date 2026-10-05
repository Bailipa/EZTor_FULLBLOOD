import { lockGroupOwner } from '@/lib/reviewGroups'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const { id } = await params

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: { ReviewGroupWord: true },
        },
      },
    })

    if (!group || group.userId !== session.user.id) {
      return createErrorResponse('分组不存在或无权访问', 404)
    }

    return createSuccessResponse({ data: group })
  } catch (err: unknown) {
    return handleApiError(err, 'review-groups/[id] GET')
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const { id } = await params
    const { name } = await req.json()

    if (!name || name.trim() === '') {
      return createErrorResponse('自定义词库名称不能为空', 400)
    }

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
    })

    if (!group || group.userId !== session.user.id) {
      return createErrorResponse('分组不存在或无权访问', 404)
    }
    if (group.isSystem) {
      return createErrorResponse('系统词库不能重命名', 400)
    }

    const updatedGroup = await prisma.reviewGroup.update({
      where: { id },
      data: { name: name.trim() },
    })

    return createSuccessResponse({ data: updatedGroup })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return createErrorResponse('该自定义词库名称已存在', 400)
    }
    return handleApiError(err, 'review-groups/[id] PATCH')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const { id } = await params

    const group = await prisma.reviewGroup.findUnique({
      where: { id },
    })

    if (!group || group.userId !== session.user.id) {
      return createErrorResponse('分组不存在或无权访问', 404)
    }
    if (group.isSystem) {
      return createErrorResponse('系统词库不能删除', 400)
    }

    await prisma.$transaction(async (tx) => {
      await lockGroupOwner(tx, session.user.id)
      const receipts = await tx.sharedVocabularyImport.findMany({
        where: { targetGroupId: id, importerId: session.user.id }, orderBy: { sharedId: 'asc' },
      })
      // Use the same share -> receipt lock order as batch import and settlement.
      for (const receipt of receipts) {
        await tx.$queryRaw`SELECT id FROM "SharedVocabulary" WHERE id = ${receipt.sharedId} FOR UPDATE`
        const current = await tx.sharedVocabularyImport.findUnique({ where: { id: receipt.id } })
        if (current?.useReserved) {
          await tx.sharedVocabulary.update({ where: { id: receipt.sharedId }, data: { usedCount: { decrement: 1 } } })
        }
      }
      await tx.sharedVocabularyImport.deleteMany({ where: { targetGroupId: id, importerId: session.user.id } })
      await tx.reviewGroup.delete({ where: { id } })
    })

    return createSuccessResponse({})
  } catch (err: unknown) {
    return handleApiError(err, 'review-groups/[id] DELETE')
  }
}
