import prisma from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  console.log('开始为现有用户创建系统默认分组...\n')

  // 获取所有用户
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      ReviewGroup: {
        where: { isSystem: true },
        select: { name: true }
      }
    }
  })

  console.log(`找到 ${users.length} 个用户\n`)

  let createdCount = 0
  let skippedCount = 0

  for (const user of users) {
    const existingSystemGroups = user.ReviewGroup.map(g => g.name)
    
    // 检查是否已有系统分组
    const needsKnown = !existingSystemGroups.includes('_known_words')
    const needsUnknown = !existingSystemGroups.includes('_unknown_words')

    if (!needsKnown && !needsUnknown) {
      skippedCount++
      continue
    }

    // 创建缺失的系统分组
    const groupsToCreate = []
    if (needsKnown) {
      groupsToCreate.push({
        id: randomUUID(),
        name: '_known_words',
        userId: user.id,
        isSystem: true,
        updatedAt: new Date()
      })
    }
    if (needsUnknown) {
      groupsToCreate.push({
        id: randomUUID(),
        name: '_unknown_words',
        userId: user.id,
        isSystem: true,
        updatedAt: new Date()
      })
    }

    if (groupsToCreate.length > 0) {
      await prisma.reviewGroup.createMany({
        data: groupsToCreate
      })
      createdCount++
      console.log(`✓ 用户 ${user.username}: 创建了 ${groupsToCreate.length} 个系统分组`)
    }
  }

  console.log(`\n完成！`)
  console.log(`- 跳过（已有系统分组）: ${skippedCount} 个用户`)
  console.log(`- 新创建: ${createdCount} 个用户`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
