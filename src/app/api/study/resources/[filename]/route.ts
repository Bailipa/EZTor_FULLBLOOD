import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { accessiblePaperWhere, defaultExamKeys } from '@/services/study/ExamAccessService'
import { legacyResourceKeys } from '@/services/study/legacyExamResources'
import { examResourceRoot } from '@/services/study/ExamResourceService'
import { examPaperKey } from '@/services/study/ExamAccessService'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' }
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: '请先登录' }, { status: 401, headers })
  const { filename } = await params
  if (!/^[a-f0-9]{24}\.(m4a|mp3|png)$/.test(filename)) return new Response(null, { status: 404, headers })
  const registrations = await prisma.examPaperResource.findMany({
    where: { filename, paper: { rightsStatus: 'APPROVED' } }, select: { paper: { select: { slug: true } } },
  })
  const keys = new Set(registrations.map(({ paper }) => examPaperKey(paper.slug)))
  for (const key of legacyResourceKeys.get(`/study/resources/${filename}`) ?? []) keys.add(key)
  if (!keys.size) return new Response(null, { status: 404, headers })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isBanned: true, banExpiresAt: true } })
  if (!user || user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date())) return Response.json({ error: '暂时没有试卷可用' }, { status: 403, headers })
  const directAccess = await prisma.examAccess.findFirst({ where: { userId: session.user.id, paperKey: { in: [...keys] } }, select: { paperKey: true } })
  const defaultAccess = !directAccess && (await defaultExamKeys(prisma)).some((key) => keys.has(key))
  // A granted third paper may explicitly reuse this audio without granting the donor paper.
  const reusedAccess = !directAccess && !defaultAccess && !filename.endsWith('.png') && await prisma.examAttempt.findFirst({
    where: {
      userId: session.user.id, mode: { in: ['FULL', 'LISTENING'] },
      paper: { rightsStatus: 'APPROVED', ...await accessiblePaperWhere(prisma, session.user.id) },
      state: { path: ['listeningReuse', 'section', 'audio'], array_contains: [{ url: `/study/resources/${filename}` }] },
    }, select: { id: true },
  })
  if (!directAccess && !defaultAccess && !reusedAccess) return Response.json({ error: '暂时没有试卷可用' }, { status: 403, headers })
  const file = path.join(examResourceRoot(), filename)
  let size: number
  try { size = (await stat(file)).size } catch { return new Response(null, { status: 404, headers }) }
  const range = req.headers.get('range')
  let start = 0, end = size - 1
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
    if (!match[1]) start = Math.max(0, size - Number(match[2]))
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])) }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
  }
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>
  return new Response(stream, { status: range ? 206 : 200, headers: { ...headers, 'Content-Type': filename.endsWith('.png') ? 'image/png' : filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) } })
}
