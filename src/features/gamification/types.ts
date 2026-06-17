import type { TaskType, FeatureKey } from './constants'

export interface GameProfile {
  id: string
  userId: string
  nickname: string | null
  combatPower: number
  monthlyPower: number
  weeklyPower: number
  dailyPowerGained: number
  dailyPowerCap: number
  dailyPowerDate: string
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  nicknameChangedAt: Date | null
  unlockedFeatures: string[]
  zoneId: string | null
  lastZoneTransferAt: Date | null
  zoneTitle: string | null
  lastZoneTitleChangeAt: Date | null
}

export interface DailyTaskState {
  taskType: TaskType
  title: string
  description: string
  targetValue: number
  currentValue: number
  powerReward: number
  isCompleted: boolean
  completedAt: Date | null
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  nickname: string
  previousNickname: string | null
  nicknameChangedAt: string | null
  combatPower: number
  currentStreak: number
  isCurrentUser: boolean
  zoneTitle: string
}

export interface ZoneInfo {
  id: string
  name: string
  memberCount: number
  maxMembers: number
  members: LeaderboardEntry[]
  isCurrentUserTop: boolean
  previousName: string | null
  renamedByName: string | null
  renamedAt: string | null
  canTransfer: boolean
  transferCooldownRemaining: number
}

export interface AddPowerResult {
  powerGained: number
  totalPower: number
  newlyUnlocked: FeatureKey[]
}

export interface TaskCompleteResult {
  taskCompleted: boolean
  powerGained: number
  totalPower: number
  newlyUnlocked: FeatureKey[]
}
