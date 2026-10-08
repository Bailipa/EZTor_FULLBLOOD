import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { listMaterialSubmissions, readMaterialFile } from '@/lib/studyMaterialContributions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { fileId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ownSubmissions = await listMaterialSubmissions(session.user.id)
  let submission = ownSubmissions.find((item) => item.files.some((file) => file.id === fileId))
  if (!submission) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
    if (user?.isAdmin) submission = (await listMaterialSubmissions()).find((item) => item.files.some((file) => file.id === fileId))
  }
  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const bytes = await readMaterialFile(fileId)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const file = submission?.files.find((entry) => entry.id === fileId)
  return new Response(bytes, { headers: { 'Content-Type': file?.type === 'pdf' ? 'application/pdf' : file?.type === 'json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${fileId}.${file?.type || 'bin'}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
