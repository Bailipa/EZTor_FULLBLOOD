import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getTodayDateUTC8 } from '@/lib/dateUtils'

function getNextCheckMs(): number {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const nextMidnight = new Date(utc8)
  nextMidnight.setUTCHours(0, 0, 0, 0)
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1)
  return nextMidnight.getTime() - utc8.getTime()
}

async function weeklyReset() {
  try {
    await prisma.userGameProfile.updateMany({
      data: { weeklyPower: 0 },
    })
    logger.info('[Gamification] Weekly power reset completed')
  } catch (err) {
    logger.error({ err }, '[Gamification] Weekly reset failed')
  }
}

async function monthlyReset() {
  try {
    await prisma.userGameProfile.updateMany({
      data: { monthlyPower: 0, zoneId: null },
    })
    await prisma.warZone.updateMany({
      data: { memberCount: 0 },
    })
    logger.info('[Gamification] Monthly power reset and zone redistribution completed')
  } catch (err) {
    logger.error({ err }, '[Gamification] Monthly reset failed')
  }
}

async function checkAndRunResets() {
  const today = getTodayDateUTC8()
  const now = new Date()

  const profile = await prisma.userGameProfile.findFirst({
    select: { lastWeeklyReset: true, lastMonthlyReset: true },
  })

  if (!profile) return

  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const dayOfWeek = utc8.getUTCDay()
  const dayOfMonth = utc8.getUTCDate()

  if (dayOfWeek === 1 && (!profile.lastWeeklyReset || profile.lastWeeklyReset.toISOString().split('T')[0] !== today)) {
    await weeklyReset()
    await prisma.userGameProfile.updateMany({
      data: { lastWeeklyReset: now },
    })
  }

  if (dayOfMonth === 1 && (!profile.lastMonthlyReset || profile.lastMonthlyReset.toISOString().split('T')[0] !== today)) {
    await monthlyReset()
    await prisma.userGameProfile.updateMany({
      data: { lastMonthlyReset: now },
    })
  }
}

export function scheduleGamificationResets() {
  const checkInterval = 60 * 60 * 1000

  setTimeout(() => {
    checkAndRunResets().catch((err) => {
      logger.error({ err }, '[Gamification] Reset check failed')
    })

    setInterval(() => {
      checkAndRunResets().catch((err) => {
        logger.error({ err }, '[Gamification] Reset check failed')
      })
    }, checkInterval)
  }, getNextCheckMs())

  logger.info('[Gamification] Reset scheduler initialized')
}
