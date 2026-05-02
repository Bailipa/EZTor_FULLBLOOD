/**
 * 默认词库完整导入脚本
 *
 * 功能：
 * 1. 从 JSON 文件读取完整词汇数据
 * 2. 批量导入词汇（使用事务优化性能）
 * 3. 创建 ReviewGroup、SharedVocabulary、DefaultVocabulary
 *
 * 使用方法：
 * npx tsx scripts/seed-default-vocabularies-full.ts [json-file-path]
 *
 * 示例：
 * npx tsx scripts/seed-default-vocabularies-full.ts data/default-vocabularies.full.json
 */

import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// 生成分享密钥
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
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

// 批量导入词汇（使用事务优化）
async function batchImportWords(
  userId: string,
  groupId: string,
  words: Array<any>,
): Promise<{ imported: number; skipped: number }> {
  const batchSize = 100
  let imported = 0
  let skipped = 0

  // 优化 SQLite 性能
  await prisma.$executeRaw`PRAGMA synchronous = OFF`
  await prisma.$executeRaw`PRAGMA journal_mode = MEMORY`

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < words.length; i += batchSize) {
        const batch = words.slice(i, i + batchSize)

        for (const wordData of batch) {
          const normalizedWord = wordData.word.toLowerCase().trim()

          // 检查是否已存在
          const existing = await tx.word.findUnique({
            where: {
              word_userId: {
                word: normalizedWord,
                userId,
              },
            },
          })

          if (existing) {
            skipped++
            continue
          }

          // 创建单词
          const word = await tx.word.create({
            data: {
              word: normalizedWord,
              phonetic: wordData.phonetic,
              pos: wordData.pos,
              translation: wordData.translation,
              example: wordData.example,
              exampleTranslation: wordData.exampleTranslation,
              userId,
            },
          })

          // 创建分组关联
          await tx.reviewGroupWord.create({
            data: {
              reviewGroupId: groupId,
              wordId: word.id,
            },
          })

          imported++
        }

        // 显示进度
        const processed = Math.min(i + batchSize, words.length)
        if (processed % 500 === 0 || processed === words.length) {
          console.log(
            `    进度：${processed}/${words.length} (${Math.round((processed / words.length) * 100)}%)`,
          )
        }
      }
    })
  } finally {
    // 恢复 SQLite 设置
    await prisma.$executeRaw`PRAGMA synchronous = FULL`
    await prisma.$executeRaw`PRAGMA journal_mode = DELETE`
  }

  return { imported, skipped }
}

async function main() {
  const jsonFilePath = process.argv[2]

  if (!jsonFilePath) {
    console.log('❌ 请提供 JSON 文件路径')
    console.log('使用方法：npx tsx scripts/seed-default-vocabularies-full.ts [json-file-path]')
    console.log(
      '\n示例：npx tsx scripts/seed-default-vocabularies-full.ts data/default-vocabularies.full.json',
    )
    return
  }

  const fullPath = path.resolve(jsonFilePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ 文件不存在：${fullPath}`)
    return
  }

  console.log(`📖 读取文件：${fullPath}`)
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))

  if (!data.vocabularies || !Array.isArray(data.vocabularies)) {
    console.log('❌ JSON 文件格式不正确，应包含 vocabularies 数组')
    return
  }

  console.log(`📊 找到 ${data.vocabularies.length} 个词库`)

  // 获取或创建系统用户
  let systemUser = await prisma.user.findUnique({
    where: { username: 'system' },
  })

  if (!systemUser) {
    console.log('📝 创建系统用户...')
    systemUser = await prisma.user.create({
      data: {
        username: 'system',
        password: 'system_password_not_for_login',
        isAdmin: true,
      },
    })
    console.log('✅ 系统用户创建成功')
  }

  for (const vocabConfig of data.vocabularies) {
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

      // 2. 批量导入词汇
      const words = vocabConfig.words || []
      console.log(`  📝 批量导入词汇 (${words.length} 个)...`)

      const { imported, skipped } = await batchImportWords(systemUser.id, reviewGroup.id, words)

      console.log(`  ✅ 词汇导入完成：导入 ${imported} 个，跳过 ${skipped} 个`)

      // 3. 生成分享密钥
      console.log(`  📝 生成分享密钥...`)
      const shareCode = await generateUniqueCode()

      const _sharedVocab = await prisma.sharedVocabulary.create({
        data: {
          code: shareCode,
          name: vocabConfig.name,
          description: vocabConfig.description,
          userId: systemUser.id,
          shareType: 'REVIEW_GROUP',
          reviewGroupId: reviewGroup.id,
          wordCount: imported,
          maxUses: null,
          expiresAt: null,
          isActive: true,
        },
      })

      console.log(`  ✅ 分享密钥生成成功：${shareCode}`)

      // 4. 创建 DefaultVocabulary 配置
      await prisma.defaultVocabulary.create({
        data: {
          name: vocabConfig.name,
          code: shareCode,
          description: vocabConfig.description,
          groupId: reviewGroup.id,
          wordCount: imported,
          isActive: true,
          sortOrder: vocabConfig.sortOrder || 0,
        },
      })

      console.log(`  ✅ 默认词库配置创建成功`)
    } catch (error) {
      console.error(`❌ 处理词库 "${vocabConfig.name}" 时出错:`, error)
    }
  }

  console.log('\n✅ 所有词库导入完成！')

  // 显示结果
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
