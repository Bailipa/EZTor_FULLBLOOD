import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { broadcastTodos } from '@/lib/chatSSE'
import { logger } from '@/lib/logger'

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { ids } = await req.json()

    if (!Array.isArray(ids)) {
      return NextResponse.json({ success: false, error: 'ids must be an array' }, { status: 400 })
    }

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.adminTodo.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    )

    const todos = await prisma.adminTodo.findMany({
      orderBy: { sortOrder: 'asc' }
    })
    broadcastTodos(todos)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to reorder todos: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
