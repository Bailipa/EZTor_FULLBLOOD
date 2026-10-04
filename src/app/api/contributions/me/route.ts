import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { contributionTotals, creditedWordWhere } from '@/lib/contributions'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  const url = new URL(req.url)
  const page = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1))
  const pageSize = 50
  const [profile, gameProfile, totals, words, corrections] = await Promise.all([
    prisma.contributionProfile.findUnique({ where: { userId: session.user.id }, select: { visibility: true, publicAlias: true } }),
    prisma.userGameProfile.findUnique({ where: { userId: session.user.id }, select: { nickname: true } }),
    contributionTotals(),
    prisma.contributionLedger.findMany({
      where: { ...creditedWordWhere(), contributorUserId: session.user.id },
      orderBy: { occurredAt: 'desc' }, take: page * pageSize,
      select: { id: true, normalizedWordKey: true, status: true, occurredAt: true, voidReason: true },
    }),
    prisma.contributionSubmission.findMany({
      where: { userId: session.user.id, kind: 'CORRECTION', status: { in: ['APPROVED', 'VOID'] }, points: 1 },
      orderBy: { reviewedAt: 'desc' }, take: page * pageSize,
      select: { id: true, word: true, status: true, reviewedAt: true, createdAt: true, reason: true },
    }),
  ])
  const entries = [
    ...words.map((entry) => ({ id: entry.id, word: entry.normalizedWordKey, kind: 'NEW', points: 1, status: entry.status, occurredAt: entry.occurredAt, voidReason: entry.voidReason })),
    ...corrections.map((entry) => ({ id: entry.id, word: entry.word, kind: 'CORRECTION', points: 1, status: entry.status === 'APPROVED' ? 'VALID' : 'VOID', occurredAt: entry.reviewedAt || entry.createdAt, voidReason: entry.status === 'VOID' ? entry.reason : null })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice((page - 1) * pageSize, page * pageSize)
  return NextResponse.json({ success: true, data: {
    enabled: true, visibility: profile?.visibility || 'private', publicAlias: profile?.publicAlias || null,
    hasNickname: Boolean(gameProfile?.nickname), total: totals.get(session.user.id) || 0, page, pageSize, entries,
  } })
}
