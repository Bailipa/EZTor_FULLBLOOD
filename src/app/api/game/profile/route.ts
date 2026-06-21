import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import { logger } from '@/lib/logger'
import { NICKNAME_MAX_LENGTH } from '@/features/gamification/constants'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const profile = await gameService.getOrCreateProfile(userId)
    const resetProfile = await gameService.checkDailyReset(profile)
    await gameService.assignZone(userId)
    const featureStatus = gameService.getFeatureUnlockStatus(resetProfile.combatPower)
    const identity = await prisma.externalIdentity.findFirst({
      where: { localUserId: userId, provider: 'xiaoying' },
      select: { provider: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...resetProfile,
        featureStatus,
        provider: identity ? 'xiaoying' : 'local',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = (err as { code?: string }).code
    logger.error({ err, code, msg }, '[GameProfile] ERROR')
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { nickname } = await req.json()
    if (!nickname || typeof nickname !== 'string') {
      return NextResponse.json(
        { success: false, error: `昵称长度需在1-${NICKNAME_MAX_LENGTH}之间` },
        { status: 400 },
      )
    }

    const result = await gameService.setNickname(session.user.id, nickname)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, cost: result.cost ?? 0 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, '[GameProfile] PUT ERROR')
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
