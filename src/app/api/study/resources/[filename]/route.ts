import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import resources from '../../../../../../content/cet-local/index.json'
import figures from '../../../../../../content/cet-local/writing-figures.json'

export const runtime = 'nodejs'
const keysByUrl = new Map<string, Set<string>>()
for (const item of resources.items) for (const resource of item.resources) {
  if (!resource.url.endsWith('.m4a')) continue
  const keys = keysByUrl.get(resource.url) ?? new Set<string>()
  keys.add(item.key); keysByUrl.set(resource.url, keys)
}
for (const [key, figure] of Object.entries(figures)) keysByUrl.set(figure.url, new Set([key]))

export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' }
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: '请先登录' }, { status: 401, headers })
  const { filename } = await params
  if (!/^[a-f0-9]{24}\.(m4a|png)$/.test(filename)) return new Response(null, { status: 404, headers })
  const keys = keysByUrl.get(`/study/resources/${filename}`)
  if (!keys) return new Response(null, { status: 404, headers })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isBanned: true, banExpiresAt: true } })
  if (!user || user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date()) || !await prisma.examAccess.findFirst({ where: { userId: session.user.id, paperKey: { in: [...keys] } }, select: { paperKey: true } })) return Response.json({ error: '暂时没有试卷可用' }, { status: 403, headers })
  const file = path.join(process.cwd(), 'public', 'study', 'resources', filename)
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
  return new Response(stream, { status: range ? 206 : 200, headers: { ...headers, 'Content-Type': filename.endsWith('.png') ? 'image/png' : 'audio/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) } })
}
