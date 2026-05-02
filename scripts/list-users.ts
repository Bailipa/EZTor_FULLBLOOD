import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, isAdmin: true, createdAt: true },
  })

  if (users.length === 0) {
    console.log('数据库中没有用户')
    return
  }

  console.log('\n用户列表:')
  console.log('─'.repeat(60))
  users.forEach((u, i) => {
    const admin = u.isAdmin ? ' [管理员]' : ''
    console.log(`${i + 1}. ${u.username}${admin}`)
    console.log(`   ID: ${u.id}`)
    console.log(`   创建时间: ${u.createdAt.toLocaleString('zh-CN')}`)
  })
  console.log('─'.repeat(60))
  console.log(`\n共 ${users.length} 个用户`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
