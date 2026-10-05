import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { checkCsrfHeader } from '@/lib/csrf'
import prisma from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = checkCsrfHeader(req)
  if (!csrf.valid) {
    return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!admin?.isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'void' && body.action !== 'restore') {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (body.action === 'void' && reason.length < 3) {
    return NextResponse.json({ success: false, error: '作废原因至少需要 3 个字符' }, { status: 400 })
  }

  const current = await prisma.contributionLedger.findUnique({ where: { id } })
  if (!current) {
    const correction = await prisma.contributionSubmission.findUnique({ where: { id } })
    if (!correction || correction.kind !== 'CORRECTION' || !['APPROVED', 'VOID'].includes(correction.status)) {
      return NextResponse.json({ success: false, error: 'Contribution not found' }, { status: 404 })
    }
    const next = { status: body.action === 'void' ? 'VOID' : 'APPROVED', reason: body.action === 'void' ? reason.slice(0, 500) : '管理员恢复贡献计分' }
    await prisma.$transaction([
      prisma.contributionSubmission.update({ where: { id }, data: next }),
      prisma.auditLog.create({ data: {
        userId: session.user.id, action: body.action === 'void' ? 'VOID_CONTRIBUTION' : 'RESTORE_CONTRIBUTION',
        entityType: 'ContributionSubmission', entityId: id,
        oldValue: JSON.stringify({ status: correction.status, reason: correction.reason }), newValue: JSON.stringify(next),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
      } }),
    ])
    return NextResponse.json({ success: true })
  }

  const next = body.action === 'void'
    ? { status: 'VOID', voidReason: reason.slice(0, 500), voidedAt: new Date() }
    : { status: 'VALID', voidReason: null, voidedAt: null }

  await prisma.$transaction([
    prisma.contributionLedger.update({ where: { id }, data: next }),
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: body.action === 'void' ? 'VOID_CONTRIBUTION' : 'RESTORE_CONTRIBUTION',
        entityType: 'ContributionLedger',
        entityId: id,
        oldValue: JSON.stringify({ status: current.status, voidReason: current.voidReason }),
        newValue: JSON.stringify(next),
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
