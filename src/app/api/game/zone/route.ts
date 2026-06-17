import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { gameService } from '@/features/gamification/services/GameService'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    if (url.searchParams.get('available') === 'true') {
      const zones = await prisma.warZone.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, memberCount: true, maxMembers: true },
      })
      return NextResponse.json({ success: true, data: zones })
    }

    const zone = await gameService.getZoneInfo(session.user.id)

    return NextResponse.json({ success: true, data: zone })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, '[GameZone] GET ERROR')
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const action = body.action as string | undefined

    if (action === 'setTitle') {
      const { title } = body
      if (!title || typeof title !== 'string') {
        return NextResponse.json({ success: false, error: '请输入称号' }, { status: 400 })
      }
      const result = await gameService.setZoneTitle(session.user.id, title)
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      }
      return NextResponse.json({ success: true, cost: result.cost })
    }

    const { name } = body
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: '请输入战区名称' }, { status: 400 })
    }

    const result = await gameService.renameZone(session.user.id, name)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, cost: result.cost })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, '[GameZone] PUT ERROR')
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
