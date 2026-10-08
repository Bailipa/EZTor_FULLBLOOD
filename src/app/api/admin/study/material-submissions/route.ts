import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { checkCsrfHeader } from '@/lib/csrf'
import { listMaterialSubmissions } from '@/lib/studyMaterialContributions'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  return user?.isAdmin ? session.user.id : null
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const submissions = await listMaterialSubmissions()
  return NextResponse.json({ submissions }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(req: Request) {
  const csrf = checkCsrfHeader(req)
  if (!csrf.valid) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const status = body.status
  const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 1000) : ''
  if (!id || !['APPROVED', 'REJECTED'].includes(status) || reviewNote.length < 3) return NextResponse.json({ error: '请提供有效状态和至少 3 个字的审核说明' }, { status: 400 })
  const record = await prisma.auditLog.findFirst({ where: { entityType: 'StudyMaterialSubmission', entityId: id, action: 'STUDY_MATERIAL_SUBMITTED' } })
  if (!record) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  const { parseMaterialSubmission, addMaterialStatusAudit, MaterialReviewConflict } = await import('@/lib/studyMaterialContributions')
  const current = parseMaterialSubmission(record)
  if (!current || !record.newValue) return NextResponse.json({ error: 'Submission data is invalid' }, { status: 500 })
  if (current.status !== 'PENDING') return NextResponse.json({ error: 'Submission has already been reviewed' }, { status: 409 })
  const next = { ...current, status, reviewNote } as typeof current
  try {
    await addMaterialStatusAudit(adminId, record.id, record.newValue, current, next, req)
  } catch (error) {
    if (error instanceof MaterialReviewConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    throw error
  }
  return NextResponse.json({ success: true })
}
