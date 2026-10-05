import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const word = url.searchParams.get('word')?.trim().toLowerCase()
  const targetGroupId = url.searchParams.get('targetGroupId')
  if (!word) {
    return NextResponse.json({ success: false, error: 'Missing word param' }, { status: 400 })
  }

  if (targetGroupId) {
    const group = await prisma.reviewGroup.findUnique({
      where: { id: targetGroupId },
      select: { userId: true },
    })
    if (!group || group.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Invalid target group' }, { status: 400 })
    }
  }

  const existing = await prisma.word.findFirst({
    where: { userId: session.user.id, word },
    select: { id: true, ReviewGroupWord: { where: targetGroupId ? { reviewGroupId: targetGroupId } : undefined, select: { id: true }, take: 1 } },
  })

  return NextResponse.json({
    success: true,
    exists: !!existing,
    inTargetGroup: targetGroupId ? Boolean(existing?.ReviewGroupWord.length) : !!existing,
  })
}
