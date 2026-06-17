import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: zoneId } = await params
  const body = await req.json()

  const zone = await prisma.warZone.findUnique({ where: { id: zoneId } })
  if (!zone) {
    return NextResponse.json({ success: false, error: '学区不存在' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.maxMembers !== undefined) data.maxMembers = body.maxMembers
  if (body.isActive !== undefined) data.isActive = body.isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: '没有要修改的字段' }, { status: 400 })
  }

  try {
    await prisma.warZone.update({ where: { id: zoneId }, data })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ success: false, error: '学区名称已存在' }, { status: 400 })
    }
    throw err
  }
}
