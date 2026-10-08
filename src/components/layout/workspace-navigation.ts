import { BookOpen, Home, PenTool, Settings2, Sparkles, Trophy, CircleHelp } from 'lucide-react'

export const vocabularyTabs = [
  { href: '/history', label: '生词本' },
  { href: '/mistakes', label: '错词本' },
  { href: '/public-vocabulary', label: '公共词库' },
  { href: '/contributions', label: '单词贡献榜' },
]

export function getWorkspaceSection(pathname: string) {
  if (pathname.startsWith('/dictation') || pathname === '/mistakes') return 'review'
  if (pathname.startsWith('/study')) return 'study'
  if (vocabularyTabs.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`))) return 'vocabulary'
  if (pathname === '/ai' || pathname === '/chat') return 'translation'
  if (pathname.startsWith('/leaderboard')) return 'ranking'
  if (pathname.startsWith('/me')) return 'settings'
  if (pathname === '/download') return 'download'
  return 'home'
}

export const workspaceSections = {
  home: { label: '工作台', icon: Home },
  translation: { label: '翻译与聊天', icon: Sparkles },
  review: { label: '默写复习', icon: PenTool },
  study: { label: '四六级备考', icon: BookOpen },
  vocabulary: { label: '词库', icon: BookOpen },
  ranking: { label: '排行榜', icon: Trophy },
  settings: { label: '设置', icon: Settings2 },
  download: { label: '使用指南', icon: CircleHelp },
}
