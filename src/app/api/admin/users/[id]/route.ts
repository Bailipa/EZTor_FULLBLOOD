import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return {
      ok: false as const,
      res: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    return {
      ok: false as const,
      res: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true as const, userId: session.user.id }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.res

    const { id } = await params

    // Prevent deleting self
    if (id === admin.userId) {
      return NextResponse.json(
        { success: false, error: '不能删除自己的账户' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, isAdmin: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // Prevent deleting admin users
    if (user.isAdmin) {
      return NextResponse.json(
        { success: false, error: '不能删除管理员账户' },
        { status: 400 }
      )
    }

    // Count related data before deletion
    const [wordCount, groupCount, chatCount] = await Promise.all([
      prisma.word.count({ where: { userId: id } }),
      prisma.reviewGroup.count({ where: { userId: id } }),
      prisma.chatMessage.count({ where: { userId: id } }),
    ])

    // Delete user (cascade will delete related data)
    await prisma.user.delete({
      where: { id },
    })

    // Log the deletion
    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: id,
        newValue: JSON.stringify({
          username: user.username,
          deletedWords: wordCount,
          deletedGroups: groupCount,
          deletedMessages: chatCount,
        }),
      },
    })

    logger.info(
      { adminId: admin.userId, deletedUserId: id, username: user.username },
      `[Admin] Deleted user ${user.username}`
    )

    return NextResponse.json({
      success: true,
      message: `已删除用户 ${user.username}`,
      deletedData: {
        words: wordCount,
        groups: groupCount,
        messages: chatCount,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to delete user: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
