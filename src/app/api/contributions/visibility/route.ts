import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { checkCsrfHeader } from '@/lib/csrf'
import prisma from '@/lib/prisma'

type Visibility = 'private' | 'anonymous' | 'nickname'

function isUniqueConflict(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002'
}

export async function PUT(req: Request) {
  const csrf = checkCsrfHeader(req)
  if (!csrf.valid) {
    return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const visibility = body.visibility as Visibility
  if (!['private', 'anonymous', 'nickname'].includes(visibility)) {
    return NextResponse.json({ success: false, error: 'Invalid visibility' }, { status: 400 })
  }

  const existing = await prisma.contributionProfile.findUnique({ where: { userId: session.user.id } })
  if (existing) {
    const profile = await prisma.contributionProfile.update({
      where: { userId: session.user.id },
      data: { visibility },
      select: { visibility: true, publicAlias: true },
    })
    return NextResponse.json({ success: true, data: profile })
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const publicAlias = `贡献者 ${randomBytes(3).toString('hex').slice(0, 4).toUpperCase()}`
    try {
      const profile = await prisma.contributionProfile.create({
        data: { userId: session.user.id, visibility, publicAlias, updatedAt: new Date() },
        select: { visibility: true, publicAlias: true },
      })
      return NextResponse.json({ success: true, data: profile })
    } catch (err) {
      if (!isUniqueConflict(err)) throw err
      const concurrent = await prisma.contributionProfile.findUnique({ where: { userId: session.user.id } })
      if (concurrent) {
        const profile = await prisma.contributionProfile.update({
          where: { userId: session.user.id },
          data: { visibility },
          select: { visibility: true, publicAlias: true },
        })
        return NextResponse.json({ success: true, data: profile })
      }
    }
  }

  return NextResponse.json({ success: false, error: '匿名标识生成失败，请重试' }, { status: 500 })
}
