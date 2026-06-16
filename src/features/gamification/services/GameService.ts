import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { getTodayDateUTC8, daysBetweenUTC8 } from '@/lib/dateUtils'
import {
  DAILY_POWER_CAP,
  TASK_CONFIGS,
  TASK_TYPES,
  STREAK_POWER_MULTIPLIER,
  STREAK_POWER_CAP,
  FEATURE_UNLOCK_THRESHOLDS,
  FEATURE_DISPLAY_NAMES,
  FEATURE_DESCRIPTIONS,
  ZONE_MAX_MEMBERS,
  ZONE_RENAME_COST,
  ZONE_NAME_MAX_LENGTH,
  NICKNAME_CHANGE_COST,
  NICKNAME_PREVIOUS_DISPLAY_DAYS,
  NICKNAME_MAX_LENGTH,
  LEADERBOARD_LIMIT,
  ACCURACY_MIN_ATTEMPTS,
  type TaskType,
  type FeatureKey,
} from '../constants'
import type {
  GameProfile,
  DailyTaskState,
  LeaderboardEntry,
  ZoneInfo,
  AddPowerResult,
  TaskCompleteResult,
} from '../types'

export class GameService {
  async getOrCreateProfile(userId: string): Promise<GameProfile> {
    const profile = await prisma.userGameProfile.upsert({
      where: { userId },
      update: {},
      create: {
        id: randomUUID(),
        userId,
        dailyPowerDate: getTodayDateUTC8(),
        updatedAt: new Date(),
      },
    })

    return profile as GameProfile
  }

  async checkDailyReset(profile: GameProfile): Promise<GameProfile> {
    const today = getTodayDateUTC8()
    if (profile.dailyPowerDate === today) return profile

    const updated = await prisma.userGameProfile.update({
      where: { userId: profile.userId },
      data: {
        dailyPowerGained: 0,
        dailyPowerDate: today,
      },
    })

    return updated as GameProfile
  }

  async addPower(
    userId: string,
    amount: number,
    _source: string,
  ): Promise<AddPowerResult> {
    const profile = await this.getOrCreateProfile(userId)
    const resetProfile = await this.checkDailyReset(profile)

    if (resetProfile.dailyPowerGained >= DAILY_POWER_CAP) {
      return {
        powerGained: 0,
        totalPower: resetProfile.combatPower,
        newlyUnlocked: [],
      }
    }

    const actualAmount = Math.min(
      amount,
      DAILY_POWER_CAP - resetProfile.dailyPowerGained,
    )

    const updated = await prisma.userGameProfile.update({
      where: { userId },
      data: {
        combatPower: { increment: actualAmount },
        monthlyPower: { increment: actualAmount },
        weeklyPower: { increment: actualAmount },
        dailyPowerGained: { increment: actualAmount },
      },
    })

    const newlyUnlocked = await this.checkFeatureUnlocks(userId, updated.combatPower)

    return {
      powerGained: actualAmount,
      totalPower: updated.combatPower,
      newlyUnlocked,
    }
  }

  async checkFeatureUnlocks(
    userId: string,
    combatPower: number,
  ): Promise<FeatureKey[]> {
    const profile = await prisma.userGameProfile.findUnique({
      where: { userId },
    })
    if (!profile) return []

    const newlyUnlocked: FeatureKey[] = []
    for (const [key, threshold] of Object.entries(FEATURE_UNLOCK_THRESHOLDS)) {
      const featureKey = key as FeatureKey
      if (
        combatPower >= threshold &&
        !profile.unlockedFeatures.includes(featureKey)
      ) {
        newlyUnlocked.push(featureKey)
      }
    }

    if (newlyUnlocked.length > 0) {
      await prisma.userGameProfile.update({
        where: { userId },
        data: {
          unlockedFeatures: {
            push: newlyUnlocked,
          },
        },
      })
    }

    return newlyUnlocked
  }

  async updateStreak(userId: string): Promise<number> {
    const profile = await this.getOrCreateProfile(userId)
    const today = getTodayDateUTC8()

    if (profile.lastActiveDate === today) return profile.currentStreak

    const yesterday = new Date(Date.now() + 8 * 60 * 60 * 1000 - 86400000)
      .toISOString()
      .split('T')[0]

    const isConsecutive =
      profile.lastActiveDate === yesterday || profile.lastActiveDate === null

    const newStreak = isConsecutive ? profile.currentStreak + 1 : 1
    const newLongest = Math.max(newStreak, profile.longestStreak)

    await prisma.userGameProfile.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActiveDate: today,
      },
    })

    const streakPower = await this.getStreakPower(newStreak)
    if (streakPower > 0) {
      await this.addPower(userId, streakPower, 'STREAK')
    }

    return newStreak
  }

  async getStreakPower(streak: number): Promise<number> {
    return Math.min(streak * STREAK_POWER_MULTIPLIER, STREAK_POWER_CAP)
  }

  async getTodayTasks(userId: string): Promise<DailyTaskState[]> {
    const today = getTodayDateUTC8()
    const existing = await prisma.dailyTaskCompletion.findMany({
      where: { userId, date: today },
    })

    const taskMap = new Map(existing.map((t) => [t.taskType, t]))

    return TASK_CONFIGS.map((config) => {
      const record = taskMap.get(config.type)
      return {
        taskType: config.type,
        title: config.title,
        description: config.description,
        targetValue: config.targetValue,
        currentValue: record?.currentValue ?? 0,
        powerReward: config.powerReward,
        isCompleted: record?.isCompleted ?? false,
        completedAt: record?.completedAt ?? null,
      }
    })
  }

  async reportTaskProgress(
    userId: string,
    taskType: TaskType,
    value: number,
  ): Promise<TaskCompleteResult> {
    const today = getTodayDateUTC8()
    const config = TASK_CONFIGS.find((c) => c.type === taskType)
    if (!config) {
      return { taskCompleted: false, powerGained: 0, totalPower: 0, newlyUnlocked: [] }
    }

    const existing = await prisma.dailyTaskCompletion.findUnique({
      where: { userId_date_taskType: { userId, date: today, taskType } },
    })

    if (existing?.isCompleted) {
      const profile = await prisma.userGameProfile.findUnique({ where: { userId } })
      return {
        taskCompleted: false,
        powerGained: 0,
        totalPower: profile?.combatPower ?? 0,
        newlyUnlocked: [],
      }
    }

    const newValue = (existing?.currentValue ?? 0) + value
    const isCompleted = newValue >= config.targetValue

    try {
      await prisma.dailyTaskCompletion.upsert({
        where: { userId_date_taskType: { userId, date: today, taskType } },
        update: {
          currentValue: newValue,
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
        create: {
          id: randomUUID(),
          userId,
          date: today,
          taskType,
          targetValue: config.targetValue,
          currentValue: newValue,
          isCompleted,
          powerReward: config.powerReward,
          completedAt: isCompleted ? new Date() : null,
          updatedAt: new Date(),
        },
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        const profile = await prisma.userGameProfile.findUnique({ where: { userId } })
        return {
          taskCompleted: false,
          powerGained: 0,
          totalPower: profile?.combatPower ?? 0,
          newlyUnlocked: [],
        }
      }
      throw err
    }

    if (isCompleted) {
      const result = await this.addPower(userId, config.powerReward, `TASK:${taskType}`)
      return {
        taskCompleted: true,
        powerGained: result.powerGained,
        totalPower: result.totalPower,
        newlyUnlocked: result.newlyUnlocked,
      }
    }

    const profile = await prisma.userGameProfile.findUnique({ where: { userId } })
    return {
      taskCompleted: false,
      powerGained: 0,
      totalPower: profile?.combatPower ?? 0,
      newlyUnlocked: [],
    }
  }

  async reportAccuracyTask(userId: string): Promise<TaskCompleteResult> {
    const today = getTodayDateUTC8()
    const existing = await prisma.dailyTaskCompletion.findUnique({
      where: { userId_date_taskType: { userId, date: today, taskType: TASK_TYPES.REACH_ACCURACY } },
    })

    if (existing?.isCompleted) {
      const profile = await prisma.userGameProfile.findUnique({ where: { userId } })
      return {
        taskCompleted: false,
        powerGained: 0,
        totalPower: profile?.combatPower ?? 0,
        newlyUnlocked: [],
      }
    }

    const todayWords = await prisma.word.findMany({
      where: {
        userId,
        updatedAt: { gte: new Date(today + 'T00:00:00+08:00') },
        totalAttempts: { gt: 0 },
      },
      select: { correctCount: true, totalAttempts: true },
    })

    let totalCorrect = 0
    let totalAttempts = 0
    for (const w of todayWords) {
      totalCorrect += w.correctCount
      totalAttempts += w.totalAttempts
    }

    if (todayWords.length < ACCURACY_MIN_ATTEMPTS) {
      const profile = await prisma.userGameProfile.findUnique({ where: { userId } })
      return {
        taskCompleted: false,
        powerGained: 0,
        totalPower: profile?.combatPower ?? 0,
        newlyUnlocked: [],
      }
    }

    const accuracy = Math.round((totalCorrect / totalAttempts) * 100)

    return this.reportTaskProgress(userId, TASK_TYPES.REACH_ACCURACY, accuracy)
  }

  async getLeaderboard(
    type: 'total' | 'monthly' | 'weekly' | 'zone',
    userId: string,
  ): Promise<LeaderboardEntry[]> {
    const orderBy =
      type === 'total'
        ? { combatPower: 'desc' as const }
        : type === 'monthly' || type === 'zone'
          ? { monthlyPower: 'desc' as const }
          : { weeklyPower: 'desc' as const }

    const where =
      type === 'zone'
        ? {
            zoneId: (
              await prisma.userGameProfile.findUnique({ where: { userId }, select: { zoneId: true } })
            )?.zoneId ?? '',
          }
        : {}

    const profiles = await prisma.userGameProfile.findMany({
      where,
      orderBy,
      take: LEADERBOARD_LIMIT,
      select: {
        userId: true,
        nickname: true,
        previousNickname: true,
        nicknameChangedAt: true,
        combatPower: true,
        monthlyPower: true,
        weeklyPower: true,
        currentStreak: true,
      },
    })

    const powerField =
      type === 'total'
        ? 'combatPower'
        : type === 'monthly'
          ? 'monthlyPower'
          : 'weeklyPower'

    const today = getTodayDateUTC8()

    return profiles.map((p, i) => {
      let displayName = p.nickname ?? '未设置昵称'

      if (p.nicknameChangedAt && p.previousNickname) {
        const daysSince = daysBetweenUTC8(
          p.nicknameChangedAt.toISOString().split('T')[0],
          today,
        )
        if (daysSince >= 0 && daysSince <= NICKNAME_PREVIOUS_DISPLAY_DAYS) {
          displayName = `${p.nickname}（原${p.previousNickname}，${daysSince}天前改名）`
        }
      }

      return {
        rank: i + 1,
        userId: p.userId,
        nickname: displayName,
        previousNickname: p.previousNickname,
        nicknameChangedAt: p.nicknameChangedAt?.toISOString() ?? null,
        combatPower: p[powerField],
        currentStreak: p.currentStreak,
        isCurrentUser: p.userId === userId,
      }
    })
  }

  async setNickname(
    userId: string,
    nickname: string,
  ): Promise<{ success: boolean; error?: string; cost?: number }> {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length > NICKNAME_MAX_LENGTH) {
      return { success: false, error: `昵称长度需在1-${NICKNAME_MAX_LENGTH}之间` }
    }

    const profile = await this.getOrCreateProfile(userId)

    const isFirstChange = !profile.nicknameChangedAt
    if (!isFirstChange && profile.combatPower < NICKNAME_CHANGE_COST) {
      return {
        success: false,
        error: `战力不足，改名需要消耗 ${NICKNAME_CHANGE_COST} 战力（当前 ${profile.combatPower}）`,
      }
    }

    try {
      const updateData: Record<string, unknown> = {
        previousNickname: profile.nickname,
        nickname: trimmed,
        nicknameChangedAt: new Date(),
      }

      if (!isFirstChange) {
        updateData.combatPower = { decrement: NICKNAME_CHANGE_COST }
        updateData.monthlyPower = { decrement: NICKNAME_CHANGE_COST }
        updateData.weeklyPower = { decrement: NICKNAME_CHANGE_COST }
      }

      await prisma.userGameProfile.update({
        where: { userId },
        data: updateData,
      })

      return { success: true, cost: isFirstChange ? 0 : NICKNAME_CHANGE_COST }
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2002') {
        return { success: false, error: '该昵称已被占用' }
      }
      throw err
    }
  }

  async assignZone(userId: string): Promise<string | null> {
    const profile = await this.getOrCreateProfile(userId)
    if (profile.zoneId) return profile.zoneId

    const availableZone = await prisma.warZone.findFirst({
      where: { isActive: true, memberCount: { lt: ZONE_MAX_MEMBERS } },
      orderBy: { memberCount: 'asc' },
    })

    let zoneId: string
    if (availableZone) {
      zoneId = availableZone.id
      await prisma.warZone.update({
        where: { id: zoneId },
        data: { memberCount: { increment: 1 } },
      })
    } else {
      try {
        const count = await prisma.warZone.count()
        const newZone = await prisma.warZone.create({
          data: {
            id: randomUUID(),
            name: `第${count + 1}战区`,
            memberCount: 1,
            updatedAt: new Date(),
          },
        })
        zoneId = newZone.id
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
          const retryZone = await prisma.warZone.findFirst({
            where: { isActive: true, memberCount: { lt: ZONE_MAX_MEMBERS } },
            orderBy: { memberCount: 'asc' },
          })
          if (!retryZone) throw err
          zoneId = retryZone.id
          await prisma.warZone.update({
            where: { id: zoneId },
            data: { memberCount: { increment: 1 } },
          })
        } else {
          throw err
        }
      }
    }

    await prisma.userGameProfile.update({
      where: { userId },
      data: { zoneId },
    })

    return zoneId
  }

  async getZoneInfo(userId: string): Promise<ZoneInfo | null> {
    const profile = await this.getOrCreateProfile(userId)
    if (!profile.zoneId) return null

    const zone = await prisma.warZone.findUnique({
      where: { id: profile.zoneId },
    })
    if (!zone) return null

    const members = await this.getLeaderboard('zone', userId)
    const isCurrentUserTop = members.length > 0 && members[0].userId === userId

    let renamedByName: string | null = null
    if (zone.renamedBy) {
      const renamerProfile = await prisma.userGameProfile.findUnique({
        where: { userId: zone.renamedBy },
        select: { nickname: true },
      })
      renamedByName = renamerProfile?.nickname ?? null
    }

    return {
      id: zone.id,
      name: zone.name,
      memberCount: zone.memberCount,
      maxMembers: zone.maxMembers,
      members,
      isCurrentUserTop,
      previousName: zone.previousName,
      renamedByName,
      renamedAt: zone.renamedAt?.toISOString() ?? null,
    }
  }

  async renameZone(
    userId: string,
    newName: string,
  ): Promise<{ success: boolean; error?: string; cost?: number }> {
    const trimmed = newName.trim()
    if (!trimmed || trimmed.length > ZONE_NAME_MAX_LENGTH) {
      return { success: false, error: `战区名称长度需在1-${ZONE_NAME_MAX_LENGTH}之间` }
    }

    const profile = await this.getOrCreateProfile(userId)
    if (!profile.zoneId) {
      return { success: false, error: '你尚未加入任何战区' }
    }

    const members = await this.getLeaderboard('zone', userId)
    const isTop = members.length > 0 && members[0].userId === userId
    if (!isTop) {
      return { success: false, error: '只有战区排名第一的用户才能修改战区名称' }
    }

    if (profile.combatPower < ZONE_RENAME_COST) {
      return {
        success: false,
        error: `战力不足，改名需要消耗 ${ZONE_RENAME_COST} 战力（当前 ${profile.combatPower}）`,
      }
    }

    const existing = await prisma.warZone.findUnique({ where: { name: trimmed } })
    if (existing) {
      return { success: false, error: '该战区名称已被使用' }
    }

    const currentZone = await prisma.warZone.findUnique({
      where: { id: profile.zoneId },
      select: { name: true },
    })

    await prisma.$transaction([
      prisma.warZone.update({
        where: { id: profile.zoneId },
        data: {
          name: trimmed,
          previousName: currentZone?.name ?? null,
          renamedBy: userId,
          renamedAt: new Date(),
        },
      }),
      prisma.userGameProfile.update({
        where: { userId },
        data: {
          combatPower: { decrement: ZONE_RENAME_COST },
          monthlyPower: { decrement: ZONE_RENAME_COST },
          weeklyPower: { decrement: ZONE_RENAME_COST },
        },
      }),
    ])

    return { success: true, cost: ZONE_RENAME_COST }
  }

  getFeatureUnlockStatus(combatPower: number): {
    feature: FeatureKey
    displayName: string
    description: string
    required: number
    isUnlocked: boolean
    progress: number
  }[] {
    return Object.entries(FEATURE_UNLOCK_THRESHOLDS).map(([key, threshold]) => {
      const featureKey = key as FeatureKey
      return {
        feature: featureKey,
        displayName: FEATURE_DISPLAY_NAMES[featureKey],
        description: FEATURE_DESCRIPTIONS[featureKey],
        required: threshold,
        isUnlocked: combatPower >= threshold,
        progress: Math.min(100, Math.round((combatPower / threshold) * 100)),
      }
    })
  }
}

export const gameService = new GameService()
