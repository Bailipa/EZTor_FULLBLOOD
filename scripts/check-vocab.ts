import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const creator = await prisma.user.findUnique({
    where: { username: 'creator' },
  })

  if (!creator) {
    console.log('用户 creator 不存在')
    return
  }

  const groups = await prisma.reviewGroup.findMany({
    where: { userId: creator.id },
    include: {
      ReviewGroupWord: true,
    },
  })

  console.log(`\n用户 ${creator.username} 的词库组 (${groups.length} 个):\n`)

  if (groups.length === 0) {
    console.log('没有任何词库组')
    return
  }

  for (const group of groups) {
    console.log(`  - ${group.name}: ${group.ReviewGroupWord.length} 个单词`)
    console.log(`    ID: ${group.id}`)
    console.log(`    创建时间: ${group.createdAt.toLocaleString('zh-CN')}`)
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
