import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { createErrorResponse } from '@/lib/apiErrorHandler'
import { logger } from '@/lib/logger'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params

    let profile = await prisma.userGameProfile.findUnique({
      where: { userId },
      select: {
        nickname: true,
        combatPower: true,
        monthlyPower: true,
        currentStreak: true,
        zoneId: true,
      },
    })

    if (!profile) {
      const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
      if (!userExists) {
        return createErrorResponse('用户不存在', 404)
      }
      try {
        await prisma.userGameProfile.create({
          data: {
            id: randomUUID(),
            userId,
            dailyPowerDate: new Date().toISOString().slice(0, 10),
            updatedAt: new Date(),
          },
          select: { id: true },
        })
      } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code !== 'P2002') throw e
      }
      profile = await prisma.userGameProfile.findUnique({
        where: { userId },
        select: {
          nickname: true,
          combatPower: true,
          monthlyPower: true,
          currentStreak: true,
          zoneId: true,
        },
      })
      if (!profile) {
        return createErrorResponse('用户信息初始化失败', 500)
      }
    }

    let zoneRank = 0
    if (profile.zoneId) {
      const higherCount = await prisma.userGameProfile.count({
        where: {
          zoneId: profile.zoneId,
          OR: [
            { monthlyPower: { gt: profile.monthlyPower } },
            { monthlyPower: profile.monthlyPower, combatPower: { gt: profile.combatPower } },
            {
              monthlyPower: profile.monthlyPower,
              combatPower: profile.combatPower,
              userId: { lt: userId },
            },
          ],
        },
      })
      zoneRank = higherCount + 1
    }

    const totalWords = await prisma.word.count({
      where: { userId },
    })

    return NextResponse.json({
      success: true,
      data: {
        nickname: profile.nickname ?? '未设置昵称',
        combatPower: profile.combatPower,
        zoneRank,
        streak: profile.currentStreak,
        totalWords,
      },
    })
  } catch (err: unknown) {
    logger.error({ err }, '[Share Profile API] Error:')
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 },
    )
  }
}
