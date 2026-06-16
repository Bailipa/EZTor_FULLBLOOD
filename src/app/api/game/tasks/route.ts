import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    logger.info({ userId }, '[GameTasks] Starting task fetch')

    await gameService.getOrCreateProfile(userId)
    logger.info({ userId }, '[GameTasks] Profile ready')

    await gameService.updateStreak(userId)
    logger.info({ userId }, '[GameTasks] Streak updated')

    await gameService.reportTaskProgress(userId, 'LOGIN', 1)
    logger.info({ userId }, '[GameTasks] LOGIN task reported')

    const tasks = await gameService.getTodayTasks(userId)
    logger.info({ userId, taskCount: tasks.length }, '[GameTasks] Tasks fetched')

    return NextResponse.json({ success: true, data: tasks })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = (err as { code?: string }).code
    logger.error({ err, code, msg }, '[GameTasks] ERROR')
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
