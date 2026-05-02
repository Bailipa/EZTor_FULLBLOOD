/**
 * 默认词库种子脚本
 *
 * 功能：
 * 1. 创建 3 个默认 ReviewGroup（四六级、雅思、考研）
 * 2. 导入词汇数据
 * 3. 生成 SharedVocabulary 记录
 * 4. 创建 DefaultVocabulary 配置
 *
 * 使用方法：
 * npx tsx scripts/seed-default-vocabularies.ts
 */

import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

// 默认词库配置
const DEFAULT_VOCABULARIES = [
  {
    name: '大学英语四六级核心词汇',
    description: '包含 CET-4 和 CET-6 核心词汇，约 8000 词',
    groupName: '四六级核心词汇',
    wordCount: 8000,
    sortOrder: 1,
  },
  {
    name: '雅思核心词汇',
    description: '雅思考试高频词汇，约 4000 词',
    groupName: '雅思核心词汇',
    wordCount: 4000,
    sortOrder: 2,
  },
  {
    name: '考研核心词汇',
    description: '硕士研究生入学考试核心词汇，约 5500 词',
    groupName: '考研核心词汇',
    wordCount: 5500,
    sortOrder: 3,
  },
]

// 生成分享密钥
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除 0/O, 1/I/l
  const segmentLength = 3
  const segments = 3

  const randomBytes = crypto.randomBytes(segmentLength * segments)

  const code = Array(segments)
    .fill(null)
    .map((_, segmentIndex) => {
      return Array(segmentLength)
        .fill(null)
        .map((_, charIndex) => {
          const byteIndex = segmentIndex * segmentLength + charIndex
          const charCode = randomBytes[byteIndex] % chars.length
          return chars.charAt(charCode)
        })
        .join('')
    })
    .join('-')

  return code
}

// 生成唯一密钥
async function generateUniqueCode(): Promise<string> {
  let retries = 0
  const maxRetries = 3

  while (retries < maxRetries) {
    const code = generateShareCode()

    const existing = await prisma.sharedVocabulary.findUnique({
      where: { code },
    })

    if (!existing) {
      return code
    }

    retries++
  }

  throw new Error('Failed to generate unique code after multiple attempts')
}

// 示例词汇数据（实际使用时应从文件导入）
const SAMPLE_WORDS = [
  {
    word: 'abandon',
    phonetic: '/əˈbændən/',
    pos: 'v.',
    translation: '抛弃，舍弃，放弃',
    example: 'He abandoned his car in the snow.',
    exampleTranslation: '他在雪地中抛弃了他的车。',
  },
  {
    word: 'ability',
    phonetic: '/əˈbɪləti/',
    pos: 'n.',
    translation: '能力，本领，才能',
    example: 'She has the ability to pass the exam.',
    exampleTranslation: '她有能力通过考试。',
  },
  {
    word: 'abnormal',
    phonetic: '/æbˈnɔːrməl/',
    pos: 'adj.',
    translation: '反常的，异常的',
    example: 'The weather has been abnormal this year.',
    exampleTranslation: '今年的天气一直反常。',
  },
  {
    word: 'aboard',
    phonetic: '/əˈbɔːrd/',
    pos: 'adv./prep.',
    translation: '在船（车）上，上船',
    example: 'Welcome aboard!',
    exampleTranslation: '欢迎登机（车、船）！',
  },
  {
    word: 'abroad',
    phonetic: '/əˈbrɔːd/',
    pos: 'adv.',
    translation: '到国外，在国外',
    example: 'She plans to study abroad next year.',
    exampleTranslation: '她计划明年出国留学。',
  },
]

async function main() {
  console.log('🌱 开始导入默认词库...')

  // 获取或创建系统管理员用户
  let systemUser = await prisma.user.findUnique({
    where: { username: 'system' },
  })

  if (!systemUser) {
    console.log('📝 创建系统用户...')
    systemUser = await prisma.user.create({
      data: {
        username: 'system',
        password: 'system_password_not_for_login', // 不用于登录
        isAdmin: true,
      },
    })
    console.log('✅ 系统用户创建成功')
  }

  console.log(`📊 当前数据库中有 ${DEFAULT_VOCABULARIES.length} 个默认词库待导入`)

  for (const vocabConfig of DEFAULT_VOCABULARIES) {
    console.log(`\n📚 处理词库：${vocabConfig.name}`)

    try {
      // 1. 创建或获取 ReviewGroup
      let reviewGroup = await prisma.reviewGroup.findUnique({
        where: {
          name_userId: {
            name: vocabConfig.groupName,
            userId: systemUser.id,
          },
        },
      })

      if (!reviewGroup) {
        console.log(`  📝 创建复习分组：${vocabConfig.groupName}`)
        reviewGroup = await prisma.reviewGroup.create({
          data: {
            name: vocabConfig.groupName,
            userId: systemUser.id,
          },
        })
        console.log(`  ✅ 分组创建成功 (ID: ${reviewGroup.id})`)
      } else {
        console.log(`  ℹ️  分组已存在 (ID: ${reviewGroup.id})`)
      }

      // 2. 导入示例词汇（实际应从文件导入完整词库）
      console.log(`  📝 导入示例词汇 (${SAMPLE_WORDS.length} 个)...`)

      let importedCount = 0
      let skippedCount = 0

      for (const wordData of SAMPLE_WORDS) {
        try {
          // 检查单词是否已存在
          const existingWord = await prisma.word.findUnique({
            where: {
              word_userId: {
                word: wordData.word.toLowerCase(),
                userId: systemUser.id,
              },
            },
          })

          if (existingWord) {
            skippedCount++
            continue
          }

          // 创建单词
          const word = await prisma.word.create({
            data: {
              word: wordData.word.toLowerCase(),
              phonetic: wordData.phonetic,
              pos: wordData.pos,
              translation: wordData.translation,
              example: wordData.example,
              exampleTranslation: wordData.exampleTranslation,
              userId: systemUser.id,
            },
          })

          // 创建分组关联
          await prisma.reviewGroupWord.create({
            data: {
              reviewGroupId: reviewGroup.id,
              wordId: word.id,
            },
          })

          importedCount++
        } catch (error) {
          console.error(`    ⚠️  导入单词 "${wordData.word}" 失败:`, error)
        }
      }

      console.log(`  ✅ 词汇导入完成：导入 ${importedCount} 个，跳过 ${skippedCount} 个`)

      // 3. 检查是否已存在 SharedVocabulary
      const existingShare = await prisma.sharedVocabulary.findFirst({
        where: {
          reviewGroupId: reviewGroup.id,
          userId: systemUser.id,
        },
      })

      let shareCode: string

      if (existingShare) {
        console.log(`  ℹ️  分享记录已存在 (Code: ${existingShare.code})`)
        shareCode = existingShare.code
      } else {
        // 4. 生成分享密钥
        console.log(`  📝 生成分享密钥...`)
        shareCode = await generateUniqueCode()

        const _sharedVocab = await prisma.sharedVocabulary.create({
          data: {
            code: shareCode,
            name: vocabConfig.name,
            description: vocabConfig.description,
            userId: systemUser.id,
            shareType: 'REVIEW_GROUP',
            reviewGroupId: reviewGroup.id,
            wordCount: importedCount, // 实际词汇数
            maxUses: null, // 不限制
            expiresAt: null, // 永久有效
            isActive: true,
          },
        })

        console.log(`  ✅ 分享密钥生成成功：${shareCode}`)
      }

      // 5. 创建或更新 DefaultVocabulary 配置
      const existingDefault = await prisma.defaultVocabulary.findUnique({
        where: { code: shareCode },
      })

      if (!existingDefault) {
        console.log(`  📝 创建默认词库配置...`)
        await prisma.defaultVocabulary.create({
          data: {
            name: vocabConfig.name,
            code: shareCode,
            description: vocabConfig.description,
            groupId: reviewGroup.id,
            wordCount: importedCount,
            isActive: true,
            sortOrder: vocabConfig.sortOrder,
          },
        })
        console.log(`  ✅ 默认词库配置创建成功`)
      } else {
        console.log(`  ℹ️  默认词库配置已存在`)
      }
    } catch (error) {
      console.error(`❌ 处理词库 "${vocabConfig.name}" 时出错:`, error)
    }
  }

  console.log('\n✅ 默认词库导入完成！')

  // 显示所有默认词库
  const defaults = await prisma.defaultVocabulary.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      reviewGroup: true,
    },
  })

  console.log('\n📋 默认词库列表：')
  console.log('─'.repeat(80))
  defaults.forEach((d: any, i: number) => {
    console.log(`${i + 1}. ${d.name}`)
    console.log(`   描述：${d.description || '无'}`)
    console.log(`   词汇数：${d.wordCount}`)
    console.log(`   密钥：${d.code}`)
    console.log(`   分组：${d.reviewGroup.name}`)
    console.log('─'.repeat(80))
  })
}

main()
  .catch((e) => {
    console.error('❌ 种子脚本执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
