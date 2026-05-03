/**
 * 导出脚本 - 从本地 PostgreSQL 导出 system 用户的所有词和分组关联
 *
 * 使用方法：
 *   npx tsx scripts/export-words.ts
 *
 * 输出：data/words-export.json
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const systemUser = await prisma.user.findUnique({ where: { username: 'system' } })
  if (!systemUser) {
    console.log('❌ 未找到 system 用户')
    return
  }
  console.log(`system 用户 ID: ${systemUser.id}`)

  const groups = await prisma.reviewGroup.findMany({
    where: { userId: systemUser.id },
    orderBy: { name: 'asc' },
  })
  console.log(`分组: ${groups.map((g) => g.name).join(', ')}`)

  // 导出所有词（含字段）和分组关联
  const words = await prisma.word.findMany({
    where: { userId: systemUser.id },
    orderBy: { word: 'asc' },
    include: {
      ReviewGroupWord: {
        include: { ReviewGroup: { select: { name: true } } },
      },
    },
  })
  console.log(`词数: ${words.length}`)

  const exportData = words.map((w) => ({
    word: w.word,
    phonetic: w.phonetic,
    pos: w.pos,
    translation: w.translation,
    example: w.example,
    exampleTranslation: w.exampleTranslation,
    correctCount: w.correctCount,
    incorrectCount: w.incorrectCount,
    totalAttempts: w.totalAttempts,
    sourceType: w.sourceType,
    groups: w.ReviewGroupWord.map((rgw) => rgw.ReviewGroup.name),
  }))

  fs.writeFileSync('data/words-export.json', JSON.stringify(exportData, null, 2))
  console.log(`✅ 已导出到 data/words-export.json (${exportData.length} 词)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
