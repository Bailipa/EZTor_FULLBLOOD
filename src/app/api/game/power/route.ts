import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import { handleApiError } from '@/lib/apiErrorHandler'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, source = 'UNKNOWN' } = await req.json()
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be a positive number' }, { status: 400 })
    }

    const result = await gameService.addPower(session.user.id, amount, source)

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return handleApiError(err, 'POST /api/game/power')
  }
}
