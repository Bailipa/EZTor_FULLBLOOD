import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler'

const DAILY_GOAL_MIN = 5
const DAILY_GOAL_MAX = 500

function normalizeTime(value: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return m ? `${m[1]}:${m[2]}` : ''
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const prefs = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id, updatedAt: new Date() },
      select: {
        dailyGoal: true,
        reviewReminderEnabled: true,
        reviewReminderTime: true,
      },
    })

    return createSuccessResponse({ data: prefs })
  } catch (err: unknown) {
    return handleApiError(err, 'preferences GET')
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    const body = (await req.json()) as {
      dailyGoal?: number
      reviewReminderEnabled?: boolean
      reviewReminderTime?: string
    }

    const data: {
      dailyGoal?: number
      reviewReminderEnabled?: boolean
      reviewReminderTime?: string | null
    } = {}

    if (typeof body.dailyGoal === 'number') {
      if (!Number.isInteger(body.dailyGoal) || body.dailyGoal < DAILY_GOAL_MIN || body.dailyGoal > DAILY_GOAL_MAX) {
        return createErrorResponse(
          `每日目标需在 ${DAILY_GOAL_MIN}~${DAILY_GOAL_MAX} 之间`,
          400,
        )
      }
      data.dailyGoal = body.dailyGoal
    }

    if (typeof body.reviewReminderEnabled === 'boolean') {
      data.reviewReminderEnabled = body.reviewReminderEnabled
    }

    if (typeof body.reviewReminderTime === 'string') {
      const time = normalizeTime(body.reviewReminderTime)
      if (!time) {
        return createErrorResponse('提醒时间格式应为 HH:MM', 400)
      }
      data.reviewReminderTime = time
    }

    const prefs = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: data,
      create: { userId: session.user.id, ...data, updatedAt: new Date() },
      select: {
        dailyGoal: true,
        reviewReminderEnabled: true,
        reviewReminderTime: true,
      },
    })

    return createSuccessResponse({ data: prefs })
  } catch (err: unknown) {
    return handleApiError(err, 'preferences PUT')
  }
}
