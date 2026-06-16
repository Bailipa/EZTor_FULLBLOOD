import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import { handleApiError } from '@/lib/apiErrorHandler'
import type { TaskType } from '@/features/gamification/constants'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { taskType, value = 1 } = await req.json()
    if (!taskType) {
      return NextResponse.json({ success: false, error: 'taskType is required' }, { status: 400 })
    }

    const result = await gameService.reportTaskProgress(
      session.user.id,
      taskType as TaskType,
      value,
    )

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return handleApiError(err, 'POST /api/game/tasks/complete')
  }
}
