import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import { handleApiError } from '@/lib/apiErrorHandler'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await gameService.getOrCreateProfile(session.user.id)
    const featureStatus = gameService.getFeatureUnlockStatus(profile.combatPower)

    return NextResponse.json({ success: true, data: featureStatus })
  } catch (err) {
    return handleApiError(err, 'GET /api/game/features')
  }
}
