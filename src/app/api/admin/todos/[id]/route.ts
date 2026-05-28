import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { broadcastTodos } from '@/lib/chatSSE'
import { logger } from '@/lib/logger'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { title, isCompleted, sortOrder } = body

    const data: Record<string, unknown> = {}
    if (title !== undefined) data.title = title
    if (isCompleted !== undefined) data.isCompleted = isCompleted
    if (sortOrder !== undefined) data.sortOrder = sortOrder

    const todo = await prisma.adminTodo.update({
      where: { id },
      data
    })

    const todos = await prisma.adminTodo.findMany({
      orderBy: { sortOrder: 'asc' }
    })
    broadcastTodos(todos)

    return NextResponse.json({ success: true, data: todo })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to update todo: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.adminTodo.delete({ where: { id } })

    const todos = await prisma.adminTodo.findMany({
      orderBy: { sortOrder: 'asc' }
    })
    broadcastTodos(todos)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to delete todo: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
