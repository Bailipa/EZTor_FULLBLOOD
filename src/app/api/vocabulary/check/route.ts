import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const word = url.searchParams.get('word')?.trim().toLowerCase()
  if (!word) {
    return NextResponse.json({ success: false, error: 'Missing word param' }, { status: 400 })
  }

  const existing = await prisma.word.findFirst({
    where: { userId: session.user.id, word },
    select: { id: true },
  })

  return NextResponse.json({ success: true, exists: !!existing })
}
