'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'

interface AiUserRow {
  userId: string
  username: string
  nickname: string | null
  isAiFree: boolean
  askCount: number
  totalCost: number
  lastUsedAt: string | null
}

interface AiLogRow {
  id: string
  prompt: string
  cost: number
  isAiFree: boolean
  turns: number
  createdAt: string
}

export default function AdminAiPage() {
  const { isLoading, isAdmin } = useAdminCheck()
  const [rows, setRows] = useState<AiUserRow[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [logs, setLogs] = useState<AiLogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const fetchRows = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/ai/stats?${params}`)
      const data = await res.json()
      if (data.success) {
        setRows(data.data)
        setPagination(data.pagination)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    if (isAdmin) fetchRows(1)
  }, [isAdmin, fetchRows])

  const handleSearch = () => setSearch(searchInput)

  const toggleUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null)
      setLogs([])
      return
    }
    setExpandedUser(userId)
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/admin/ai/logs?userId=${userId}&limit=20`)
      const data = await res.json()
      if (data.success) setLogs(data.data)
    } catch { /* ignore */ }
    finally { setLogsLoading(false) }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">无权访问</div>
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI 询问统计
            </h1>
            <p className="text-sm text-muted-foreground mt-1">按用户统计 AI 询问使用量与学力消耗，点击展开查看提问内容</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索用户名或昵称…"
            className="max-w-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} variant="outline"><Search className="w-4 h-4" /></Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">暂无 AI 使用记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">用户</th>
                      <th className="text-right py-2 px-3 font-medium">提问次数</th>
                      <th className="text-right py-2 px-3 font-medium">消耗学力</th>
                      <th className="text-center py-2 px-3 font-medium">免费</th>
                      <th className="text-right py-2 px-3 font-medium">最近使用</th>
                      <th className="text-center py-2 px-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <Fragment key={u.userId}>
                        <tr className="border-b hover:bg-muted/40">
                          <td className="py-2 px-3 font-medium">
                            <div className="flex flex-col">
                              <span>{u.nickname || u.username}</span>
                              {u.nickname && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">{u.askCount}</td>
                          <td className="py-2 px-3 text-right">{u.totalCost}</td>
                          <td className="py-2 px-3 text-center">
                            {u.isAiFree ? <Badge variant="outline" className="text-amber-600 dark:text-amber-400">免费</Badge> : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="py-2 px-3 text-right text-xs text-muted-foreground">
                            {u.lastUsedAt ? new Date(u.lastUsedAt).toLocaleString('zh-CN') : '-'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => toggleUser(u.userId)}>
                              {expandedUser === u.userId ? '收起' : '查看提问'}
                            </Button>
                          </td>
                        </tr>
                        {expandedUser === u.userId && (
                          <tr key={`${u.userId}-logs`} className="bg-muted/30">
                            <td colSpan={6} className="py-3 px-3">
                              {logsLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                              ) : logs.length === 0 ? (
                                <div className="text-center text-xs text-muted-foreground">暂无提问记录</div>
                              ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                  {logs.map((l) => (
                                    <div key={l.id} className="bg-background rounded-lg border border-border/60 p-3">
                                      <div className="text-xs text-muted-foreground mb-1">
                                        {new Date(l.createdAt).toLocaleString('zh-CN')} · 消耗 {l.cost} 学力 · {l.turns} 轮
                                        {l.isAiFree && <Badge variant="outline" className="ml-2 text-amber-600">免费</Badge>}
                                      </div>
                                      <div className="text-sm break-words">{l.prompt}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchRows(pagination.page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{pagination.page}/{pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchRows(pagination.page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
