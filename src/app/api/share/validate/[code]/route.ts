import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { handleApiError, createErrorResponse } from '@/lib/apiErrorHandler'
import { isValidShareCode } from '@/lib/share/codeGenerator'

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('请先登录', 401)
    }

    const userId = session.user.id
    const { code: rawCode } = await params
    const code = rawCode ? rawCode.toUpperCase().trim() : rawCode

    if (!code || !isValidShareCode(code)) {
      return NextResponse.json(
        {
          valid: false,
          error: 'INVALID_FORMAT',
          message: '密钥格式无效',
        },
        { status: 400 },
      )
    }

    const share = await prisma.sharedVocabulary.findUnique({
      where: { code },
      include: {
        User: {
          select: {
            username: true,
          },
        },
        ReviewGroup: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!share) {
      return NextResponse.json(
        {
          valid: false,
          error: 'INVALID_CODE',
          message: '密钥不存在',
        },
        { status: 404 },
      )
    }

    if (!share.isActive) {
      return NextResponse.json(
        {
          valid: false,
          error: 'INACTIVE_SHARE',
          message: '该分享已被撤销',
        },
        { status: 403 },
      )
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      return NextResponse.json(
        {
          valid: false,
          error: 'EXPIRED_CODE',
          message: '该密钥已过期，无法使用',
        },
        { status: 410 },
      )
    }

    if (share.maxUses !== null && share.usedCount >= share.maxUses) {
      return NextResponse.json(
        {
          valid: false,
          error: 'MAX_USES_REACHED',
          message: '该密钥使用次数已达上限',
        },
        { status: 429 },
      )
    }

    const existingImport = await prisma.sharedVocabularyImport.findUnique({
      where: {
        sharedId_importerId: {
          sharedId: share.id,
          importerId: userId,
        },
      },
    })

    if (existingImport) {
      // 检查对应的组是否存在
      const targetGroup = await prisma.reviewGroup.findUnique({
        where: {
          id: existingImport.targetGroupId,
        },
      })

      // 如果组不存在，允许重新导入
      if (!targetGroup) {
        await prisma.sharedVocabularyImport.delete({
          where: {
            id: existingImport.id,
          },
        })
      } else {
        return NextResponse.json(
          {
            valid: false,
            error: 'ALREADY_IMPORTED',
            message: '您已导入过该词库，无需重复导入',
          },
          { status: 409 },
        )
      }
    }

    await prisma.sharedVocabulary.update({
      where: { id: share.id },
      data: {
        viewCount: { increment: 1 },
      },
    })

    return NextResponse.json({
      valid: true,
      data: {
        code: share.code,
        name: share.name,
        description: share.description,
        wordCount: share.wordCount,
        shareType: share.shareType,
        expiresAt: share.expiresAt?.toISOString() || null,
        maxUses: share.maxUses,
        usedCount: share.usedCount,
        creator: share.User.username,
      },
    })
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code === 'P2002') {
      return createErrorResponse('数据已存在', 409)
    }
    if (code === 'P2025') {
      return createErrorResponse('记录不存在', 404)
    }
    return handleApiError(err, 'share/validate GET')
  }
}
