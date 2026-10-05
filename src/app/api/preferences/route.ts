import { isMinimalFeatures, type MinimalFeatures } from '@/lib/minimalFeatures'
import { isInterfaceStyle, type InterfaceStyle } from '@/lib/interfaceStyle'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
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
        autoSaveWords: true,
        soundEffectsEnabled: true,
        interfaceStyle: true,
        minimalFeatures: true,
        showImportExportActions: true,
      },
    })

    return createSuccessResponse({ data: prefs, accountId: session.user.id })
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

    const expectedAccount = req.headers.get('X-Preferences-Account')
    if (expectedAccount && expectedAccount !== session.user.id) {
      return createErrorResponse('登录账号已变化，请刷新后重试', 409)
    }

    const body = (await req.json()) as {
      dailyGoal?: number
      reviewReminderEnabled?: boolean
      reviewReminderTime?: string
      autoSaveWords?: boolean
      minimalFeatures?: MinimalFeatures
      interfaceStyle?: InterfaceStyle
      soundEffectsEnabled?: boolean
      showImportExportActions?: boolean
    }

    const data: {
      dailyGoal?: number
      reviewReminderEnabled?: boolean
      reviewReminderTime?: string | null
      autoSaveWords?: boolean
      minimalFeatures?: MinimalFeatures
      interfaceStyle?: InterfaceStyle
      soundEffectsEnabled?: boolean
      showImportExportActions?: boolean
    } = {}

    if ('minimalFeatures' in body) {
      if (!isMinimalFeatures(body.minimalFeatures)) return createErrorResponse('无效的极简功能设置', 400)
      data.minimalFeatures = body.minimalFeatures
    }

    if ('interfaceStyle' in body) {
      if (!isInterfaceStyle(body.interfaceStyle)) {
        return createErrorResponse('无效的界面风格', 400)
      }
      data.interfaceStyle = body.interfaceStyle
    }

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

    if (typeof body.autoSaveWords === 'boolean') {
      data.autoSaveWords = body.autoSaveWords
    }

    if (typeof body.soundEffectsEnabled === 'boolean') {
      data.soundEffectsEnabled = body.soundEffectsEnabled
    }

    if (typeof body.showImportExportActions === 'boolean') {
      data.showImportExportActions = body.showImportExportActions
    }

    const prefs = await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: data,
      create: { userId: session.user.id, ...data, updatedAt: new Date() },
      select: {
        dailyGoal: true,
        reviewReminderEnabled: true,
        reviewReminderTime: true,
        autoSaveWords: true,
        soundEffectsEnabled: true,
        interfaceStyle: true,
        minimalFeatures: true,
        showImportExportActions: true,
      },
    })

    return createSuccessResponse({ data: prefs, accountId: session.user.id })
  } catch (err: unknown) {
    return handleApiError(err, 'preferences PUT')
  }
}
