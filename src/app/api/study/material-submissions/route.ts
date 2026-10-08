import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import prisma from '@/lib/prisma'
import { checkCsrfHeader } from '@/lib/csrf'
import { rateLimit } from '@/lib/rateLimit'
import { MATERIAL_MAX_BYTES, listMaterialSubmissions, newMaterialFileId, removeMaterialFiles, saveMaterialFile } from '@/lib/studyMaterialContributions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const account = req.headers.get('x-study-account')
  if (account && account !== session.user.id) return NextResponse.json({ error: '账号已切换，请刷新后重试' }, { status: 409 })
  const rows = await listMaterialSubmissions(session.user.id)
  return NextResponse.json({ submissions: rows.map(({ id, name, yearSet, level, status, reviewNote, createdAt }) => ({ id, name, yearSet, level, status, reviewNote, createdAt })) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: Request) {
  const csrf = checkCsrfHeader(req)
  if (!csrf.valid) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: '请先登录后提交' }, { status: 401 })
  const account = req.headers.get('x-study-account')
  if (account && account !== session.user.id) return NextResponse.json({ error: '账号已切换，请刷新后重试' }, { status: 409 })
  const limit = await rateLimit(`study-material:${session.user.id}`, { maxRequests: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.success) return NextResponse.json({ error: '提交过于频繁，请稍后再试' }, { status: 429 })
  const announced = Number(req.headers.get('content-length') || 0)
  if (announced > MATERIAL_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: '文件总大小不能超过 10 MB' }, { status: 413 })
  const reader = req.body?.getReader()
  if (!reader) return NextResponse.json({ error: '提交内容为空' }, { status: 400 })
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MATERIAL_MAX_BYTES + 64 * 1024) { await reader.cancel(); return NextResponse.json({ error: '文件总大小不能超过 10 MB' }, { status: 413 }) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let form: FormData
  try { form = await new Request(req.url, { method: 'POST', headers: req.headers, body: Buffer.concat(chunks) }).formData() }
  catch { return NextResponse.json({ error: '表单格式无效' }, { status: 400 }) }
  const text = (key: string, max: number) => {
    const value = form.get(key)
    return typeof value === 'string' ? value.trim().slice(0, max) : ''
  }
  const name = text('name', 160), yearSet = text('yearSet', 100), level = text('level', 40), sourceUrl = text('sourceUrl', 1000)
  const description = text('description', 3000), answers = text('answers', 20000)
  if (!name || !yearSet || !['CET-4', 'CET-6'].includes(level) || !sourceUrl) return NextResponse.json({ error: '请填写名称、年份/套次、级别和来源 URL' }, { status: 400 })
  try { const url = new URL(sourceUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error() } catch { return NextResponse.json({ error: '来源 URL 必须是 http 或 https 链接' }, { status: 400 }) }
  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0)
  if (!files.length || files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > MATERIAL_MAX_BYTES) return NextResponse.json({ error: '请上传 1–5 个文件，总大小不超过 10 MB' }, { status: 400 })
  const saved: { id: string; name: string; size: number; type: string }[] = []
  const id = newMaterialFileId()
  try {
    for (const file of files) {
      const safeName = file.name.replace(/[\\/\0-\x1f]/g, '_').slice(0, 180) || 'upload'
      const ext = safeName.toLowerCase().split('.').pop()
      if (ext !== 'pdf' && ext !== 'json' && ext !== 'txt') throw new Error('只接受 PDF、JSON 或 TXT 文件')
      const bytes = new Uint8Array(await file.arrayBuffer())
      if ((ext === 'pdf' && new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') || (ext === 'json' && !validJson(bytes)) || (ext === 'txt' && !validText(bytes))) throw new Error(`文件内容与 .${ext} 格式不匹配`)
      const fileId = newMaterialFileId()
      await saveMaterialFile(fileId, bytes)
      saved.push({ id: fileId, name: safeName, size: bytes.byteLength, type: ext })
    }
    const submission = { id, name, yearSet, level, sourceUrl, description, answers, files: saved, status: 'PENDING' as const, createdAt: new Date() }
    await prisma.auditLog.create({ data: { userId: session.user.id, action: 'STUDY_MATERIAL_SUBMITTED', entityType: 'StudyMaterialSubmission', entityId: id, newValue: JSON.stringify(submission), ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] || null, userAgent: req.headers.get('user-agent') || null } })
    return NextResponse.json({ id, status: 'PENDING' }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    await removeMaterialFiles(saved.map((file) => file.id))
    return NextResponse.json({ error: error instanceof Error ? error.message : '上传失败' }, { status: 400 })
  }
}

function validJson(bytes: Uint8Array) { try { JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); return true } catch { return false } }
function validText(bytes: Uint8Array) { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true } catch { return false } }
