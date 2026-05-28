import prisma from './prisma'
import { logger } from './logger'

export async function cleanupOldMessages() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const result = await prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: oneDayAgo } }
    })

    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} old chat messages`)
    }

    return result.count
  } catch (error) {
    logger.error({ err: error }, 'Failed to cleanup old messages')
    return 0
  }
}
