/**
 * 词库修复脚本 - 将散落词重新绑定到正确的 system 用户并建立分组关联
 *
 * 使用方法：
 *   npx tsx scripts/fix-word-userid.ts
 *
 * 前提：需要 data/word_groups.json（从本地 DB 导出的 word→group 映射）
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface GroupMapping {
  group: string
  words: string[]
}

async function main() {
  const mappingPath = path.resolve('data/word_groups.json')
  if (!fs.existsSync(mappingPath)) {
    console.log('❌ 需要 data/word_groups.json 文件（从本地 DB 导出的词→分组映射）')
    return
  }

  console.log('\n========== 词库修复脚本 ==========\n')

  // 1. 从 ReviewGroup 找到正确的 system 用户
  const rg = await prisma.reviewGroup.findFirst({
    where: { User: { username: 'system' } },
    select: { userId: true, id: true, name: true },
  })
  if (!rg) {
    console.log('❌ 未找到 system 用户的 ReviewGroup')
    return
  }
  const correctId = rg.userId
  console.log(`✅ 正确 system 用户 ID: ${correctId}`)

  // 2. 查看 Word 分布情况
  const wordDistribution = await prisma.word.groupBy({
    by: ['userId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })
  console.log(`\n📊 当前 Word 分布:`)
  for (const w of wordDistribution) {
    const user = await prisma.user.findUnique({ where: { id: w.userId }, select: { username: true } })
    const marker = w.userId === correctId ? ' ← system' : ''
    console.log(`   ${w.userId} (${user?.username || '?'}): ${w._count.id} 词${marker}`)
  }

  const wrongIds = wordDistribution.filter((w) => w.userId !== correctId).map((w) => w.userId)

  if (wrongIds.length === 0) {
    console.log('✅ 所有词已在 system 用户下，无需迁移')
  } else {
    // 3. 删除 system 用户下已有的冲突词（种子脚本的 5 词）
    const correctCount = await prisma.word.count({ where: { userId: correctId } })
    if (correctCount > 0) {
      console.log(`\n🗑️  删除 system 用户下 ${correctCount} 个冲突词...`)
      // 先删 ReviewGroupWord，再删 Word
      const correctWords = await prisma.word.findMany({ where: { userId: correctId }, select: { id: true } })
      const correctWordIds = correctWords.map((w) => w.id)
      await prisma.reviewGroupWord.deleteMany({ where: { wordId: { in: correctWordIds } } })
      await prisma.word.deleteMany({ where: { userId: correctId } })
      console.log('✅ 已删除')
    }

    // 4. 逐个迁移：先迁移第一个大用户，后面用户要先去重
    console.log(`\n🔧 开始迁移词到 system 用户...`)
    let systemWords = new Set<string>()

    // 先获取 system 用户现有词（此时应为空，因为刚删了）
    const existingSystemWords = await prisma.word.findMany({
      where: { userId: correctId },
      select: { word: true },
    })
    systemWords = new Set(existingSystemWords.map((w) => w.word))

    for (const wrongId of wrongIds) {
      const wrongWords = await prisma.word.findMany({
        where: { userId: wrongId },
        select: { id: true, word: true },
      })

      // 找出与 system 用户已有词重复的
      const duplicates = wrongWords.filter((w) => systemWords.has(w.word))
      if (duplicates.length > 0) {
        const dupIds = duplicates.map((w) => w.id)
        await prisma.reviewGroupWord.deleteMany({ where: { wordId: { in: dupIds } } })
        await prisma.word.deleteMany({ where: { id: { in: dupIds } } })
      }

      // 迁移剩余的
      const toMove = wrongWords.filter((w) => !systemWords.has(w.word))
      if (toMove.length > 0) {
        const moveIds = toMove.map((w) => w.id)
        await prisma.word.updateMany({
          where: { id: { in: moveIds } },
          data: { userId: correctId },
        })
        for (const w of toMove) systemWords.add(w.word)
      }

      const moved = toMove.length
      const skipped = duplicates.length
      console.log(`   ${wrongId}: 迁移 ${moved} 词，跳过重复 ${skipped} 词`)
    }

    console.log(`✅ 迁移完成! system 用户现有 ${systemWords.size} 个不同词`)
  }

  // 5. 读取词→分组映射并创建 ReviewGroupWord 关联
  console.log(`\n📖 读取词→分组映射: ${mappingPath}`)
  const mappings: GroupMapping[] = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))

  console.log(`📊 共 ${mappings.length} 个分组`)
  let totalCreated = 0

  for (const mapping of mappings) {
    // 确保分组存在
    let reviewGroup = await prisma.reviewGroup.findUnique({
      where: { name_userId: { name: mapping.group, userId: correctId } },
    })

    if (!reviewGroup) {
      console.log(`   📝 创建分组: ${mapping.group}`)
      reviewGroup = await prisma.reviewGroup.create({
        data: { name: mapping.group, userId: correctId },
      })
    }

    // 获取已有关联
    const existing = new Set(
      (await prisma.reviewGroupWord.findMany({
        where: { reviewGroupId: reviewGroup.id },
        select: { wordId: true },
      })).map((r) => r.wordId),
    )

    // 批量查找词ID
    const wordMap = new Map<string, string>()
    const words = mapping.words
    for (let i = 0; i < words.length; i += 500) {
      const batch = words.slice(i, i + 500)
      const dbWords = await prisma.word.findMany({
        where: { userId: correctId, word: { in: batch } },
        select: { id: true, word: true },
      })
      for (const w of dbWords) wordMap.set(w.word, w.id)
    }

    // 准备创建
    const toCreate: { reviewGroupId: string; wordId: string }[] = []
    let notFound = 0
    for (const w of words) {
      const wid = wordMap.get(w)
      if (!wid) { notFound++; continue }
      if (existing.has(wid)) continue
      toCreate.push({ reviewGroupId: reviewGroup.id, wordId: wid })
      existing.add(wid)
    }

    // 批量插入
    if (toCreate.length > 0) {
      for (let i = 0; i < toCreate.length; i += 500) {
        await prisma.reviewGroupWord.createMany({
          data: toCreate.slice(i, i + 500),
          skipDuplicates: true,
        })
      }
    }

    totalCreated += toCreate.length
    console.log(`   📚 ${mapping.group}: 新建 ${toCreate.length} 关联${notFound > 0 ? `, DB中缺失 ${notFound} 词` : ''}`)
  }

  console.log(`\n✅ 完成! 共创建 ${totalCreated} 个 ReviewGroupWord 关联`)

  // 6. 验证
  const finalCount = await prisma.word.count({ where: { userId: correctId } })
  const rgwCount = await prisma.reviewGroupWord.count({
    where: { ReviewGroup: { userId: correctId } },
  })
  console.log(`\n📊 最终状态:`)
  console.log(`   system 用户词数: ${finalCount}`)
  console.log(`   ReviewGroupWord 关联数: ${rgwCount}`)

  const groups = await prisma.reviewGroup.findMany({
    where: { userId: correctId },
    include: { _count: { select: { ReviewGroupWord: true } } },
    orderBy: { name: 'asc' },
  })
  for (const g of groups) {
    console.log(`   ${g.name}: ${g._count.ReviewGroupWord} 词`)
  }
}

main()
  .catch((e) => {
    console.error('❌ 失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
