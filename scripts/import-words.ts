/**
 * 导入脚本 - 将 words-export.json 导入到生产 PostgreSQL
 *
 * 使用方法：
 *   npx tsx scripts/import-words.ts
 *
 * 前提：data/words-export.json 已从本地 PostgreSQL 导出
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface WordExport {
  word: string
  phonetic: string | null
  pos: string | null
  translation: string | null
  example: string | null
  exampleTranslation: string | null
  correctCount: number
  incorrectCount: number
  totalAttempts: number
  sourceType: string
  groups: string[]
}

async function main() {
  const exportPath = path.resolve('data/words-export.json')
  if (!fs.existsSync(exportPath)) {
    console.log('❌ 未找到 data/words-export.json')
    return
  }

  console.log('\n========== 生产环境词库导入 ==========\n')

  // 1. 找到生产 system 用户
  let systemUser = await prisma.user.findUnique({ where: { username: 'system' } })
  if (!systemUser) {
    console.log('📝 创建 system 用户...')
    systemUser = await prisma.user.create({
      data: {
        username: 'system',
        password: 'system_password_not_for_login',
        isAdmin: true,
        updatedAt: new Date(),
      },
    })
  }
  console.log(`✅ system 用户 ID: ${systemUser.id}`)

  // 2. 清除现有 system 用户的词和关联
  const existingCount = await prisma.word.count({ where: { userId: systemUser.id } })
  if (existingCount > 0) {
    console.log(`\n🗑️  清除现有 ${existingCount} 个词...`)
    // 先删 ReviewGroupWord
    const existingWords = await prisma.word.findMany({
      where: { userId: systemUser.id },
      select: { id: true },
    })
    const wordIds = existingWords.map((w) => w.id)
    await prisma.reviewGroupWord.deleteMany({ where: { wordId: { in: wordIds } } })
    await prisma.word.deleteMany({ where: { userId: systemUser.id } })
    console.log('✅ 已清除')
  }

  // 也清除之前散落在其他用户下的词
  const otherWords = await prisma.word.count({
    where: { userId: { not: systemUser.id } },
  })
  if (otherWords > 0) {
    console.log(`🗑️  清除散落在其他用户下的 ${otherWords} 个词...`)
    const otherWordRecords = await prisma.word.findMany({
      where: { userId: { not: systemUser.id } },
      select: { id: true },
    })
    const otherWordIds = otherWordRecords.map((w) => w.id)
    await prisma.reviewGroupWord.deleteMany({ where: { wordId: { in: otherWordIds } } })
    await prisma.word.deleteMany({ where: { userId: { not: systemUser.id } } })
    console.log('✅ 已清除')
  }

  // 3. 读取导出数据
  console.log(`\n📖 读取 ${exportPath}...`)
  const data: WordExport[] = JSON.parse(fs.readFileSync(exportPath, 'utf-8'))
  console.log(`📊 ${data.length} 个词`)

  // 4. 确保分组存在
  const allGroups = new Set<string>()
  for (const w of data) {
    for (const g of w.groups) allGroups.add(g)
  }

  console.log(`\n📝 确保 ${allGroups.size} 个分组存在...`)
  const groupMap = new Map<string, string>()
  for (const groupName of allGroups) {
    let group = await prisma.reviewGroup.findUnique({
      where: { name_userId: { name: groupName, userId: systemUser.id } },
    })
    if (!group) {
      group = await prisma.reviewGroup.create({
        data: { name: groupName, userId: systemUser.id, updatedAt: new Date() },
      })
      console.log(`   创建: ${groupName}`)
    }
    groupMap.set(groupName, group.id)
  }

  // 5. 批量导入词
  console.log(`\n📝 批量导入词...`)
  let imported = 0
  let skipped = 0
  const batchSize = 200

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)

    await prisma.$transaction(async (tx) => {
      for (const w of batch) {
        const word = await tx.word.create({
          data: {
            word: w.word,
            phonetic: w.phonetic,
            pos: w.pos,
            translation: w.translation,
            example: w.example,
            exampleTranslation: w.exampleTranslation,
            correctCount: w.correctCount || 0,
            incorrectCount: w.incorrectCount || 0,
            totalAttempts: w.totalAttempts || 0,
            sourceType: w.sourceType || 'USER',
            userId: systemUser.id,
            updatedAt: new Date(),
          },
        })

        // 创建分组关联
        const toCreate: { reviewGroupId: string; wordId: string }[] = []
        for (const groupName of w.groups) {
          const groupId = groupMap.get(groupName)
          if (groupId) {
            toCreate.push({ reviewGroupId: groupId, wordId: word.id })
          }
        }
        if (toCreate.length > 0) {
          await tx.reviewGroupWord.createMany({ data: toCreate })
        }

        imported++
      }
    })

    const done = Math.min(i + batchSize, data.length)
    console.log(`   进度: ${done}/${data.length} (${Math.round((done / data.length) * 100)}%)`)
  }

  console.log(`\n✅ 导入完成! ${imported} 个词`)

  // 6. 删除其他用户的孤立 Word (如果有非 system 用户的词没在 Step 2 清除)
  const remaining = await prisma.word.count({ where: { userId: { not: systemUser.id } } })
  if (remaining > 0) {
    console.log(`🗑️  清理剩余孤立词: ${remaining}`)
    const ids = (await prisma.word.findMany({ where: { userId: { not: systemUser.id } }, select: { id: true } })).map(w => w.id)
    await prisma.reviewGroupWord.deleteMany({ where: { wordId: { in: ids } } })
    await prisma.word.deleteMany({ where: { userId: { not: systemUser.id } } })
  }

  // 7. 验证
  const finalCount = await prisma.word.count({ where: { userId: systemUser.id } })
  const rgwCount = await prisma.reviewGroupWord.count({
    where: { ReviewGroup: { userId: systemUser.id } },
  })
  console.log(`\n📊 验证:`)
  console.log(`   system 用户词数: ${finalCount}`)
  console.log(`   ReviewGroupWord 数: ${rgwCount}`)

  const groups = await prisma.reviewGroup.findMany({
    where: { userId: systemUser.id },
    include: { _count: { select: { ReviewGroupWord: true } } },
    orderBy: { name: 'asc' },
  })
  for (const g of groups) {
    console.log(`   ${g.name}: ${g._count.ReviewGroupWord} 词`)
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
