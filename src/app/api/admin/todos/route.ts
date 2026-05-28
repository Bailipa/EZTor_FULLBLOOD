import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { broadcastTodos } from '@/lib/chatSSE'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const todos = await prisma.adminTodo.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({ success: true, data: todos })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to fetch todos: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '' })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { title } = await req.json()

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }

    const maxSort = await prisma.adminTodo.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    const todo = await prisma.adminTodo.create({
      data: {
        title: title.trim(),
        sortOrder: (maxSort?.sortOrder || 0) + 1,
      }
    })

    const todos = await prisma.adminTodo.findMany({
      orderBy: { sortOrder: 'asc' }
    })
    broadcastTodos(todos)

    return NextResponse.json({ success: true, data: todo })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to create todo: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
