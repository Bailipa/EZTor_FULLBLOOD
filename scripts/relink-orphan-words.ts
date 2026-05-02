/**
 * 重连脚本：将 publicWordId 为 null 的 Word 记录链接到 PublicWord
 *
 * 功能：
 *   1. 按 word 名匹配孤儿 Word → 同名 PublicWord → 设置 publicWordId
 *   2. 匹配不上的极少数词 → 从 Word 自身字段创建 PublicWord
 *   3. 可选：null 出与 PublicWord 相同的 Word 字段（镜像模式清理）
 *
 * 使用方法：
 *   # 自动模式（先 dry-run 看数据量）
 *   npx tsx scripts/relink-orphan-words.ts --dry-run
 *
 *   # 正式运行
 *   npx tsx scripts/relink-orphan-words.ts
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient({ log: ['warn', 'error'] })

const BATCH_SIZE = 500

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('========================================')
  console.log('孤儿 Word 重连工具')
  console.log('========================================')

  if (dryRun) console.log('\n⚡ DRY RUN 模式：只扫描不写入\n')

  const orphans = await prisma.word.findMany({
    where: { publicWordId: null },
    select: { id: true, word: true, phonetic: true, pos: true, translation: true, example: true, exampleTranslation: true, userId: true },
  })

  console.log(`📊 找到 ${orphans.length} 条 publicWordId = null 的记录\n`)

  if (orphans.length === 0) {
    console.log('✅ 没有需要处理的记录')
    await prisma.$disconnect()
    return
  }

  // 收集所有词名，批量查 PublicWord
  const uniqueWords = [...new Set(orphans.map((w) => w.word.toLowerCase()))]
  const publicWords = await prisma.publicWord.findMany({
    where: {
      word: { in: uniqueWords, mode: 'insensitive' },
    },
    select: { id: true, word: true, translation: true },
  })
  const publicWordMap = new Map(publicWords.map((pw) => [pw.word.toLowerCase(), pw]))

  // 统计
  let linked = 0
  let created = 0
  let skipped = 0

  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    const batch = orphans.slice(i, i + BATCH_SIZE)
    const updates: Array<{ id: string; publicWordId: string }> = []

    for (const w of batch) {
      const key = w.word.toLowerCase()
      const pw = publicWordMap.get(key)

      if (pw) {
        // 情况 1：公共词库已有 → 链接
        updates.push({ id: w.id, publicWordId: pw.id })
        linked++
      } else if (w.translation) {
        // 情况 2：没有公共词库 → 新建 PublicWord
        if (!dryRun) {
          const newPw = await prisma.publicWord.create({
            data: {
              id: randomUUID(),
              word: w.word,
              phonetic: w.phonetic || '',
              pos: w.pos || '',
              translation: w.translation || '',
              example: w.example || '',
              exampleTranslation: w.exampleTranslation || '',
              qualityScore: 50,
              updatedAt: new Date(),
            },
          })
          updates.push({ id: w.id, publicWordId: newPw.id })
          publicWordMap.set(key, newPw)
        }
        created++
      } else {
        // 情况 3：没有任何数据 → 跳过
        skipped++
      }
    }

    if (!dryRun && updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.word.update({
            where: { id: u.id },
            data: { publicWordId: u.publicWordId },
          }),
        ),
      )
    }

    console.log(`  已处理 ${Math.min(i + BATCH_SIZE, orphans.length)}/${orphans.length}`)
  }

  console.log('\n========================================')
  console.log('📊 结果：')
  console.log(`   链接到已有 PublicWord：${linked}`)
  console.log(`   新建 PublicWord 并链接：${created}`)
  console.log(`   跳过（无有效翻译数据）：${skipped}`)
  console.log('========================================')

  if (dryRun) {
    console.log('\n⚠️  以上为 DRY RUN，未实际写入。使用不带 --dry-run 参数正式运行。')
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('❌ 脚本执行失败:', err)
  process.exit(1)
})
