import { loadEnvConfig } from '@next/env'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

loadEnvConfig(process.cwd(), true, { info() {}, error() {} })

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/eztor') throw new Error('Local eztor database only')
  const { parseExamContent } = await import('../src/features/study/examDomain')
  const directory = resolve('content/cet-local/papers')
  const inputs = await Promise.all((await readdir(directory)).filter((name) => name.endsWith('.json')).sort().map(async (name) => JSON.parse(await readFile(resolve(directory, name), 'utf8'))))
  const manifest = JSON.parse(await readFile(resolve('content/cet-local/index.json'), 'utf8'))
  const expected = manifest.items.map((item: { key: string }) => `${item.key}-full`).sort()
  if (JSON.stringify(inputs.map((input) => input.slug).sort()) !== JSON.stringify(expected)) throw new Error('Paper packages must match the local source manifest')
  for (const input of inputs) {
    try { parseExamContent(input.content, input.level, input.kind) }
    catch (error) { throw new Error(`${input.slug}: ${error instanceof Error ? error.message : error}`) }
  }
  console.log(JSON.stringify({ validated: inputs.length }))
  if (!process.argv.includes('--import')) return
  const { default: db } = await import('../src/lib/prisma')
  const { importExamPaper, reviewExamPaper } = await import('../src/services/study/ExamService')
  try {
    const admin = await db.user.findFirst({ where: { isAdmin: true, isBanned: false }, select: { id: true }, orderBy: { createdAt: 'asc' } })
    if (!admin) throw new Error('Local administrator required')
    for (const input of inputs) {
      const row = await importExamPaper(admin.id, input, db)
      const stored = await db.examPaper.findUniqueOrThrow({ where: { id: row.id }, select: { rightsStatus: true } })
      if (stored.rightsStatus !== 'APPROVED') await reviewExamPaper(admin.id, row.id, { rightsStatus: 'APPROVED', reviewEvidence: '按用户明确要求接入本地做题与切换；源文件、哈希和转换状态见 content/cet-local；未核对答案明确不计分，缺失章节保留原卷说明。未部署生产。' }, db)
      console.log(`Imported: ${input.slug}`)
    }
    const approved = await db.examPaper.findMany({ where: { slug: { in: inputs.map((input) => input.slug) }, rightsStatus: 'APPROVED' }, select: { slug: true } })
    console.log(JSON.stringify({ approvedPapers: new Set(approved.map((paper) => paper.slug)).size, approvedVersions: approved.length }))
  } finally { await db.$disconnect() }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
