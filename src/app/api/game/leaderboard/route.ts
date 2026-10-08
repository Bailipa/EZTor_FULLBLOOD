import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { gameService } from '@/features/gamification/services/GameService'
import { handleApiError } from '@/lib/apiErrorHandler'
import { isLeaderboardEnabled } from '@/lib/leaderboardAccess'

export async function GET(req: Request) {
  try {
    if (!(await isLeaderboardEnabled())) {
      return NextResponse.json({ success: false, error: '排行榜暂未开放' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') || 'total') as 'total' | 'monthly' | 'weekly' | 'zone'

    if (type === 'zone') {
      await gameService.assignZone(session.user.id)
    }
    const leaderboard = await gameService.getLeaderboard(type, session.user.id)

    return NextResponse.json({ success: true, data: leaderboard })
  } catch (err) {
    return handleApiError(err, 'GET /api/game/leaderboard')
  }
}
