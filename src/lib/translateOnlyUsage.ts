import crypto from 'crypto'
import prisma from '@/lib/prisma'

export const DAILY_LIMIT = 30

function generateId(): string {
  return crypto.randomUUID()
}

export function getTodayDateUTC8(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}

export async function checkAndEnforceLimit(
  userId: string,
  isAdmin: boolean,
  deviceId?: string,
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  if (isAdmin) {
    return { allowed: true, used: 0, remaining: Infinity }
  }

  const today = getTodayDateUTC8()

  if (deviceId) {
    const deviceUsageCount = await prisma.deviceUsageLog.count({
      where: { deviceId, date: today },
    })
    if (deviceUsageCount >= DAILY_LIMIT) {
      return { allowed: false, used: deviceUsageCount, remaining: 0 }
    }
  }

  const usage = await prisma.translateOnlyUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  })
  const used = usage?.count ?? 0

  if (used >= DAILY_LIMIT) {
    return { allowed: false, used, remaining: 0 }
  }

  return { allowed: true, used, remaining: DAILY_LIMIT - used }
}

/** Reserve before sending to the provider. Attempts are not refunded when billing is uncertain. */
export async function reserveTranslateUsage(
  userId: string,
  isAdmin: boolean,
  deviceId?: string,
): Promise<boolean> {
  return prisma.$transaction(async tx => {
    // A device lock serializes its budget across accounts; the user lock also covers requests without a device.
    if (deviceId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`translate-device:${deviceId}`}, 0))`
    const [user] = await tx.$queryRaw<{ isAdmin: boolean; isBanned: boolean; banExpiresAt: Date | null }[]>`
      SELECT "isAdmin", "isBanned", "banExpiresAt" FROM "User" WHERE id=${userId} FOR UPDATE`
    if (!user || (user.isBanned && (!user.banExpiresAt || user.banExpiresAt > new Date()))) return false
    if (isAdmin && user.isAdmin) return true
    const today = getTodayDateUTC8()
    if (deviceId && await tx.deviceUsageLog.count({ where: { deviceId, date: today } }) >= DAILY_LIMIT) return false
    await tx.translateOnlyUsage.upsert({
      where: { userId_date: { userId, date: today } },
      create: { id: generateId(), userId, date: today, count: 0 },
      update: {},
    })
    const claimed = await tx.translateOnlyUsage.updateMany({
      where: { userId, date: today, count: { lt: DAILY_LIMIT } },
      data: { count: { increment: 1 } },
    })
    if (!claimed.count) return false
    if (deviceId) await tx.deviceUsageLog.create({ data: { id: generateId(), deviceId, date: today, userId } })
    return true
  })
}

export async function getUsage(
  userId: string,
  isAdmin: boolean,
): Promise<{
  used: number
  limit: number
  remaining: number
  isAdmin: boolean
}> {
  if (isAdmin) {
    return { used: 0, limit: Infinity, remaining: Infinity, isAdmin: true }
  }

  const today = getTodayDateUTC8()
  const usage = await prisma.translateOnlyUsage.findUnique({
    where: { userId_date: { userId, date: today } },
  })
  const used = usage?.count ?? 0

  return { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used), isAdmin: false }
}
