import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import prisma from '@/lib/prisma'
import { checkCsrfHeader } from '@/lib/csrf'
import { checkUserBan, checkIpBan } from '@/lib/banManager'
import { rateLimit } from '@/lib/rateLimit'
import { ContributionInputError, findContributionWord, parseSubmission, REVIEW_LEASE_MS, submitContribution } from '@/services/ContributionSubmissionService'
import type { ContributionSubmission } from '@prisma/client'

export const maxDuration = 180

function receipt(row: ContributionSubmission) {
  return {
    id: row.id, kind: row.kind, word: row.word, translation: row.translation, question: row.question,
    status: row.status, reason: row.reason, points: row.points,
    createdAt: row.createdAt, reviewedAt: row.reviewedAt,
    retryable: row.status === 'ERROR' || (row.status === 'PROCESSING' && Date.now() - row.reviewStartedAt.getTime() >= REVIEW_LEASE_MS),
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  const word = new URL(req.url).searchParams.get('word')
  if (word !== null) {
    if (!word.trim() || word.length > 80) return NextResponse.json({ success: false, error: '请填写单词或词组' }, { status: 400 })
    const current = await findContributionWord(word)
    return NextResponse.json({ success: true, data: current ? { word: current.word, translation: current.translation } : null })
  }
  const rows = await prisma.contributionSubmission.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 20 })
  return NextResponse.json({ success: true, data: rows.map(receipt) })
}

export async function POST(req: Request) {
  const csrf = checkCsrfHeader(req)
  if (!csrf.valid) return NextResponse.json({ success: false, error: '请求验证失败，请刷新后重试' }, { status: 403 })
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const [userBan, ipBan] = await Promise.all([checkUserBan(session.user.id), checkIpBan(ip)])
  if (userBan.isBanned || ipBan.isBanned) return NextResponse.json({ success: false, error: '当前账号无法提交贡献' }, { status: 403 })
  const limit = await rateLimit(`contribution:${session.user.id}`, { maxRequests: 3, windowMs: 60_000 })
  if (!limit.success) return NextResponse.json({ success: false, error: '提交过于频繁，请稍后再试' }, { status: 429, headers: { 'Retry-After': '60' } })
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContributionInputError('提交内容无效')
    const row = await submitContribution(session.user.id, parseSubmission(body))
    return NextResponse.json({ success: row.status !== 'ERROR', data: receipt(row), error: row.status === 'ERROR' ? row.reason : undefined }, {
      status: row.status === 'PROCESSING' ? 202 : row.status === 'ERROR' ? 503 : 200,
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof ContributionInputError ? error.message : '贡献提交失败，请稍后重试' }, {
      status: error instanceof ContributionInputError ? error.status : 500,
    })
  }
}
