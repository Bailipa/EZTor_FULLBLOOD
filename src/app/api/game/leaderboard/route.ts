import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import { handleApiError } from '@/lib/apiErrorHandler'

export async function GET(req: Request) {
  try {
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
