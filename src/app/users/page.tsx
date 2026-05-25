'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, ArrowLeft, RefreshCw } from 'lucide-react'

type UserRow = {
  id: string
  username: string
  createdAt: string
  range: string
  totalEventsInRange: number
  activeDaysInRange: number
  sessionsInRange: number
  onlineMinutesInRange: number
  lastSeenAt: string | null
}

function fmt(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN')
}

export default function AdminUsersPage() {
  const { isLoading: authLoading, isAdmin, status } = useAdminCheck()
  const [range, setRange] = useState<string>('30d')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users?range=${range}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setRows(json.data)
      else setError(json.error || 'Failed to fetch users')
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch users:', error)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    if (isAdmin) fetchData()
  }, [isAdmin, fetchData])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">验证权限中...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-medium mb-2">无访问权限</p>
            <p className="text-sm text-muted-foreground mb-4">
              {status === 'unauthenticated'
                ? '请先登录后再访问此页面。'
                : '您没有管理员权限，无法访问此页面。'}
            </p>
            <Link href={status === 'unauthenticated' ? '/auth/signin' : '/'}>
              <Button>{status === 'unauthenticated' ? '前往登录' : '返回首页'}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <Link href="/analytics">
            <Button variant="outline" size="sm" className="shrink-0">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex-1 min-w-[120px]" style={{ minWidth: 'max-content' }}>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ whiteSpace: 'nowrap' }}>
              <Users className="w-6 h-6" />
              用户列表
            </h1>
            <p className="text-sm text-muted-foreground">
              注册时间、使用频率与在线时长（基于 analytics events 估算）
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[100px] sm:w-[120px]">
                <SelectValue placeholder="范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 小时</SelectItem>
                <SelectItem value="7d">7 天</SelectItem>
                <SelectItem value="30d">30 天</SelectItem>
                <SelectItem value="90d">90 天</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>注册用户</CardTitle>
            <CardDescription>
              在线时长按 session 内首末事件差值估算，单 session 上限 30 分钟
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : loading ? (
              <div className="text-muted-foreground text-sm">加载中...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">用户名</th>
                      <th className="text-left py-2 px-2 font-medium">注册时间</th>
                      <th className="text-left py-2 px-2 font-medium">最近活跃</th>
                      <th className="text-right py-2 px-2 font-medium">事件数</th>
                      <th className="text-right py-2 px-2 font-medium">活跃天数</th>
                      <th className="text-right py-2 px-2 font-medium">Sessions</th>
                      <th className="text-right py-2 px-2 font-medium">累计搜索单词</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">{u.username}</td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {fmt(u.createdAt)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {fmt(u.lastSeenAt)}
                        </td>
                        <td className="py-2 px-2 text-right">{u.totalEventsInRange}</td>
                        <td className="py-2 px-2 text-right">{u.activeDaysInRange}</td>
                        <td className="py-2 px-2 text-right">{u.sessionsInRange}</td>
                        <td className="py-2 px-2 text-right">{u.onlineMinutesInRange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
