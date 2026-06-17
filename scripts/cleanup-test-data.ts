import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 清理游戏化测试数据 ===\n')

  const testUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'test_' } },
    select: { id: true, username: true },
  })

  if (testUsers.length === 0) {
    console.log('没有找到测试数据')
    return
  }

  const testUserIds = testUsers.map((u) => u.id)

  await prisma.dailyTaskCompletion.deleteMany({
    where: { userId: { in: testUserIds } },
  })
  console.log(`✓ 删除 DailyTaskCompletion`)

  await prisma.userGameProfile.deleteMany({
    where: { userId: { in: testUserIds } },
  })
  console.log(`✓ 删除 UserGameProfile`)

  await prisma.warZone.deleteMany({
    where: { name: '测试学区' },
  })
  console.log(`✓ 删除测试学区`)

  await prisma.user.deleteMany({
    where: { id: { in: testUserIds } },
  })
  console.log(`✓ 删除测试用户`)

  console.log(`\n清理完成，共删除 ${testUsers.length} 个测试用户`)
  testUsers.forEach((u) => console.log(`  - ${u.username}`))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
