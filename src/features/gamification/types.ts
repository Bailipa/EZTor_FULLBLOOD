import type { TaskType, FeatureKey, TaskMilestone } from './constants'

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
  /** 里程碑任务配置（无则普通任务） */
  milestones?: TaskMilestone[]
  /** 下一个待发奖的里程碑下标（里程碑任务用） */
  milestoneIndex?: number
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  nickname: string
  previousNickname: string | null
  nicknameChangedAt: string | null
  score: number
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
