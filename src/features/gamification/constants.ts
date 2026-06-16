export const DAILY_POWER_CAP = 100

export const TASK_TYPES = {
  LOGIN: 'LOGIN',
  COMPLETE_REVIEWS: 'COMPLETE_REVIEWS',
  REACH_ACCURACY: 'REACH_ACCURACY',
  FLASHCARD_INTERACT: 'FLASHCARD_INTERACT',
} as const

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES]

export interface TaskConfig {
  type: TaskType
  title: string
  description: string
  targetValue: number
  powerReward: number
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
    title: '听写复习',
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
    description: '认识/不认识15个单词',
    targetValue: 15,
    powerReward: 20,
  },
]

export const STREAK_POWER_MULTIPLIER = 2
export const STREAK_POWER_CAP = 30

export const FEATURE_UNLOCK_THRESHOLDS = {
  DANMAKU: 50,
  SHARE_POSTER: 100,
  MINI_GAME: 200,
} as const

export type FeatureKey = keyof typeof FEATURE_UNLOCK_THRESHOLDS

export const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
  DANMAKU: '弹幕复习',
  SHARE_POSTER: '收获',
  MINI_GAME: '小游戏',
}

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  DANMAKU: '边看边学，单词在屏幕上飘过',
  SHARE_POSTER: '分享你的学习成果给朋友',
  MINI_GAME: '劳逸结合，来一局小游戏放松一下',
}

export const ZONE_MAX_MEMBERS = 50
export const ZONE_RENAME_COST = 10
export const ZONE_NAME_MAX_LENGTH = 12
export const NICKNAME_CHANGE_COST = 10
export const NICKNAME_PREVIOUS_DISPLAY_DAYS = 3
export const NICKNAME_MAX_LENGTH = 12
export const LEADERBOARD_LIMIT = 100
export const ACCURACY_MIN_ATTEMPTS = 10
