import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

// 管理员：查看某用户的 AI 提问记录（含 prompt 内容）
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!admin?.isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  const where = userId ? { userId } : {}
  const [rows, total] = await Promise.all([
    prisma.aiAskLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: { id: true, prompt: true, cost: true, isAiFree: true, turns: true, createdAt: true },
    }),
    prisma.aiAskLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}
