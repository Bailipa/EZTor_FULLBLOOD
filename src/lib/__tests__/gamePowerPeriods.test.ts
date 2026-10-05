import { describe, it, expect, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getPowerPeriodStarts, rolloverGamePower } from '@/lib/gamePowerPeriods'

vi.mock('@/lib/prisma', () => ({ default: { $executeRaw: vi.fn().mockResolvedValue(1) } }))

describe('game power period timestamp semantics', () => {
  const now = new Date('2026-10-05T04:00:00Z')

  it('calculates UTC+8 Monday and month boundaries as UTC instants', () => {
    const periods = getPowerPeriodStarts(now)
    expect(periods.week.toISOString()).toBe('2026-10-04T16:00:00.000Z')
    expect(periods.month.toISOString()).toBe('2026-09-30T16:00:00.000Z')
  })

  it('converts every Date binding to UTC timestamp for CASE, SET and WHERE', async () => {
    await rolloverGamePower('fixture-user', now)
    const [strings, ...values] = vi.mocked(prisma.$executeRaw).mock.calls[0]
    const sql = strings as unknown as string[]
    let convertedDates = 0
    for (const [index, value] of values.entries()) {
      if (value instanceof Date) {
        expect(sql[index]).toMatch(/\($/)
        expect(sql[index + 1]).toMatch(/^::timestamptz AT TIME ZONE 'UTC'\)/)
        convertedDates++
      }
    }
    expect(convertedDates).toBe(9)
    const statement = sql.join('?')
    expect(statement).not.toContain('COALESCE')
    expect(statement).toContain('WHEN \"lastWeeklyReset\" IS NOT NULL AND')
    expect(statement).toContain('WHEN \"lastMonthlyReset\" IS NOT NULL AND')
    expect(sql.join('?')).toContain('"updatedAt" = (?::timestamptz AT TIME ZONE \'UTC\')')
  })

  // Explicit local URL opt-in keeps ordinary test runs independent of a database.
  it.runIf(Boolean(process.env.POWER_PERIOD_TEST_DATABASE_URL))('compares and stores UTC timestamps correctly in an Asia/Shanghai PostgreSQL session', async () => {
    const url = process.env.POWER_PERIOD_TEST_DATABASE_URL!
    expect(['localhost', '127.0.0.1', '[::1]']).toContain(new URL(url).hostname)
    const db = new PrismaClient({ datasources: { db: { url } } })
    const { week, month } = getPowerPeriodStarts(now)
    try {
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Shanghai'`
        return tx.$queryRaw<{ timezone: string; oldComparison: boolean; utcComparison: boolean; monthMarker: string; weekMarker: string; updatedMarker: string; oldNullWeekly: number; oldNullMonthly: number }[]>`
          SELECT current_setting('TimeZone') AS timezone,
            (TIMESTAMP '2026-09-30 16:00:00' < ${month}::timestamptz) AS "oldComparison",
            (TIMESTAMP '2026-09-30 16:00:00' < (${month}::timestamptz AT TIME ZONE 'UTC')) AS "utcComparison",
            (${month}::timestamptz AT TIME ZONE 'UTC')::text AS "monthMarker",
            (${week}::timestamptz AT TIME ZONE 'UTC')::text AS "weekMarker",
            (${now}::timestamptz AT TIME ZONE 'UTC')::text AS "updatedMarker",
            CASE WHEN "lastWeeklyReset" IS NOT NULL AND "lastWeeklyReset" < (${week}::timestamptz AT TIME ZONE 'UTC')
              THEN 0 ELSE "weeklyPower" END AS "oldNullWeekly",
            CASE WHEN "lastMonthlyReset" IS NOT NULL AND "lastMonthlyReset" < (${month}::timestamptz AT TIME ZONE 'UTC')
              THEN 0 ELSE "monthlyPower" END AS "oldNullMonthly"
          FROM (VALUES (TIMESTAMP '2026-09-01 00:00:00', NULL::timestamp, NULL::timestamp, 31, 32))
            AS old_profile("createdAt", "lastWeeklyReset", "lastMonthlyReset", "weeklyPower", "monthlyPower")
        `
      })
      expect(result[0]).toEqual({ timezone: 'Asia/Shanghai', oldComparison: true, utcComparison: false,
        monthMarker: '2026-09-30 16:00:00', weekMarker: '2026-10-04 16:00:00', updatedMarker: '2026-10-05 04:00:00', oldNullWeekly: 31, oldNullMonthly: 32 })
    } finally {
      await db.$disconnect()
    }
  })
})
