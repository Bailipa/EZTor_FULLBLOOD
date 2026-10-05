import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

export function getPowerPeriodStarts(now = new Date()) {
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const week = new Date(utc8)
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7))
  week.setUTCHours(0, 0, 0, 0)
  const month = new Date(utc8)
  month.setUTCDate(1)
  month.setUTCHours(0, 0, 0, 0)
  return {
    week: new Date(week.getTime() - 8 * 60 * 60 * 1000),
    month: new Date(month.getTime() - 8 * 60 * 60 * 1000),
  }
}

export async function rolloverGamePower(userId?: string, now = new Date()): Promise<number> {
  const { week, month } = getPowerPeriodStarts(now)
  // One conditional statement updates balances and their period markers.
  // PostgreSQL rechecks the predicate after concurrent row updates, so a second
  // scheduler cannot erase power already earned in the new period.
  return prisma.$executeRaw`
    UPDATE "UserGameProfile"
    SET "weeklyPower" = CASE
          WHEN "lastWeeklyReset" IS NOT NULL AND "lastWeeklyReset" < (${week}::timestamptz AT TIME ZONE 'UTC') THEN 0
          ELSE "weeklyPower" END,
        "monthlyPower" = CASE
          WHEN "lastMonthlyReset" IS NOT NULL AND "lastMonthlyReset" < (${month}::timestamptz AT TIME ZONE 'UTC') THEN 0
          ELSE "monthlyPower" END,
        "lastWeeklyReset" = CASE
          WHEN "lastWeeklyReset" IS NULL OR "lastWeeklyReset" < (${week}::timestamptz AT TIME ZONE 'UTC') THEN (${week}::timestamptz AT TIME ZONE 'UTC')
          ELSE "lastWeeklyReset" END,
        "lastMonthlyReset" = CASE
          WHEN "lastMonthlyReset" IS NULL OR "lastMonthlyReset" < (${month}::timestamptz AT TIME ZONE 'UTC') THEN (${month}::timestamptz AT TIME ZONE 'UTC')
          ELSE "lastMonthlyReset" END,
        "updatedAt" = (${now}::timestamptz AT TIME ZONE 'UTC')
    WHERE (${userId ? Prisma.sql`"userId" = ${userId}` : Prisma.sql`TRUE`})
      AND ("lastWeeklyReset" IS NULL OR "lastWeeklyReset" < (${week}::timestamptz AT TIME ZONE 'UTC')
        OR "lastMonthlyReset" IS NULL OR "lastMonthlyReset" < (${month}::timestamptz AT TIME ZONE 'UTC'))
  `
}
