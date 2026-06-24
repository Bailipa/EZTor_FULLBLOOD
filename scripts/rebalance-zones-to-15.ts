import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

const ZONE_MAX = 15
const SYSTEM_USER_ID = 'system-rebalance'
const ACTION = 'ZONE_REBALANCE'

const dryRun = !process.argv.includes('--apply')

type Member = {
  profileId: string
  userId: string
  username: string
  combatPower: number
  monthlyPower: number
  joinedAt: Date
}

type ZonePlan = {
  sourceZoneId: string
  sourceZoneName: string
  actualMembers: number
  keep: Member[]
  migrate: Member[]
  newZones: Array<{ name: string; members: Member[] }>
}

function compareMembers(a: Member, b: Member): number {
  if (b.combatPower !== a.combatPower) return b.combatPower - a.combatPower
  if (b.monthlyPower !== a.monthlyPower) return b.monthlyPower - a.monthlyPower
  return a.joinedAt.getTime() - b.joinedAt.getTime()
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchZoneMembers(zoneId: string): Promise<Member[]> {
  const rows = await prisma.userGameProfile.findMany({
    where: { zoneId },
    include: { User: { select: { username: true } } },
  })
  return rows.map((r) => ({
    profileId: r.id,
    userId: r.userId,
    username: r.User?.username ?? '(no-user)',
    combatPower: r.combatPower,
    monthlyPower: r.monthlyPower,
    joinedAt: r.createdAt,
  }))
}

async function buildPlans(): Promise<{ plans: ZonePlan[]; drift: Array<{ name: string; stored: number; actual: number }> }> {
  const zones = await prisma.warZone.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  const drift: Array<{ name: string; stored: number; actual: number }> = []
  const plans: ZonePlan[] = []

  for (const z of zones) {
    const members = await fetchZoneMembers(z.id)
    const actual = members.length
    if (actual !== z.memberCount) {
      drift.push({ name: z.name, stored: z.memberCount, actual })
    }
    if (actual <= ZONE_MAX) continue

    members.sort(compareMembers)
    const keep = members.slice(0, ZONE_MAX)
    const migrate = members.slice(ZONE_MAX)
    const groups = chunk(migrate, ZONE_MAX)
    const newZones = groups.map((g, i) => ({
      name: `第${zones.length + i + 1}学区`,
      members: g,
    }))

    plans.push({
      sourceZoneId: z.id,
      sourceZoneName: z.name,
      actualMembers: actual,
      keep,
      migrate,
      newZones,
    })
  }

  return { plans, drift }
}

function printReport(plans: ZonePlan[], drift: Array<{ name: string; stored: number; actual: number }>): void {
  console.log('\n=== 干跑报告 ===\n')

  if (drift.length > 0) {
    console.log(`[1] 幻影计数修正 (${drift.length} 条):`)
    for (const d of drift) {
      console.log(`    ${d.name}: ${d.stored} → ${d.actual}`)
    }
    console.log('')
  }

  if (plans.length === 0) {
    console.log('[2] 无超额学区,无需迁移。')
    return
  }

  for (const p of plans) {
    console.log(`[2] 超额学区: ${p.sourceZoneName} (实际 ${p.actualMembers} 人, 留 ${ZONE_MAX} 人, 迁 ${p.migrate.length} 人)`)
    console.log(`    留:`)
    for (const m of p.keep) {
      console.log(`      - ${m.username.padEnd(28)} combatPower=${m.combatPower}`)
    }
    console.log(`    迁:`)
    for (const m of p.migrate) {
      console.log(`      - ${m.username.padEnd(28)} combatPower=${m.combatPower}`)
    }
    console.log(`    新建学区:`)
    for (const nz of p.newZones) {
      console.log(`      ${nz.name} ← ${nz.members.length} 人`)
    }
    console.log('')
  }
}

async function apply(plans: ZonePlan[], drift: Array<{ name: string; stored: number; actual: number }>): Promise<void> {
  console.log('\n=== 开始执行 ===\n')

  await prisma.$transaction(async (tx) => {
    for (const d of drift) {
      const zone = await tx.warZone.findFirst({ where: { name: d.name } })
      if (!zone) continue
      await tx.warZone.update({ where: { id: zone.id }, data: { memberCount: d.actual } })
      console.log(`  [幻影修正] ${d.name}: ${d.stored} → ${d.actual}`)
    }

    for (const p of plans) {
      const existingCount = await tx.warZone.count()
      for (let i = 0; i < p.newZones.length; i++) {
        const target = p.newZones[i]
        const newZone = await tx.warZone.create({
          data: {
            id: randomUUID(),
            name: `第${existingCount + i + 1}学区`,
            memberCount: target.members.length,
            maxMembers: ZONE_MAX,
            isActive: true,
            updatedAt: new Date(),
          },
        })

        for (const m of target.members) {
          await tx.userGameProfile.update({
            where: { id: m.profileId },
            data: { zoneId: newZone.id },
          })
          await tx.auditLog.create({
            data: {
              userId: SYSTEM_USER_ID,
              action: ACTION,
              entityType: 'UserGameProfile',
              entityId: m.profileId,
              oldValue: JSON.stringify({ zoneId: p.sourceZoneId, zoneName: p.sourceZoneName }),
              newValue: JSON.stringify({ zoneId: newZone.id, zoneName: newZone.name, reason: 'rebalance-to-15' }),
            },
          })
        }
        console.log(`  [新建学区] ${newZone.name} ← ${target.members.length} 人`)
      }

      await tx.warZone.update({
        where: { id: p.sourceZoneId },
        data: { memberCount: p.keep.length, maxMembers: ZONE_MAX },
      })
      console.log(`  [原学区] ${p.sourceZoneName} 留 ${p.keep.length} 人, maxMembers → ${ZONE_MAX}`)
    }
  })

  console.log('\n=== 完成 ===\n')
}

async function main(): Promise<void> {
  console.log(`模式: ${dryRun ? 'DRY-RUN (不会写库)' : 'APPLY (会写库)'}`)
  console.log(`参数: ${process.argv.slice(2).join(' ') || '(无)'}`)
  console.log(`ZONE_MAX = ${ZONE_MAX}`)

  const { plans, drift } = await buildPlans()
  printReport(plans, drift)

  if (dryRun) {
    console.log('\n要真跑请加 --apply 参数。')
    return
  }

  await apply(plans, drift)
}

main()
  .catch((err) => {
    console.error('脚本失败:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })