'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Users,
  BookOpen,
  Languages,
  PenTool,
  AlertTriangle,
  TrendingUp,
  Activity,
  FileJson,
  FileSpreadsheet,
  ExternalLink,
  Database,
  BarChart3,
  Filter,
} from 'lucide-react'
import Link from 'next/link'
import { useAdminCheck } from '@/hooks/useAdminCheck'

interface RecentEvent {
  id: string
  eventType: string
  userId: string | null
  username: string | null
  sessionId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

interface GuestStats {
  totalQueries: number
  totalFound: number
  totalNotFound: number
  successRate: number
  queryCount: number
  errorCount: number
  avgResponseTime: number
  errorReasons: { reason: string; count: number }[]
  dailyTrend: {
    date: string
    total: number
    found: number
    notFound: number
    successRate: number
  }[]
}

interface UserStats {
  totalQueries: number
  totalSuccess: number
  totalFailed: number
  successRate: number
  queryCount: number
  errorCount: number
  errorReasons: { reason: string; count: number }[]
  dailyTrend: {
    date: string
    total: number
    success: number
    failed: number
    successRate: number
  }[]
}

interface TopWord {
  word: string
  count: number
}

interface AnalyticsData {
  overview: {
    totalUsers: number
    newUsers: number
    dau: number
    totalWords: number
    totalTranslations: number
    totalDictations: number
    totalErrors: number
  }
  userStats: UserStats
  guestStats: GuestStats
  topWords: TopWord[]
  eventsByType: Record<string, number>
  dailyTrend: { date: string; count: number }[]
  recentEvents: RecentEvent[]
  range: string
  excludeTestUsers: boolean
}

const eventTypeLabels: Record<string, string> = {
  PAGE_VIEW: '页面浏览',
  TRANSLATE: '单词翻译',
  TRANSLATE_ONLY: '文本翻译',
  DICTATION_START: '开始默写',
  DICTATION_COMPLETE: '完成默写',
  DICTATION_ERROR: '默写错误',
  LOGIN: '登录',
  LOGOUT: '登出',
  REGISTER: '注册',
  SHARE: '分享',
  ERROR: '错误',
  API_ERROR: 'API错误',
  GUEST_TRANSLATE: '游客查词',
  GUEST_TRANSLATE_ERROR: '游客查词失败',
}

const eventTypeColors: Record<string, string> = {
  PAGE_VIEW: 'bg-gray-500',
  TRANSLATE: 'bg-blue-500',
  TRANSLATE_ONLY: 'bg-cyan-500',
  DICTATION_START: 'bg-yellow-500',
  DICTATION_COMPLETE: 'bg-green-500',
  DICTATION_ERROR: 'bg-red-400',
  LOGIN: 'bg-indigo-500',
  LOGOUT: 'bg-gray-400',
  REGISTER: 'bg-purple-500',
  SHARE: 'bg-pink-500',
  ERROR: 'bg-red-500',
  API_ERROR: 'bg-red-600',
  GUEST_TRANSLATE: 'bg-teal-500',
  GUEST_TRANSLATE_ERROR: 'bg-red-400',
}

export default function AnalyticsPage() {
  const { isLoading: authLoading, isAdmin, status } = useAdminCheck()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('7d')
  const [exporting, setExporting] = useState(false)
  const [excludeTestUsers, setExcludeTestUsers] = useState(true)

  const fetchData = useCallback(async (selectedRange: string, exclude: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?range=${selectedRange}&excludeTestUsers=${exclude}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Failed to fetch data')
      }
    } catch (_e) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchData(range, excludeTestUsers)
    }
  }, [range, isAdmin, excludeTestUsers, fetchData])

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true)
    try {
      const res = await fetch(
        `/api/analytics?range=${range}&format=${format}&excludeTestUsers=${excludeTestUsers}`,
        {
          method: 'DELETE',
        },
      )

      if (format === 'csv') {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics_${range}_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        const json = await res.json()
        if (json.success) {
          const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `analytics_${range}_${new Date().toISOString().split('T')[0]}.json`
          a.click()
          window.URL.revokeObjectURL(url)
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getMetadataDisplay = (event: RecentEvent): string => {
    if (!event.metadata) return '-'
    const meta = event.metadata
    if (event.eventType === 'TRANSLATE') {
      return `${meta.wordCount || 0} 词${meta.cached ? ' (缓存)' : ''}`
    }
    if (event.eventType === 'TRANSLATE_ONLY') {
      return `${meta.charCount || 0} 字符`
    }
    if (event.eventType === 'DICTATION_START') {
      return `${meta.wordCount || 0} 词 ${meta.mode || '-'}`
    }
    if (event.eventType === 'DICTATION_COMPLETE') {
      return `${meta.score || 0}/${meta.total || 0} (${meta.percentage || 0}%)`
    }
    if (event.eventType === 'PAGE_VIEW') {
      return String(meta.pageName || meta.path || '-')
    }
    if (event.eventType === 'GUEST_TRANSLATE') {
      return `${meta.totalWords || 0} 词 成功率${meta.successRate || 0}%`
    }
    if (event.eventType === 'GUEST_TRANSLATE_ERROR') {
      return String(meta.error || 'Unknown error')
    }
    return JSON.stringify(meta)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">验证权限中...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">无访问权限</p>
            <p className="text-sm text-muted-foreground mb-4">
              {status === 'unauthenticated'
                ? '请先登录后再访问此页面。'
                : '您没有管理员权限，无法访问此页面。'}
            </p>
            <Button
              onClick={() =>
                (window.location.href = status === 'unauthenticated' ? '/auth/signin' : '/')
              }
            >
              {status === 'unauthenticated' ? '前往登录' : '返回首页'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium">{error}</p>
            <Button className="mt-4" onClick={() => fetchData(range, excludeTestUsers)}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const maxDailyCount = Math.max(...data.dailyTrend.map((d) => d.count), 1)
  const _maxGuestDailyCount = Math.max(...data.guestStats.dailyTrend.map((d) => d.total), 1)

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div style={{ minWidth: 'max-content' }}>
            <h1 className="text-2xl font-bold" style={{ whiteSpace: 'nowrap' }}>数据分析看板</h1>
            <p className="text-muted-foreground">查看应用使用情况和关键指标</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Link href="/users">
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                用户列表
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </Link>
            <Link href="/llm-config">
              <Button variant="outline" size="sm">
                <Database className="w-4 h-4 mr-2" />
                LLM 配置
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </Link>
            <Link href="/translation-records">
              <Button variant="outline" size="sm">
                <Languages className="w-4 h-4 mr-2" />
                翻译记录
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </Link>
            <Link href="/public-words">
              <Button variant="outline" size="sm">
                <BookOpen className="w-4 h-4 mr-2" />
                公共词库
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </Link>
            {(['24h', '7d', '30d'] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRange(r)}
              >
                {r === '24h' ? '24小时' : r === '7d' ? '7天' : '30天'}
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Filter className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">数据过滤</p>
                  <p className="text-sm text-muted-foreground">排除管理员和测试账号数据</p>
                </div>
              </div>
              <Switch checked={excludeTestUsers} onCheckedChange={setExcludeTestUsers} />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">新增用户</span>
              </div>
              <p className="text-3xl font-bold mt-2">{data.overview.totalUsers}</p>
              <p className="text-xs text-green-500 mt-1">+{data.overview.newUsers} 用户</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                <span className="text-sm text-muted-foreground">日活用户</span>
              </div>
              <p className="text-3xl font-bold mt-2">{data.overview.dau}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.overview.totalUsers > 0
                  ? Math.round((data.overview.dau / data.overview.totalUsers) * 100)
                  : 0}
                % 活跃率
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-purple-500" />
                <span className="text-sm text-muted-foreground">翻译次数</span>
              </div>
              <p className="text-3xl font-bold mt-2">{data.overview.totalTranslations}</p>
              <p className="text-xs text-muted-foreground mt-1">核心功能使用</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-orange-500" />
                <span className="text-sm text-muted-foreground">默写次数</span>
              </div>
              <p className="text-3xl font-bold mt-2">{data.overview.totalDictations}</p>
              <p className="text-xs text-muted-foreground mt-1">学习功能使用</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-indigo-200 dark:border-indigo-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-indigo-500" />
              用户查询统计
            </CardTitle>
            <CardDescription>登录用户翻译查询情况分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {data.userStats.totalQueries}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">排除管理员和测试账号数据</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.userStats.totalSuccess}
                </p>
                <p className="text-sm text-muted-foreground">总成功事件</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.userStats.totalFailed}
                </p>
                <p className="text-sm text-muted-foreground">总失败事件</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {data.userStats.successRate.toFixed(2)}%
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">排除管理员和测试账号数据</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {data.userStats.queryCount}
                </p>
                <p className="text-sm text-muted-foreground">查询计数</p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {data.userStats.errorCount}
                </p>
                <p className="text-sm text-muted-foreground">错误次数</p>
              </div>
            </div>

            {data.userStats.dailyTrend.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">每日查询趋势</h4>
                <div className="space-y-2">
                  {data.userStats.dailyTrend.slice(-7).map((item) => (
                    <div key={item.date} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20">
                        {item.date.slice(5)}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden flex">
                        <div
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${(item.success / Math.max(item.total, 1)) * 100}%` }}
                        />
                        <div
                          className="h-full bg-red-400 transition-all duration-300"
                          style={{ width: `${(item.failed / Math.max(item.total, 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-20 text-right">
                        {item.total} ({item.successRate.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.userStats.errorReasons.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">错误原因统计</h4>
                <div className="flex flex-wrap gap-2">
                  {data.userStats.errorReasons.map((item, idx) => (
                    <Badge key={idx} variant="outline" className="bg-red-50 dark:bg-red-950/30">
                      {item.reason}: {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-teal-200 dark:border-teal-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-teal-500" />
              用户事件统计
            </CardTitle>
            <CardDescription>公共词库查询情况分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                  {data.guestStats.totalQueries}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">排除管理员和测试账号数据</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.guestStats.totalFound}
                </p>
                <p className="text-sm text-muted-foreground">成功找到</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {data.guestStats.totalNotFound}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">排除管理员和测试账号数据</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {data.guestStats.successRate.toFixed(2)}%
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">排除管理员和测试账号数据</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {data.guestStats.queryCount}
                </p>
                <p className="text-sm text-muted-foreground">其他功能点击数</p>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {data.guestStats.avgResponseTime}ms
                </p>
                <p className="text-sm text-muted-foreground">平均查询用时</p>
              </div>
            </div>

            {data.guestStats.dailyTrend.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">每日查询趋势</h4>
                <div className="space-y-2">
                  {data.guestStats.dailyTrend.slice(-7).map((item) => (
                    <div key={item.date} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20">
                        {item.date.slice(5)}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden flex">
                        <div
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${(item.found / Math.max(item.total, 1)) * 100}%` }}
                        />
                        <div
                          className="h-full bg-red-400 transition-all duration-300"
                          style={{ width: `${(item.notFound / Math.max(item.total, 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-20 text-right">
                        {item.total} ({item.successRate.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.guestStats.errorReasons.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">错误原因统计</h4>
                <div className="flex flex-wrap gap-2">
                  {data.guestStats.errorReasons.map((item, idx) => (
                    <Badge key={idx} variant="outline" className="bg-red-50 dark:bg-red-950/30">
                      {item.reason}: {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                热门词汇 Top 20
              </CardTitle>
              <CardDescription>今日热门查询</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topWords.length > 0 ? (
                <div className="space-y-2">
                  {data.topWords.map((item, idx) => (
                    <div key={item.word} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-6 text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className="font-medium flex-1 truncate">{item.word}</span>
                      <Badge variant="secondary">{item.count} 次</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">暂无数据</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                活动趋势
              </CardTitle>
              <CardDescription>每日事件数量变化</CardDescription>
            </CardHeader>
            <CardContent>
              {data.dailyTrend.length > 0 ? (
                <div className="space-y-2">
                  {data.dailyTrend.slice(-7).map((item) => (
                    <div key={item.date} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20">
                        {item.date.slice(5)}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${(item.count / maxDailyCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              事件分布
            </CardTitle>
            <CardDescription>查询事件分布图</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(data.eventsByType).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.eventsByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${eventTypeColors[type] || 'bg-gray-500'}`}
                        />
                        <span className="text-xs">{eventTypeLabels[type] || type}</span>
                      </div>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  最近查询记录
                </CardTitle>
                <CardDescription>最近50条查询记录</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  导出为 JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  导出为 CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentEvents && data.recentEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">时间</th>
                      <th className="text-left py-2 px-2 font-medium">事件类型</th>
                      <th className="text-left py-2 px-2 font-medium">用户</th>
                      <th className="text-left py-2 px-2 font-medium">详情</th>
                      <th className="text-left py-2 px-2 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentEvents.map((event) => (
                      <tr key={event.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {formatTime(event.createdAt)}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs text-white ${eventTypeColors[event.eventType] || 'bg-gray-500'}`}
                          >
                            {eventTypeLabels[event.eventType] || event.eventType}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          {event.username ? (
                            <span className="font-medium">{event.username}</span>
                          ) : (
                            <span className="text-muted-foreground">游客</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground max-w-xs truncate">
                          {getMetadataDisplay(event)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {event.ipAddress || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">暂无记录</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
