import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingCompleted: true }
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to complete onboarding: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
