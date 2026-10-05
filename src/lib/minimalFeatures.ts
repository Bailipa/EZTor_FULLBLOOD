export const MINIMAL_FEATURE_GROUPS = {
  main: [
    { id: 'home', label: '首页' }, { id: 'dictation', label: '默写复习' },
    { id: 'vocabulary', label: '词库' }, { id: 'translation', label: '翻译与聊天' },
    { id: 'leaderboard', label: '排行榜' }, { id: 'danmaku', label: '弹幕复习' },
  ],
  translation: [
    { id: 'realtime', label: '实时翻译' }, { id: 'zh-en', label: '中译英' },
    { id: 'text', label: '译句子' }, { id: 'ai', label: '问AI助手' }, { id: 'chat', label: '聊天室' },
  ],
  vocabulary: [
    { id: 'history', label: '生词本' }, { id: 'public', label: '公共词库' }, { id: 'contributions', label: '单词贡献榜' },
  ],
} as const

export type MinimalFeatures = { main: string[]; translation: string[]; vocabulary: string[] }
export const DEFAULT_MINIMAL_FEATURES: MinimalFeatures = {
  main: ['dictation', 'vocabulary', 'translation'], translation: ['realtime'], vocabulary: ['history'],
}

export function isMinimalFeatures(value: unknown): value is MinimalFeatures {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 3 && Object.entries(MINIMAL_FEATURE_GROUPS).every(([key, options]) => {
    const items = record[key]
    return Array.isArray(items) && items.length <= options.length && new Set(items).size === items.length
      && items.every((id) => typeof id === 'string' && options.some((option) => option.id === id))
  })
}

export function equalMinimalFeatures(left: unknown, right: unknown): boolean {
  if (!isMinimalFeatures(left) || !isMinimalFeatures(right)) return false
  return (['main', 'translation', 'vocabulary'] as const).every((key) =>
    left[key].length === right[key].length && left[key].every((id, index) => id === right[key][index]),
  )
}

export function minimalMainFeature(href: string): string | null {
  if (href === '/') return 'home'
  if (href === '/dictation' || href === '/mistakes') return 'dictation'
  if (['/history', '/public-vocabulary', '/contributions'].includes(href)) return 'vocabulary'
  if (href === '/ai' || href === '/chat') return 'translation'
  if (href === '/leaderboard') return 'leaderboard'
  return null
}
