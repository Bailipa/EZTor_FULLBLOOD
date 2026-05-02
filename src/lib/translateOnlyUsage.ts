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

export async function incrementUsage(
  userId: string,
  isAdmin: boolean,
  deviceId?: string,
): Promise<void> {
  if (isAdmin) return

  const today = getTodayDateUTC8()

  await prisma.translateOnlyUsage.upsert({
    where: { userId_date: { userId, date: today } },
    update: { count: { increment: 1 } },
    create: {
      id: generateId(),
      userId,
      date: today,
      count: 1,
    },
  })

  if (deviceId) {
    await prisma.deviceUsageLog.create({
      data: {
        id: generateId(),
        deviceId,
        date: today,
        userId,
      },
    })
  }
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
