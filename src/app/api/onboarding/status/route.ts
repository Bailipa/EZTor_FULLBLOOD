import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardingCompleted: true,
        createdAt: true,
        _count: { select: { Word: true } }
      }
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // 情况1：用户明确标记完成过引导
    if (user.onboardingCompleted) {
      return NextResponse.json({ success: true, needsOnboarding: false })
    }

    // 用户已有明确的本地引导进度时，允许从中断步骤继续；新手步骤本身可能已经创建了单词。
    if (new URL(request.url).searchParams.get('resume') === '1') {
      return NextResponse.json({ success: true, needsOnboarding: true })
    }

    // 情况2：用户有单词（不管是新是旧）
    if (user._count.Word > 0) {
      // 标记为已完成，下次不再显示
      await prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingCompleted: true }
      })
      return NextResponse.json({ success: true, needsOnboarding: false })
    }

    // 情况3：用户没有单词，且创建时间超过 24 小时
    // 说明用户注册后从未使用，应该引导
    const hoursSinceCreation = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceCreation > 24) {
      return NextResponse.json({ success: true, needsOnboarding: true })
    }

    // 情况4：新注册用户（< 24 小时），没有单词
    return NextResponse.json({ success: true, needsOnboarding: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, `Failed to check onboarding status: ${msg}`)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
