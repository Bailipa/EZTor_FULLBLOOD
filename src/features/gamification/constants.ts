export const DAILY_POWER_CAP = 160

// 注册即赠 50 学力：直接解锁"弹幕复习"（阈值 50）
export const SIGNUP_POWER_BONUS = 50

export const TASK_TYPES = {
  LOGIN: 'LOGIN',
  COMPLETE_REVIEWS: 'COMPLETE_REVIEWS',
  REACH_ACCURACY: 'REACH_ACCURACY',
  FLASHCARD_INTERACT: 'FLASHCARD_INTERACT',
  SHARE: 'SHARE',
} as const

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES]

export interface TaskMilestone {
  /** 达到该累计单词数时发奖 */
  target: number
  powerReward: number
}

export interface TaskConfig {
  type: TaskType
  title: string
  description: string
  targetValue: number
  powerReward: number
  /** 可选：里程碑任务（如闪卡 15/30/50 各发一次奖），达到 target 后进度条进入下一段 */
  milestones?: TaskMilestone[]
}

export const TASK_CONFIGS: TaskConfig[] = [
  {
    type: TASK_TYPES.LOGIN,
    title: '每日登录',
    description: '登录即完成',
    targetValue: 1,
    powerReward: 10,
  },
  {
    type: TASK_TYPES.COMPLETE_REVIEWS,
    title: '默写复习',
    description: '默写20个单词',
    targetValue: 20,
    powerReward: 30,
  },
  {
    type: TASK_TYPES.REACH_ACCURACY,
    title: '正确率挑战',
    description: '至少默写10个单词，正确率≥80%',
    targetValue: 80,
    powerReward: 25,
  },
  {
    type: TASK_TYPES.FLASHCARD_INTERACT,
    title: '闪卡互动',
    description: '认识/不认识50个单词，每段达标发奖',
    targetValue: 50,
    powerReward: 20,
    milestones: [
      { target: 15, powerReward: 20 },
      { target: 30, powerReward: 20 },
      { target: 50, powerReward: 20 },
    ],
  },
]

export const SHARE_POWER_REWARD = 15

export const STREAK_POWER_MULTIPLIER = 2
export const STREAK_POWER_CAP = 30

export const FEATURE_UNLOCK_THRESHOLDS = {
  DANMAKU: 50,
  MINI_GAME: 200,
} as const

export type FeatureKey = keyof typeof FEATURE_UNLOCK_THRESHOLDS

export const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
  DANMAKU: '弹幕复习',
  MINI_GAME: '小游戏',
}

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  DANMAKU: '边看边学，单词在屏幕上飘过',
  MINI_GAME: '劳逸结合，来一局小游戏放松一下',
}

export const ZONE_MAX_MEMBERS = 15
export const ZONE_RENAME_COST = 10
export const ZONE_TRANSFER_COST = 20
export const ZONE_TRANSFER_COOLDOWN_DAYS = 3
export const ZONE_NAME_MAX_LENGTH = 12
export const ZONE_TITLES = {
  RANK_1: '英帝',
  RANK_2: '超英',
  RANK_3: '初英',
  DEFAULT: '小英',
} as const
export const ZONE_TITLE_MAX_LENGTH = 6
export const ZONE_TITLE_CHANGE_COST = 20
export const ZONE_TITLE_CHANGE_COOLDOWN_DAYS = 3
export const NICKNAME_CHANGE_COST = 10
export const NICKNAME_PREVIOUS_DISPLAY_DAYS = 3
export const NICKNAME_MAX_LENGTH = 12
export const LEADERBOARD_LIMIT = 100
export const ACCURACY_MIN_ATTEMPTS = 10
