import { logger } from '@/lib/logger'
import { rolloverGamePower } from '@/lib/gamePowerPeriods'

function getNextCheckMs(): number {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const nextMidnight = new Date(utc8)
  nextMidnight.setUTCHours(0, 0, 0, 0)
  nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1)
  return nextMidnight.getTime() - utc8.getTime()
}

async function checkAndRunResets() {
  try {
    const count = await rolloverGamePower()
    if (count > 0) logger.info({ count }, '[Gamification] Power periods advanced')
  } catch (err) {
    logger.error({ err }, '[Gamification] Reset check failed; next check will retry')
  }
}

const scheduler = globalThis as typeof globalThis & { gamificationResetsScheduled?: boolean }

export function scheduleGamificationResets() {
  if (scheduler.gamificationResetsScheduled) return
  scheduler.gamificationResetsScheduled = true

  // Catch up after downtime, including a restart after Monday/month start.
  void checkAndRunResets()
  const midnightTimer = setTimeout(() => {
    void checkAndRunResets()
    const checkTimer = setInterval(() => void checkAndRunResets(), 60 * 60 * 1000)
    checkTimer.unref()
  }, getNextCheckMs())
  midnightTimer.unref()

  logger.info('[Gamification] Reset scheduler initialized')
}
