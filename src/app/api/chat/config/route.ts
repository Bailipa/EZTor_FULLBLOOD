import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { broadcastConfig } from '@/lib/chatSSE'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let config = await prisma.chatConfig.findUnique({ where: { id: 'global' } })
    if (!config) {
      config = await prisma.chatConfig.create({ data: { id: 'global' } })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to fetch chat config: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { isEnabled, isCircuitBroken, circuitBreakReason } = body

    const data: Record<string, unknown> = {}
    if (isEnabled !== undefined) data.isEnabled = isEnabled
    if (isCircuitBroken !== undefined) {
      data.isCircuitBroken = isCircuitBroken
      if (!isCircuitBroken) {
        data.circuitBreakReason = null
        data.circuitBreakAt = null
      }
    }
    if (circuitBreakReason !== undefined) data.circuitBreakReason = circuitBreakReason

    const config = await prisma.chatConfig.update({
      where: { id: 'global' },
      data
    })

    broadcastConfig(config)

    return NextResponse.json({ success: true, data: config })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to update chat config: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
