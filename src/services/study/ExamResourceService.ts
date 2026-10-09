import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { link, mkdir, open, realpath, stat, statfs, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { StudyInputError } from '@/features/study/domain'
import type { ExamContent } from '@/features/study/examTypes'
import { legacyResourceKeys } from './legacyExamResources'

export const MAX_EXAM_RESOURCE_BYTES = 80 * 1024 * 1024
// Production must point this at the persistent shared directory (or use its existing public/study symlink).
export function examResourceRoot() {
  const configured = process.env.STUDY_RESOURCE_DIR
  if (configured && !path.isAbsolute(configured)) throw new StudyInputError('STUDY_RESOURCE_DIR必须为绝对路径')
  return configured || path.join(process.cwd(), 'public', 'study', 'resources')
}
async function fileHash(file: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
function validSignature(bytes: Buffer, extension: string) {
  if (extension === 'm4a') return bytes.subarray(4, 8).toString('ascii') === 'ftyp'
  return bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
}
export async function uploadExamResource(req: Request, userId: string) {
  const expected = req.headers.get('x-resource-sha256') || ''
  const extension = req.headers.get('x-resource-extension') || ''
  if (!/^[a-f0-9]{64}$/.test(expected) || !['mp3', 'm4a'].includes(extension))
    throw new StudyInputError('请选择MP3或M4A音频，并提供SHA-256')
  const announced = Number(req.headers.get('content-length'))
  if (announced > MAX_EXAM_RESOURCE_BYTES) throw new StudyInputError('资源不能超过80 MiB', 413)
  const reader = req.body?.getReader()
  if (!reader) throw new StudyInputError('资源为空')
  const root = examResourceRoot()
  let temp: string | undefined
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    await mkdir(root, { recursive: true })
    if (process.env.NODE_ENV === 'production') {
      const resolved = await realpath(root), release = path.resolve(process.cwd())
      const relative = path.relative(release, resolved)
      if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)))
        throw new StudyInputError('请先将听力目录配置到发布目录之外的持久化共享目录', 503)
    }
    const disk = await statfs(root)
    if (disk.bavail * disk.bsize < MAX_EXAM_RESOURCE_BYTES + 256 * 1024 * 1024)
      throw new StudyInputError('服务器可用空间不足，暂不能上传', 507)
    temp = path.join(root, `.upload-${randomUUID()}`)
    handle = await open(temp, 'wx', 0o600)
    const hash = createHash('sha256')
    let bytes = 0, signature = Buffer.alloc(0)
    while (true) {
      const next = await reader.read()
      if (next.done) break
      const chunk = Buffer.from(next.value)
      bytes += chunk.length
      if (bytes > MAX_EXAM_RESOURCE_BYTES) throw new StudyInputError('资源不能超过80 MiB', 413)
      if (signature.length < 16) signature = Buffer.concat([signature, chunk.subarray(0, 16 - signature.length)])
      hash.update(chunk)
      await handle.writeFile(chunk)
    }
    const sha256 = hash.digest('hex')
    if (bytes < 16 || !validSignature(signature, extension)) throw new StudyInputError('文件内容与所选格式不符')
    if (sha256 !== expected) throw new StudyInputError('资源校验不一致，请重新上传')
    const filename = `${sha256.slice(0, 24)}.${extension}`
    const destination = path.join(root, filename)
    await handle.sync(); await handle.close(); handle = undefined
    // Atomic publication without replacing any file referenced by an existing paper.
    try { await link(temp, destination) } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (await fileHash(destination) !== sha256) throw new StudyInputError('资源标识冲突，原文件未覆盖', 409)
    }
    const contentType = extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4'
    await prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({ where: { id: userId }, select: { isAdmin: true, isBanned: true, banExpiresAt: true } })
      if (!account?.isAdmin || account.isBanned && (!account.banExpiresAt || account.banExpiresAt > new Date()))
        throw new StudyInputError('当前账号无法上传资源', 403)
      const old = await tx.examResource.findUnique({ where: { filename } })
      if (old && (old.sha256 !== sha256 || old.bytes !== bytes)) throw new StudyInputError('资源登记冲突', 409)
      if (!old) {
        const stored = await tx.examResource.upsert({ where: { filename }, create: { filename, sha256, bytes, contentType }, update: {} })
        if (stored.sha256 !== sha256 || stored.bytes !== bytes) throw new StudyInputError('资源登记冲突', 409)
        await tx.auditLog.create({ data: { userId, action: 'EXAM_RESOURCE_UPLOAD', entityType: 'ExamResource', entityId: filename, newValue: JSON.stringify({ sha256, bytes }) } })
      }
    })
    return { filename, url: `/study/resources/${filename}`, sha256, bytes }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
    await handle?.close()
    if (temp) await unlink(temp).catch(() => {})
  }
}

// Link uploaded files to immutable paper versions. Compatibility entries need no backfill.
export async function linkExamResources(tx: Prisma.TransactionClient, paperId: string, content: ExamContent) {
  const urls = new Set(Object.values(content).flatMap((section) => section.audio.map((audio) => audio.url)))
  for (const url of urls) {
    if (!url.startsWith('/study/resources/')) continue // Existing HTTPS and legacy /study/audio sources retain their behaviour.
    const filename = url.slice('/study/resources/'.length)
    if (!/^[a-f0-9]{24}\.(mp3|m4a)$/.test(filename)) throw new StudyInputError('音频资源地址无效')
    const resource = await tx.examResource.findUnique({ where: { filename } })
    const file = path.join(examResourceRoot(), filename)
    const info = await stat(file).catch(() => null)
    if (!info?.isFile() || (resource && info.size !== resource.bytes)) throw new StudyInputError(`音频资源缺失或大小不一致：${filename}，请先上传`)
    if (resource) {
      if (await fileHash(file) !== resource.sha256) throw new StudyInputError(`音频校验失败：${filename}`)
      await tx.examPaperResource.upsert({ where: { paperId_filename: { paperId, filename } }, create: { paperId, filename }, update: {} })
    } else if (!legacyResourceKeys.has(url)) throw new StudyInputError(`音频尚未登记：${filename}，请先上传`)
  }
}
