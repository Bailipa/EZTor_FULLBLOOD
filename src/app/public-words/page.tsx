'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Database,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit,
  Plus,
  Star,
  TrendingUp,
  BarChart3,
} from 'lucide-react'
import { useCrudTable } from '@/hooks/useCrudTable'
import { useRouter } from 'next/navigation'

interface PublicWord {
  id: string
  word: string
  phonetic: string | null
  pos: string | null
  translation: string
  example: string | null
  exampleTranslation: string | null
  qualityScore: number
  version: number
  createdAt: string
  updatedAt: string
}

interface PublicWordsStats {
  totalWords: number
  avgQuality: number
  maxQuality: number
  minQuality: number
  qualityDistribution: { score: number; count: number }[]
}

export default function PublicWordsPage() {
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [minQuality, setMinQuality] = useState('')
  const [maxQuality, setMaxQuality] = useState('')
  const [selectedWord, setSelectedWord] = useState<PublicWord | null>(null)
  const [editingWord, setEditingWord] = useState<PublicWord | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const router = useRouter()
  const buildUrl = useCallback(
    (pageNum: number, pageSize: number, query: string) => {
      let url = `/api/public-words?page=${pageNum}&limit=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`
      if (query) url += `&word=${encodeURIComponent(query)}`
      if (minQuality) url += `&minQuality=${minQuality}`
      if (maxQuality) url += `&maxQuality=${maxQuality}`
      return url
    },
    [sortBy, sortOrder, minQuality, maxQuality],
  )

  const {
    authLoading,
    isAdmin,
    status,
    data: words,
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
  } = useCrudTable<PublicWord>({
    requireAdmin: true,
    pageSize: 20,
    buildUrl,
    parseResponse: (json) => {
      const d = json.data as {
        words: PublicWord[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
        stats: unknown
      }
      return { data: d.words, pagination: d.pagination, extra: d.stats }
    },
  })

  const stats = extra as PublicWordsStats

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

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个词吗？')) return

    try {
      const res = await fetch(`/api/public-words?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        refresh()
        setSelectedWord(null)
      } else {
        toast.error(json.error || 'Delete failed')
      }
    } catch (_e) {
      toast.error('Network error')
    }
  }

  const handleSaveEdit = async () => {
    if (!editingWord) return
    setSaving(true)
    try {
      const res = await fetch('/api/public-words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingWord),
      })
      const json = await res.json()
      if (json.success) {
        setEditingWord(null)
        refresh()
        setSelectedWord(null)
      } else {
        toast.error(json.error || 'Update failed')
      }
    } catch (_e) {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (newWord: Partial<PublicWord>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/public-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWord),
      })
      const json = await res.json()
      if (json.success) {
        setShowAddForm(false)
        setPage(1)
        refresh()
      } else {
        toast.error(json.error || 'Add failed')
      }
    } catch (_e) {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getQualityBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">优秀</Badge>
    if (score >= 60) return <Badge className="bg-yellow-500">良好</Badge>
    if (score >= 40) return <Badge className="bg-orange-500">一般</Badge>
    return <Badge className="bg-red-500">较差</Badge>
  }

  if (loading && !words) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 animate-pulse mx-auto text-blue-500" />
          <p className="mt-4 text-gray-600">加载公共词库数据...</p>
        </div>
      </div>
    )
  }

  if (error && !words) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-red-500">
              <AlertTriangle className="h-8 w-8" />
              <div>
                <p className="font-medium">加载失败</p>
                <p className="text-sm text-gray-500">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3" style={{ minWidth: 'max-content', whiteSpace: 'nowrap' }}>
            <Database className="h-8 w-8 text-blue-500" />
            公共词库管理
          </h1>
          <p className="text-gray-600 mt-2">管理和维护公共翻译词库</p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Database className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-500">总词数</p>
                    <p className="text-2xl font-bold">{stats.totalWords.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Star className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-sm text-gray-500">平均质量分</p>
                    <p className="text-2xl font-bold">{stats.avgQuality}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-500">最高质量分</p>
                    <p className="text-2xl font-bold">{stats.maxQuality}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-500">最低质量分</p>
                    <p className="text-2xl font-bold">{stats.minQuality}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {stats?.qualityDistribution && stats.qualityDistribution.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">质量分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {stats.qualityDistribution.map((q: { score: number; count: number }) => (
                  <div
                    key={q.score}
                    className="flex-1 flex flex-col items-center"
                    title={`分数 ${q.score}: ${q.count} 个词`}
                  >
                    <div
                      className={`w-full rounded-t ${getQualityColor(q.score)}`}
                      style={{
                        height: `${Math.max(4, (q.count / Math.max(...stats.qualityDistribution.map((d: { count: number }) => d.count))) * 100)}%`,
                      }}
                    />
                    <span className="text-xs text-gray-500 mt-1">{q.score}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2 flex-1 min-w-0 sm:min-w-[200px]">
                <Input
                  placeholder="搜索单词..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  搜索
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="最低分"
                  className="w-24"
                  value={minQuality}
                  onChange={(e) => setMinQuality(e.target.value)}
                />
                <span>-</span>
                <Input
                  type="number"
                  placeholder="最高分"
                  className="w-24"
                  value={maxQuality}
                  onChange={(e) => setMaxQuality(e.target.value)}
                />
              </div>
              <select
                className="border rounded px-3 py-2"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
                  setSortBy(field)
                  setSortOrder(order as 'asc' | 'desc')
                }}
              >
                <option value="updatedAt-desc">最近更新</option>
                <option value="updatedAt-asc">最早更新</option>
                <option value="qualityScore-desc">质量分高到低</option>
                <option value="qualityScore-asc">质量分低到高</option>
                <option value="word-asc">单词 A-Z</option>
                <option value="word-desc">单词 Z-A</option>
              </select>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加单词
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {words && words.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无数据</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">单词</th>
                      <th className="text-left py-3 px-2">音标</th>
                      <th className="text-left py-3 px-2">词性</th>
                      <th className="text-left py-3 px-2">翻译</th>
                      <th className="text-left py-3 px-2">质量分</th>
                      <th className="text-left py-3 px-2">版本</th>
                      <th className="text-left py-3 px-2">更新时间</th>
                      <th className="text-left py-3 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {words &&
                      words.map((word) => (
                        <tr
                          key={word.id}
                          className="border-b hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedWord(word)}
                        >
                          <td className="py-3 px-2 font-medium">{word.word}</td>
                          <td className="py-3 px-2 text-gray-500">{word.phonetic || '-'}</td>
                          <td className="py-3 px-2">{word.pos || '-'}</td>
                          <td className="py-3 px-2 max-w-xs truncate">{word.translation}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-12 h-2 rounded ${getQualityColor(word.qualityScore)}`}
                              />
                              <span className="text-sm">{word.qualityScore}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">v{word.version}</td>
                          <td className="py-3 px-2 text-sm text-gray-500">
                            {new Date(word.updatedAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingWord(word)
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(word.id)
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">共 {pagination.total} 条记录</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-3">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedWord && !editingWord && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedWord(null)}
          >
            <Card
              className="max-w-2xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader>
                <CardTitle>单词详情</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">单词</p>
                      <p className="font-medium text-lg">{selectedWord.word}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">音标</p>
                      <p>{selectedWord.phonetic || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">词性</p>
                      <p>{selectedWord.pos || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">质量分</p>
                      <div className="flex items-center gap-2">
                        {getQualityBadge(selectedWord.qualityScore)}
                        <span>{selectedWord.qualityScore}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">翻译</p>
                    <p>{selectedWord.translation}</p>
                  </div>
                  {selectedWord.example && (
                    <div>
                      <p className="text-sm text-gray-500">例句</p>
                      <p className="italic">{selectedWord.example}</p>
                      {selectedWord.exampleTranslation && (
                        <p className="text-gray-600 mt-1">{selectedWord.exampleTranslation}</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                    <div>
                      <p>版本: v{selectedWord.version}</p>
                    </div>
                    <div>
                      <p>更新: {new Date(selectedWord.updatedAt).toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button onClick={() => setEditingWord(selectedWord)}>
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(selectedWord.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedWord(null)}>
                    关闭
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {editingWord && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingWord(null)}
          >
            <Card className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>编辑单词</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">单词</label>
                      <Input
                        value={editingWord.word}
                        onChange={(e) => setEditingWord({ ...editingWord, word: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">音标</label>
                      <Input
                        value={editingWord.phonetic || ''}
                        onChange={(e) =>
                          setEditingWord({ ...editingWord, phonetic: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">词性</label>
                      <Input
                        value={editingWord.pos || ''}
                        onChange={(e) => setEditingWord({ ...editingWord, pos: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">质量分 (0-100)</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={editingWord.qualityScore}
                        onChange={(e) =>
                          setEditingWord({
                            ...editingWord,
                            qualityScore: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">翻译</label>
                    <Input
                      value={editingWord.translation}
                      onChange={(e) =>
                        setEditingWord({ ...editingWord, translation: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">例句</label>
                    <Input
                      value={editingWord.example || ''}
                      onChange={(e) => setEditingWord({ ...editingWord, example: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">例句翻译</label>
                    <Input
                      value={editingWord.exampleTranslation || ''}
                      onChange={(e) =>
                        setEditingWord({ ...editingWord, exampleTranslation: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button onClick={handleSaveEdit} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingWord(null)}>
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showAddForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddForm(false)}
          >
            <Card className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>添加单词</CardTitle>
              </CardHeader>
              <CardContent>
                <AddWordForm
                  onSave={handleAdd}
                  onCancel={() => setShowAddForm(false)}
                  saving={saving}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function AddWordForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (word: Partial<PublicWord>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [word, setWord] = useState({
    word: '',
    phonetic: '',
    pos: '',
    translation: '',
    example: '',
    exampleTranslation: '',
    qualityScore: 50,
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-500">单词 *</label>
          <Input
            value={word.word}
            onChange={(e) => setWord({ ...word, word: e.target.value })}
            placeholder="必填"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500">音标</label>
          <Input
            value={word.phonetic}
            onChange={(e) => setWord({ ...word, phonetic: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm text-gray-500">词性</label>
          <Input value={word.pos} onChange={(e) => setWord({ ...word, pos: e.target.value })} />
        </div>
        <div>
          <label className="text-sm text-gray-500">质量分 (0-100)</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={word.qualityScore}
            onChange={(e) => setWord({ ...word, qualityScore: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-gray-500">翻译 *</label>
        <Input
          value={word.translation}
          onChange={(e) => setWord({ ...word, translation: e.target.value })}
          placeholder="必填"
        />
      </div>
      <div>
        <label className="text-sm text-gray-500">例句</label>
        <Input
          value={word.example}
          onChange={(e) => setWord({ ...word, example: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm text-gray-500">例句翻译</label>
        <Input
          value={word.exampleTranslation}
          onChange={(e) => setWord({ ...word, exampleTranslation: e.target.value })}
        />
      </div>
      <div className="flex gap-2 mt-6">
        <Button onClick={() => onSave(word)} disabled={saving || !word.word || !word.translation}>
          {saving ? '添加中...' : '添加'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  )
}
