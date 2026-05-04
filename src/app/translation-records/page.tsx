'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Languages,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  Database,
  Zap,
} from 'lucide-react'
import { useCrudTable } from '@/hooks/useCrudTable'
import { useRouter } from 'next/navigation'

interface TranslationRecord {
  id: string
  userId: string | null
  username: string
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  exampleTranslation: string | null
  isCached: boolean
  responseTime: number | null
  ipAddress: string | null
  createdAt: string
}

interface TranslationRecordsStats {
  totalRecords: number
  cacheRate: number
  cachedCount: number
  avgResponseTime: number
}

export default function TranslationRecordsPage() {
  const [selectedRecord, setSelectedRecord] = useState<TranslationRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const {
    authLoading,
    isAdmin,
    status,
    data: records,
    loading,
    error,
    extra,
    page,
    setPage,
    pagination,
    searchInput,
    setSearchInput,
    handleSearch,
    refresh,
  } = useCrudTable<TranslationRecord>({
    requireAdmin: true,
    pageSize: 20,
    buildUrl: (pageNum, pageSize, query) => {
      let url = `/api/translation-records?page=${pageNum}&limit=${pageSize}`
      if (query) url += `&word=${encodeURIComponent(query)}`
      return url
    },
    parseResponse: (json) => {
      const d = json.data as {
        records: TranslationRecord[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
        stats: unknown
      }
      return { data: d.records, pagination: d.pagination, extra: d.stats }
    },
  })

  const stats = extra as TranslationRecordsStats

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
        <Card>
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
                router.push(status === 'unauthenticated' ? '/auth/signin' : '/')
              }
            >
              {status === 'unauthenticated' ? '前往登录' : '返回首页'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleClearOldRecords = async (days: number) => {
    if (!confirm(`确定要删除 ${days} 天前的所有记录吗？此操作不可恢复。`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/translation-records?olderThanDays=${days}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
      } else {
        toast.error(json.error || '删除失败')
      }
    } catch (_e) {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  if (loading && !records) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error && !records) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium">{error}</p>
            <Button className="mt-4" onClick={refresh}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!records) return null

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div style={{ minWidth: 'max-content' }}>
            <h1 className="text-2xl font-bold" style={{ whiteSpace: 'nowrap' }}>翻译记录</h1>
            <p className="text-muted-foreground">查看用户翻译单词的详细记录</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">总记录数</span>
                </div>
                <p className="text-3xl font-bold mt-2">{stats.totalRecords}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">缓存命中率</span>
                </div>
                <p className="text-3xl font-bold mt-2">{stats.cacheRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.cachedCount} 次缓存命中</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <span className="text-sm text-muted-foreground">平均响应时间</span>
                </div>
                <p className="text-3xl font-bold mt-2">{stats.avgResponseTime}ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-muted-foreground">当前页</span>
                </div>
                <p className="text-3xl font-bold mt-2">
                  {pagination.page}/{pagination.totalPages}
                </p>
                <p className="text-xs text-muted-foreground mt-1">共 {pagination.total} 条</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div style={{ minWidth: 'max-content' }}>
                <CardTitle style={{ whiteSpace: 'nowrap' }}>翻译记录列表</CardTitle>
                <CardDescription>点击记录查看详情</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索单词..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full sm:w-48 max-w-[200px]"
                />
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {records.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">时间</th>
                        <th className="text-left py-2 px-2 font-medium">单词</th>
                        <th className="text-left py-2 px-2 font-medium">翻译</th>
                        <th className="text-left py-2 px-2 font-medium">用户</th>
                        <th className="text-left py-2 px-2 font-medium">状态</th>
                        <th className="text-left py-2 px-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                            {formatTime(record.createdAt)}
                          </td>
                          <td className="py-2 px-2">
                            <div>
                              <span className="font-medium">{record.word}</span>
                              {record.phonetic && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  {record.phonetic}
                                </span>
                              )}
                            </div>
                            {record.pos && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {record.pos}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-2 max-w-xs">
                            <p className="truncate">{record.translation}</p>
                          </td>
                          <td className="py-2 px-2">
                            <span
                              className={
                                record.username === '游客' ? 'text-muted-foreground' : 'font-medium'
                              }
                            >
                              {record.username}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant={record.isCached ? 'default' : 'secondary'}>
                              {record.isCached ? '缓存' : '新翻译'}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedRecord(record)
                              }}
                            >
                              详情
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClearOldRecords(30)}
                      disabled={deleting}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      清理30天前记录
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">
                      {page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p: number) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page >= pagination.totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">暂无记录</p>
            )}
          </CardContent>
        </Card>

        {selectedRecord && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedRecord(null)}
          >
            <Card
              className="max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>翻译详情</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(null)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">单词</p>
                    <p className="text-lg font-bold">{selectedRecord.word}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">音标</p>
                    <p className="text-lg">{selectedRecord.phonetic || '-'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">词性</p>
                  <p>{selectedRecord.pos || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">翻译</p>
                  <p className="text-lg">{selectedRecord.translation}</p>
                </div>

                {selectedRecord.example && (
                  <div>
                    <p className="text-sm text-muted-foreground">例句</p>
                    <p className="italic">{selectedRecord.example}</p>
                    {selectedRecord.exampleTranslation && (
                      <p className="text-muted-foreground mt-1">
                        {selectedRecord.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">用户</p>
                    <p>{selectedRecord.username}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">状态</p>
                    <Badge variant={selectedRecord.isCached ? 'default' : 'secondary'}>
                      {selectedRecord.isCached ? '缓存命中' : '新翻译'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">翻译时间</p>
                    <p>{formatTime(selectedRecord.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IP 地址</p>
                    <p className="font-mono text-sm">{selectedRecord.ipAddress || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
