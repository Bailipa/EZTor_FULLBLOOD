import { loadEnvConfig } from '@next/env'
import { readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { parseExamContent } from '../src/features/study/examDomain'

loadEnvConfig(process.cwd(), true, { info() {}, error() {} })

async function main() {
  const root = process.cwd()
  const index = JSON.parse(await readFile(resolve(root, 'content/cet-original/index.json'), 'utf8'))
  const inputs = []
  for (const item of index.papers) {
    if (!/^[a-z0-9-]+\/paper\.json$/.test(item.file)) throw new Error('Invalid original paper path')
    const input = JSON.parse(await readFile(resolve(root, 'content/cet-original', item.file), 'utf8'))
    if (input.originType !== 'ORIGINAL' || input.slug !== item.slug) throw new Error('Original manifest mismatch')
    const parsed = parseExamContent(input.content, input.level, input.kind)
    const manifest = JSON.parse(await readFile(resolve(root, 'content/cet-original', item.file.replace('paper.json', 'audio-manifest.json')), 'utf8'))
    if (parsed.LISTENING.audio.some((audio) => audio.url !== manifest.url) || !item.audio.includes(manifest.url)) throw new Error('Audio manifest mismatch')
    const audio = await readFile(resolve(root, 'public', manifest.url.slice(1)))
    if (audio.length !== manifest.bytes || createHash('sha256').update(audio).digest('hex') !== manifest.sha256) throw new Error('Audio integrity check failed')
    inputs.push(input)
  }
  console.log(JSON.stringify({ validatedOriginalPapers: inputs.length }))
  if (!process.argv.includes('--import')) return
  const target = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/eztor_test' || process.env.NEXTAUTH_URL !== 'https://test.eztor.dogeggcode.cyou') throw new Error('Independent test database and domain required')
  const backupIndex = process.argv.indexOf('--backup')
  const backup = backupIndex < 0 ? undefined : process.argv[backupIndex + 1]
  if (!backup || !(await stat(backup)).isFile() || (await stat(backup)).size < 1024) throw new Error('Verified pre-import backup required')
  const { default: db } = await import('../src/lib/prisma')
  const { importExamPaper, reviewExamPaper } = await import('../src/services/study/ExamService')
  try {
    const admin = await db.user.findFirst({ where: { isAdmin: true, isBanned: false }, select: { id: true }, orderBy: { createdAt: 'asc' } })
    if (!admin) throw new Error('Test administrator required')
    for (const input of inputs) {
      const row = await importExamPaper(admin.id, input, db)
      const stored = await db.examPaper.findUniqueOrThrow({ where: { id: row.id }, select: { rightsStatus: true } })
      if (stored.rightsStatus !== 'APPROVED') await reviewExamPaper(admin.id, row.id, { rightsStatus: 'APPROVED', reviewEvidence: '用户2026-10-09明确授权本原创模拟卷接入测试站并默认向全体用户开放。已标注原创、非真题、虚构场景、合成听力、2025参考及难度待校准；结构/资源校验通过，不代表真人难度校准完成。' }, db)
      console.log(JSON.stringify({ imported: input.slug, id: row.id }))
    }
  } finally { await db.$disconnect() }
}
main().catch(() => { console.error('Original paper validation/import failed; no connection details emitted.'); process.exitCode = 1 })
