/**
 * 重新生成 SharedVocabulary + DefaultVocabulary
 * 适用于词已导入但分享代码缺失的情况
 *
 * 使用方法：
 *   npx tsx scripts/fix-share-codes.ts
 */

import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segmentLength = 3
  const segments = 3
  const randomBytes = crypto.randomBytes(segmentLength * segments)
  return Array(segments)
    .fill(null)
    .map((_, si) =>
      Array(segmentLength)
        .fill(null)
        .map((_, ci) => chars.charAt(randomBytes[si * segmentLength + ci] % chars.length))
        .join(''),
    )
    .join('-')
}

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateShareCode()
    const exists = await prisma.sharedVocabulary.findUnique({ where: { code } })
    if (!exists) return code
  }
  throw new Error('无法生成唯一分享码')
}

async function main() {
  const systemUser = await prisma.user.findUnique({ where: { username: 'system' } })
  if (!systemUser) {
    console.log('❌ 未找到 system 用户')
    return
  }

  const groups = await prisma.reviewGroup.findMany({
    where: { userId: systemUser.id },
    include: { _count: { select: { ReviewGroupWord: true } } },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`\n📋 ${groups.length} 个分组:\n`)
  for (const g of groups) {
    console.log(`   ${g.name}: ${g._count.ReviewGroupWord} 词`)
  }

  // 清理旧的 SharedVocabulary 和 DefaultVocabulary
  console.log(`\n🗑️  清理旧的 SharedVocabulary 和 DefaultVocabulary...`)
  await prisma.sharedVocabulary.deleteMany({ where: { userId: systemUser.id } })
  await prisma.defaultVocabulary.deleteMany()
  console.log('✅ 已清理')

  // 为每个分组创建 SharedVocabulary + DefaultVocabulary
  const nameMap: Record<string, { description: string; sortOrder: number }> = {
    '四级核心词汇': { description: '大学英语四级核心词汇', sortOrder: 1 },
    '六级核心词汇': { description: '大学英语六级核心词汇', sortOrder: 2 },
    '考研核心词汇': { description: '考研英语核心词汇', sortOrder: 3 },
    '考研英语词汇': { description: '考研英语完整词汇', sortOrder: 4 },
    '雅思核心词汇': { description: '雅思核心词汇', sortOrder: 5 },
  }

  console.log(`\n📝 生成分享码...`)
  for (const group of groups) {
    const code = await generateUniqueCode()
    const info = nameMap[group.name] || { description: group.name, sortOrder: 99 }

    await prisma.sharedVocabulary.create({
      data: {
        code,
        name: group.name,
        description: info.description,
        userId: systemUser.id,
        shareType: 'REVIEW_GROUP',
        reviewGroupId: group.id,
        wordCount: group._count.ReviewGroupWord,
        isActive: true,
        updatedAt: new Date(),
      },
    })

    await prisma.defaultVocabulary.create({
      data: {
        name: group.name,
        code,
        description: info.description,
        groupId: group.id,
        wordCount: group._count.ReviewGroupWord,
        isActive: true,
        sortOrder: info.sortOrder,
        updatedAt: new Date(),
      },
    })

    console.log(`   ${group.name}: ${code}`)
  }

  console.log(`\n✅ 完成!`)

  // 输出分享码列表
  const defaults = await prisma.defaultVocabulary.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { ReviewGroup: { include: { _count: { select: { ReviewGroupWord: true } } } } },
  })

  console.log(`\n📋 默认词库:\n`)
  console.log('─'.repeat(60))
  for (const d of defaults) {
    console.log(`${d.name}`)
    console.log(`   描述: ${d.description || '-'}`)
    console.log(`   分享码: ${d.code}`)
    console.log(`   词数: ${d.ReviewGroup._count.ReviewGroupWord}`)
    console.log('─'.repeat(60))
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
