import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

const TEST_USERS = [
  { username: 'test_张三', nickname: '单词猎手', pattern: 'steady' },
  { username: 'test_李四', nickname: '背诵狂人', pattern: 'fast_start' },
  { username: 'test_王五', nickname: '英语小白', pattern: 'slow' },
  { username: 'test_赵六', nickname: '摸鱼达人', pattern: 'irregular' },
  { username: 'test_钱七', nickname: '深夜学者', pattern: 'burst' },
]

function getPowerGain(pattern: string, round: number): number {
  switch (pattern) {
    case 'steady':
      return [15, 20, 25, 15, 20, 25, 15, 20][round % 8]
    case 'fast_start':
      return round < 5 ? 30 : 10
    case 'slow':
      return 10
    case 'irregular':
      return round % 3 === 2 ? 0 : [15, 20, 10][round % 3]
    case 'burst':
      return round >= 4 ? 30 : 5
    default:
      return 15
  }
}

async function main() {
  console.log('=== EZTor 游戏化系统测试脚本 ===\n')

  const testUserIds: string[] = []

  for (const tu of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { username: tu.username },
      update: {},
      create: {
        id: randomUUID(),
        username: tu.username,
        password: 'test_hash_placeholder',
        updatedAt: new Date(),
      },
    })

    await prisma.userGameProfile.upsert({
      where: { userId: user.id },
      update: {
        nickname: tu.nickname,
        combatPower: 0,
        monthlyPower: 0,
        weeklyPower: 0,
        dailyPowerGained: 0,
        dailyPowerDate: '',
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        unlockedFeatures: [],
        zoneId: null,
      },
      create: {
        id: randomUUID(),
        userId: user.id,
        nickname: tu.nickname,
        dailyPowerDate: '',
        updatedAt: new Date(),
      },
    })

    testUserIds.push(user.id)
    console.log(`✓ 用户就绪: ${tu.nickname} (${tu.username})`)
  }

  // Assign all to same zone
  const zone = await prisma.warZone.upsert({
    where: { name: '测试战区' },
    update: {},
    create: { id: randomUUID(), name: '测试战区', maxMembers: 50, updatedAt: new Date() },
  })

  for (const uid of testUserIds) {
    await prisma.userGameProfile.update({
      where: { userId: uid },
      data: { zoneId: zone.id },
    })
  }
  await prisma.warZone.update({
    where: { id: zone.id },
    data: { memberCount: testUserIds.length },
  })
  console.log(`\n✓ 所有用户已分配到: 测试战区\n`)

  const ROUNDS = 10
  const DELAY_MS = 3000

  for (let round = 0; round < ROUNDS; round++) {
    console.log(`\n--- 第 ${round + 1}/${ROUNDS} 轮 (间隔 ${DELAY_MS / 1000}s) ---`)

    for (let i = 0; i < TEST_USERS.length; i++) {
      const tu = TEST_USERS[i]
      const uid = testUserIds[i]
      const gain = getPowerGain(tu.pattern, round)

      if (gain === 0) {
        console.log(`  ${tu.nickname}: 跳过 (摸鱼中...)`)
        continue
      }

      await prisma.userGameProfile.update({
        where: { userId: uid },
        data: {
          combatPower: { increment: gain },
          monthlyPower: { increment: gain },
          weeklyPower: { increment: gain },
          dailyPowerGained: { increment: gain },
          lastActiveDate: new Date().toISOString().split('T')[0],
          currentStreak: { increment: round === 0 ? 1 : 0 },
        },
      })

      const profile = await prisma.userGameProfile.findUnique({
        where: { userId: uid },
      })

      const unlocked: string[] = []
      if (profile!.combatPower >= 50 && !profile!.unlockedFeatures.includes('DANMAKU')) {
        unlocked.push('DANMAKU')
      }
      if (profile!.combatPower >= 200 && !profile!.unlockedFeatures.includes('MINI_GAME')) {
        unlocked.push('MINI_GAME')
      }
      if (unlocked.length > 0) {
        await prisma.userGameProfile.update({
          where: { userId: uid },
          data: { unlockedFeatures: { push: unlocked } },
        })
        console.log(`  🎉 ${tu.nickname} 解锁: ${unlocked.join(', ')}`)
      }

      console.log(`  ${tu.nickname}: +${gain} → 总战力 ${profile!.combatPower}`)
    }

    // Print leaderboard
    const all = await prisma.userGameProfile.findMany({
      where: { userId: { in: testUserIds } },
      orderBy: { combatPower: 'desc' },
      select: { nickname: true, combatPower: true, unlockedFeatures: true },
    })

    console.log('\n  📊 当前排名:')
    all.forEach((p, i) => {
      const features = p.unlockedFeatures.length > 0 ? ` [${p.unlockedFeatures.join(',')}]` : ''
      console.log(`    ${i + 1}. ${p.nickname}: ${p.combatPower} 战力${features}`)
    })

    if (round < ROUNDS - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  console.log('\n=== 测试完成 ===')
  console.log('打开浏览器访问 /leaderboard 查看排行榜效果')
  console.log('运行 cleanup-test-data.ts 清理测试数据')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
