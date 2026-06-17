import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { targetZoneId } = await req.json()
  if (!targetZoneId || typeof targetZoneId !== 'string') {
    return NextResponse.json({ success: false, error: '请选择目标学区' }, { status: 400 })
  }

  const result = await gameService.transferZone(session.user.id, targetZoneId)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, cost: result.cost })
}
