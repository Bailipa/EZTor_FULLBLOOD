import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { getTodayDateUTC8, daysBetweenUTC8 } from '@/lib/dateUtils'
import { loadCustomProfanity, containsProfanity } from '@/lib/profanityFilter'
import {
  DAILY_POWER_CAP,
  TASK_CONFIGS,
  TASK_TYPES,
  SHARE_POWER_REWARD,
  STREAK_POWER_MULTIPLIER,
  STREAK_POWER_CAP,
  FEATURE_UNLOCK_THRESHOLDS,
  FEATURE_DISPLAY_NAMES,
  FEATURE_DESCRIPTIONS,
  ZONE_MAX_MEMBERS,
  ZONE_RENAME_COST,
  ZONE_TRANSFER_COST,
  ZONE_TRANSFER_COOLDOWN_DAYS,
  ZONE_NAME_MAX_LENGTH,
  ZONE_TITLES,
  ZONE_TITLE_MAX_LENGTH,
  ZONE_TITLE_CHANGE_COST,
  ZONE_TITLE_CHANGE_COOLDOWN_DAYS,
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

  async reportShareActivity(userId: string): Promise<TaskCompleteResult> {
    const today = getTodayDateUTC8()
    const taskType = TASK_TYPES.SHARE

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

    try {
      await prisma.dailyTaskCompletion.upsert({
        where: { userId_date_taskType: { userId, date: today, taskType } },
        update: {
          currentValue: 1,
          isCompleted: true,
          completedAt: new Date(),
        },
        create: {
          id: randomUUID(),
          userId,
          date: today,
          taskType,
          targetValue: 1,
          currentValue: 1,
          isCompleted: true,
          powerReward: SHARE_POWER_REWARD,
          completedAt: new Date(),
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

    const result = await this.addPower(userId, SHARE_POWER_REWARD, 'TASK:SHARE')
    return {
      taskCompleted: true,
      powerGained: result.powerGained,
      totalPower: result.totalPower,
      newlyUnlocked: result.newlyUnlocked,
    }
  }

  async getLeaderboard(
    type: 'total' | 'monthly' | 'weekly' | 'zone',
    userId: string,
  ): Promise<LeaderboardEntry[]> {
    const orderBy =
      type === 'total'
        ? [{ combatPower: 'desc' as const }, { monthlyPower: 'desc' as const }, { userId: 'asc' as const }]
        : type === 'monthly' || type === 'zone'
          ? [{ monthlyPower: 'desc' as const }, { combatPower: 'desc' as const }, { userId: 'asc' as const }]
          : [{ weeklyPower: 'desc' as const }, { combatPower: 'desc' as const }, { userId: 'asc' as const }]

    const where =
      type === 'zone'
        ? {
            zoneId: (
              await prisma.userGameProfile.findUnique({ where: { userId }, select: { zoneId: true } })
            )?.zoneId ?? '',
          }
        : {}

    const isZone = type === 'zone'

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
        ...(isZone ? { zoneTitle: true } : {}),
      },
    })

    const powerField =
      type === 'total'
        ? 'combatPower'
        : type === 'monthly' || type === 'zone'
          ? 'monthlyPower'
          : 'weeklyPower'

    const today = getTodayDateUTC8()

    const entries: LeaderboardEntry[] = []

    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i]
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

      let zoneTitle: string = ZONE_TITLES.DEFAULT
      if (isZone) {
        const rank = i + 1
        const storedTitle = (p as { zoneTitle?: string | null }).zoneTitle

        if (rank === 1) {
          zoneTitle = storedTitle || ZONE_TITLES.RANK_1
        } else {
          zoneTitle =
            rank === 2
              ? ZONE_TITLES.RANK_2
              : rank === 3
                ? ZONE_TITLES.RANK_3
                : ZONE_TITLES.DEFAULT

          if (storedTitle) {
            prisma.userGameProfile.update({
              where: { userId: p.userId },
              data: { zoneTitle: null },
            }).catch(() => {})
          }
        }
      }

      entries.push({
        rank: i + 1,
        userId: p.userId,
        nickname: displayName,
        previousNickname: p.previousNickname,
        nicknameChangedAt: p.nicknameChangedAt?.toISOString() ?? null,
        score: p[powerField],
        currentStreak: p.currentStreak,
        isCurrentUser: p.userId === userId,
        zoneTitle,
      })
    }

    return entries
  }

  async setNickname(
    userId: string,
    nickname: string,
  ): Promise<{ success: boolean; error?: string; cost?: number }> {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length > NICKNAME_MAX_LENGTH) {
      return { success: false, error: `昵称长度需在1-${NICKNAME_MAX_LENGTH}之间` }
    }

    await loadCustomProfanity()
    if (containsProfanity(trimmed)) {
      return { success: false, error: '该名称不可用，请更换' }
    }

    const profile = await this.getOrCreateProfile(userId)

    const isFirstChange = !profile.nicknameChangedAt
    if (!isFirstChange && (
      profile.combatPower < NICKNAME_CHANGE_COST ||
      profile.monthlyPower < NICKNAME_CHANGE_COST ||
      profile.weeklyPower < NICKNAME_CHANGE_COST
    )) {
      return {
        success: false,
        error: `学力不足，改名需要消耗 ${NICKNAME_CHANGE_COST} 学力（当前 ${profile.combatPower}）`,
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
            name: `第${count + 1}学区`,
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

    let transferCooldownRemaining = 0
    if (profile.lastZoneTransferAt) {
      const elapsed = Date.now() - profile.lastZoneTransferAt.getTime()
      const cooldownMs = ZONE_TRANSFER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      if (elapsed < cooldownMs) {
        transferCooldownRemaining = Math.ceil((cooldownMs - elapsed) / 1000)
      }
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
      canTransfer: profile.combatPower >= ZONE_TRANSFER_COST && transferCooldownRemaining === 0,
      transferCooldownRemaining,
    }
  }

  async renameZone(
    userId: string,
    newName: string,
  ): Promise<{ success: boolean; error?: string; cost?: number }> {
    const trimmed = newName.trim()
    if (!trimmed || trimmed.length > ZONE_NAME_MAX_LENGTH) {
      return { success: false, error: `学区名称长度需在1-${ZONE_NAME_MAX_LENGTH}之间` }
    }

    await loadCustomProfanity()
    if (containsProfanity(trimmed)) {
      return { success: false, error: '该名称不可用，请更换' }
    }

    const profile = await this.getOrCreateProfile(userId)
    if (!profile.zoneId) {
      return { success: false, error: '你尚未加入任何学区' }
    }

    const members = await this.getLeaderboard('zone', userId)
    const isTop = members.length > 0 && members[0].userId === userId
    if (!isTop) {
      return { success: false, error: '只有学区排名第一的用户才能修改学区名称' }
    }

    if (
      profile.combatPower < ZONE_RENAME_COST ||
      profile.monthlyPower < ZONE_RENAME_COST ||
      profile.weeklyPower < ZONE_RENAME_COST
    ) {
      return {
        success: false,
        error: `学力不足，改名需要消耗 ${ZONE_RENAME_COST} 学力（当前 ${profile.combatPower}）`,
      }
    }

    const existing = await prisma.warZone.findUnique({ where: { name: trimmed } })
    if (existing) {
      return { success: false, error: '该学区名称已被使用' }
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

  async transferZone(
    userId: string,
    targetZoneId: string,
  ): Promise<{ success: boolean; error?: string; cost?: number }> {
    const profile = await this.getOrCreateProfile(userId)
    if (!profile.zoneId) {
      return { success: false, error: '你尚未加入任何学区' }
    }

    if (profile.zoneId === targetZoneId) {
      return { success: false, error: '你已在该学区' }
    }

    if (profile.lastZoneTransferAt) {
      const elapsed = Date.now() - profile.lastZoneTransferAt.getTime()
      const cooldownMs = ZONE_TRANSFER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      if (elapsed < cooldownMs) {
        const remainingDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000))
        return { success: false, error: `转移冷却中，还需 ${remainingDays} 天` }
      }
    }

    if (
      profile.combatPower < ZONE_TRANSFER_COST ||
      profile.monthlyPower < ZONE_TRANSFER_COST ||
      profile.weeklyPower < ZONE_TRANSFER_COST
    ) {
      return {
        success: false,
        error: `学力不足，转移需要消耗 ${ZONE_TRANSFER_COST} 学力（当前 ${profile.combatPower}）`,
      }
    }

    const targetZone = await prisma.warZone.findUnique({
      where: { id: targetZoneId },
    })
    if (!targetZone || !targetZone.isActive) {
      return { success: false, error: '目标学区不存在' }
    }

    if (targetZone.memberCount >= targetZone.maxMembers) {
      return { success: false, error: '目标学区已满' }
    }

    await prisma.$transaction([
      prisma.warZone.update({
        where: { id: profile.zoneId },
        data: { memberCount: { decrement: 1 } },
      }),
      prisma.warZone.update({
        where: { id: targetZoneId },
        data: { memberCount: { increment: 1 } },
      }),
      prisma.userGameProfile.update({
        where: { userId },
        data: {
          zoneId: targetZoneId,
          combatPower: { decrement: ZONE_TRANSFER_COST },
          monthlyPower: { decrement: ZONE_TRANSFER_COST },
          weeklyPower: { decrement: ZONE_TRANSFER_COST },
          lastZoneTransferAt: new Date(),
        },
      }),
    ])

    return { success: true, cost: ZONE_TRANSFER_COST }
  }

  async setZoneTitle(
    userId: string,
    title: string,
  ): Promise<{ success: boolean; error?: string; cost?: number }> {
    const trimmed = title.trim()
    if (!trimmed || trimmed.length > ZONE_TITLE_MAX_LENGTH) {
      return { success: false, error: `称号长度需在1-${ZONE_TITLE_MAX_LENGTH}之间` }
    }

    await loadCustomProfanity()
    if (containsProfanity(trimmed)) {
      return { success: false, error: '该名称不可用，请更换' }
    }

    const profile = await this.getOrCreateProfile(userId)
    if (!profile.zoneId) {
      return { success: false, error: '你尚未加入任何学区' }
    }

    const members = await this.getLeaderboard('zone', userId)
    const isTop = members.length > 0 && members[0].userId === userId
    if (!isTop) {
      return { success: false, error: '只有学区排名第一的用户才能修改称号' }
    }

    if (profile.lastZoneTitleChangeAt) {
      const elapsed = Date.now() - profile.lastZoneTitleChangeAt.getTime()
      const cooldownMs = ZONE_TITLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      if (elapsed < cooldownMs) {
        const remainingDays = Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000))
        return { success: false, error: `称号修改冷却中，还需 ${remainingDays} 天` }
      }
    }

    if (
      profile.combatPower < ZONE_TITLE_CHANGE_COST ||
      profile.monthlyPower < ZONE_TITLE_CHANGE_COST ||
      profile.weeklyPower < ZONE_TITLE_CHANGE_COST
    ) {
      return {
        success: false,
        error: `学力不足，修改称号需要消耗 ${ZONE_TITLE_CHANGE_COST} 学力（当前 ${profile.combatPower}）`,
      }
    }

    // 按完整排序 tuple (monthlyPower desc, combatPower desc, userId asc) 校验是否仍是榜一
    if (members.length >= 2) {
      const powerAfterMonthly = profile.monthlyPower - ZONE_TITLE_CHANGE_COST
      const powerAfterCombat = profile.combatPower - ZONE_TITLE_CHANGE_COST
      const second = await prisma.userGameProfile.findUnique({
        where: { userId: members[1].userId },
        select: { monthlyPower: true, combatPower: true, userId: true },
      })
      if (second) {
        // 比较 (powerAfterMonthly, powerAfterCombat, userId) 是否小于 (second.monthlyPower, second.combatPower, second.userId)
        const drops =
          powerAfterMonthly < second.monthlyPower ||
          (powerAfterMonthly === second.monthlyPower && powerAfterCombat < second.combatPower) ||
          (powerAfterMonthly === second.monthlyPower &&
            powerAfterCombat === second.combatPower &&
            userId > second.userId)
        if (drops) {
          return {
            success: false,
            error: '修改后学力不足以支撑你的榜一位置！无法修改！',
          }
        }
      }
    }

    await prisma.$transaction([
      prisma.userGameProfile.update({
        where: { userId },
        data: {
          combatPower: { decrement: ZONE_TITLE_CHANGE_COST },
          monthlyPower: { decrement: ZONE_TITLE_CHANGE_COST },
          weeklyPower: { decrement: ZONE_TITLE_CHANGE_COST },
          zoneTitle: trimmed,
          lastZoneTitleChangeAt: new Date(),
        },
      }),
    ])

    return { success: true, cost: ZONE_TITLE_CHANGE_COST }
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
