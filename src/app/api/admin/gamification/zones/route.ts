import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const zones = await prisma.warZone.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      memberCount: true,
      maxMembers: true,
      isActive: true,
      previousName: true,
      renamedBy: true,
      renamedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: zones })
}
