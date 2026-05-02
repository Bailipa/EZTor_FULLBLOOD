/**
 * 更新词库 wordCount 字段为实际单词数
 *
 * 功能：
 * 1. 读取每个默认词库的实际单词数
 * 2. 更新 DefaultVocabulary 和 SharedVocabulary 中的 wordCount 字段
 *
 * 使用方法：
 * npx tsx scripts/update-wordcount.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 开始更新词库 wordCount 字段...')

  // 获取所有默认词库
  const defaultVocabularies = await prisma.defaultVocabulary.findMany({
    include: {
      reviewGroup: {
        include: {
          _count: {
            select: { words: true },
          },
        },
      },
    },
  })

  console.log(`📊 找到 ${defaultVocabularies.length} 个默认词库`)

  for (const vocab of defaultVocabularies) {
    const actualWordCount = vocab.reviewGroup._count.words
    const currentWordCount = vocab.wordCount

    console.log(`\n📚 词库：${vocab.name}`)
    console.log(`   当前 wordCount: ${currentWordCount}`)
    console.log(`   实际单词数: ${actualWordCount}`)

    if (currentWordCount !== actualWordCount) {
      console.log(`   🔄 更新 wordCount 为 ${actualWordCount}...`)

      // 更新 DefaultVocabulary
      await prisma.defaultVocabulary.update({
        where: { id: vocab.id },
        data: { wordCount: actualWordCount },
      })

      // 查找对应的 SharedVocabulary
      const sharedVocab = await prisma.sharedVocabulary.findUnique({
        where: { code: vocab.code },
      })

      if (sharedVocab) {
        await prisma.sharedVocabulary.update({
          where: { id: sharedVocab.id },
          data: { wordCount: actualWordCount },
        })
        console.log(`   ✅ 已更新 SharedVocabulary`)
      }

      console.log(`   ✅ 更新完成`)
    } else {
      console.log(`   ℹ️  无需更新，wordCount 已经正确`)
    }
  }

  console.log('\n✅ 词库 wordCount 字段更新完成！')

  // 显示更新后的状态
  const updatedVocabularies = await prisma.defaultVocabulary.findMany({
    include: {
      reviewGroup: {
        include: {
          _count: {
            select: { words: true },
          },
        },
      },
    },
  })

  console.log('\n📋 更新后的词库状态：')
  console.log('─'.repeat(80))
  updatedVocabularies.forEach((vocab, index) => {
    console.log(`${index + 1}. ${vocab.name}`)
    console.log(`   密钥：${vocab.code}`)
    console.log(`   wordCount：${vocab.wordCount}`)
    console.log(`   实际单词数：${vocab.reviewGroup._count.words}`)
    console.log(
      `   状态：${vocab.wordCount === vocab.reviewGroup._count.words ? '✅ 正确' : '❌ 不一致'}`,
    )
    console.log('─'.repeat(80))
  })
}

main()
  .catch((e) => {
    console.error('❌ 脚本执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
