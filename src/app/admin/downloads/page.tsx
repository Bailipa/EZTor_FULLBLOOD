'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, Users, Monitor, Smartphone, Globe, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface PlatformStats {
  platform: string
  count: number
}

interface FileStats {
  fileName: string
  platform: string
  version: string | null
  count: number
}

interface DailyTrend {
  date: string
  count: number
}

interface RecentRecord {
  id: string
  platform: string
  fileName: string
  version: string | null
  ipAddress: string | null
  createdAt: string
}

interface DownloadStatsData {
  range: string
  total: number
  byPlatform: PlatformStats[]
  byFile: FileStats[]
  dailyTrend: DailyTrend[]
  recent: RecentRecord[]
}

interface OnlineUser {
  ip: string
  platform: 'web' | 'android' | 'desktop'
  userId: string | null
  username: string | null
  lastActiveAt: string
}

interface OnlineData {
  total: number
  platforms: Record<'web' | 'android' | 'desktop', { count: number; users: OnlineUser[] }>
}

const PLATFORM_LABELS: Record<string, string> = {
  windows: 'Windows',
  mac: 'macOS',
  android: 'Android',
  linux: 'Linux',
}

const CLIENT_PLATFORM_LABELS: Record<string, string> = {
  web: '网页版',
  android: '安卓 App',
  desktop: '桌面 App',
}

const CLIENT_PLATFORM_ICONS: Record<string, React.ReactNode> = {
  web: <Globe className="w-5 h-5" />,
  android: <Smartphone className="w-5 h-5" />,
  desktop: <Monitor className="w-5 h-5" />,
}

const platformColors: Record<string, string> = {
  windows: 'bg-blue-500',
  mac: 'bg-zinc-500',
  android: 'bg-green-500',
  linux: 'bg-orange-500',
}

export default function AdminDownloadsPage() {
  const { isLoading: authLoading, isAdmin, status } = useAdminCheck()
  const [range, setRange] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DownloadStatsData | null>(null)
  const [online, setOnline] = useState<OnlineData | null>(null)

  const fetchStats = useCallback(async (selectedRange: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/downloads?range=${selectedRange}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setStats(json.data)
      else setError(json.error || '加载失败')
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchOnline = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/online', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setOnline(json.data)
    } catch {
      // 静默，仅重试
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchStats(range)
      fetchOnline()
      const timer = setInterval(fetchOnline, 20000)
      return () => clearInterval(timer)
    }
  }, [isAdmin, range, fetchStats, fetchOnline])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
              {status === 'unauthenticated' ? '请先登录后再访问此页面。' : '您没有管理员权限，无法访问此页面。'}
            </p>
            <Link href={status === 'unauthenticated' ? '/auth/signin' : '/'}>
              <Button>{status === 'unauthenticated' ? '前往登录' : '返回首页'}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxTrend = Math.max(...(stats?.dailyTrend.map((d) => d.count) || []), 1)

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background p-4 md:p-8 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] xl:pb-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">下载与在线统计</h1>
            <p className="text-sm text-muted-foreground">安装包下载统计 · 各端在线人数与名单</p>
          </header>

          {/* 在线人数与名单 */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-500" />
                  当前在线
                </CardTitle>
                <CardDescription>5 分钟内有访问活动的设备（每 20 秒刷新）</CardDescription>
              </div>
              {online && <Badge variant="secondary" className="text-base">{online.total} 台设备</Badge>}
            </CardHeader>
            <CardContent>
              {!online ? (
                <p className="text-center text-muted-foreground py-6">暂无数据</p>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {(Object.keys(CLIENT_PLATFORM_LABELS) as Array<'web' | 'android' | 'desktop'>).map((key) => {
                    const group = online.platforms[key]
                    return (
                      <div key={key} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 bg-muted/40">
                          <span className="text-green-600 dark:text-green-400">{CLIENT_PLATFORM_ICONS[key]}</span>
                          <span className="font-medium">{CLIENT_PLATFORM_LABELS[key]}</span>
                          <Badge variant="secondary" className="ml-auto">{group.count}</Badge>
                        </div>
                        <div className="max-h-56 overflow-y-auto divide-y divide-border">
                          {group.users.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">暂无在线</p>
                          ) : (
                            group.users.map((u) => (
                              <div key={u.ip} className="px-4 py-2 flex items-center justify-between">
                                <span className="text-sm font-medium truncate">
                                  {u.username || <span className="text-muted-foreground">游客</span>}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                  {u.username ? u.ip : u.ip} · {formatTime(u.lastActiveAt)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 下载统计 */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-500" />
                  下载统计
                </CardTitle>
                <CardDescription>安装包（exe/dmg/apk/zip）实际下载次数</CardDescription>
              </div>
              <div className="flex gap-2">
                {(['24h', '7d', '30d', '90d'] as const).map((r) => (
                  <Button key={r} size="sm" variant={range === r ? 'default' : 'outline'} onClick={() => setRange(r)}>
                    {r === '24h' ? '24小时' : r === '7d' ? '7天' : r === '30d' ? '30天' : '90天'}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <p className="text-center text-red-500 py-6">{error}</p>
              ) : stats ? (
                <div className="space-y-6">
                  {/* 平台汇总 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">总下载</p>
                    </div>
                    {stats.byPlatform.map((p) => (
                      <div key={p.platform} className="p-4 bg-muted/40 rounded-lg text-center">
                        <p className="text-2xl font-bold">{p.count}</p>
                        <p className="text-xs text-muted-foreground">{PLATFORM_LABELS[p.platform] || p.platform}</p>
                      </div>
                    ))}
                  </div>

                  {/* 每日趋势 */}
                  {stats.dailyTrend.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">每日下载趋势</h4>
                      <div className="space-y-2">
                        {stats.dailyTrend.slice(-7).map((item) => (
                          <div key={item.date} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-20">{item.date.slice(5)}</span>
                            <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(item.count / maxTrend) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-10 text-right">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 按文件 */}
                  {stats.byFile.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">按安装包</h4>
                      <div className="space-y-2">
                        {stats.byFile.map((f) => (
                          <div key={f.fileName} className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${platformColors[f.platform] || 'bg-gray-400'}`}
                            />
                            <span className="text-sm font-mono truncate flex-1">{f.fileName}</span>
                            <Badge variant="secondary">{PLATFORM_LABELS[f.platform] || f.platform}</Badge>
                            <span className="text-sm font-medium w-10 text-right">{f.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 最近记录 */}
                  {stats.recent.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">最近下载</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium">时间</th>
                              <th className="text-left py-2 px-2 font-medium">平台</th>
                              <th className="text-left py-2 px-2 font-medium">安装包</th>
                              <th className="text-left py-2 px-2 font-medium">IP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.recent.map((r) => (
                              <tr key={r.id} className="border-b hover:bg-muted/40">
                                <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{formatTime(r.createdAt)}</td>
                                <td className="py-2 px-2">
                                  <Badge variant="outline">{PLATFORM_LABELS[r.platform] || r.platform}</Badge>
                                </td>
                                <td className="py-2 px-2 font-mono text-xs truncate max-w-[220px]">{r.fileName}</td>
                                <td className="py-2 px-2 text-muted-foreground text-xs">{r.ipAddress || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {stats.total === 0 && <p className="text-center text-muted-foreground py-6">暂无下载数据</p>}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
