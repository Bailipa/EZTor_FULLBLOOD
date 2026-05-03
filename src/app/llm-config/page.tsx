'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ArrowLeft, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react'

type ProviderRow = {
  id: string
  name: string
  apiKey: string // masked
  baseUrl: string
  model: string
  priority: number
  isActive: number
  quotaRemaining: number | null
  quotaUsed: number
  lastUsedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  createdAt: string
  updatedAt: string
}

function fmt(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN')
}

function toNullableNumber(v: string) {
  const s = v.trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export default function LlmConfigPage() {
  const { isLoading: authLoading, isAdmin, status } = useAdminCheck()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ProviderRow[]>([])

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    id: '',
    name: '',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    priority: '0',
    quotaRemaining: '',
    isActive: true,
  })

  const isEditing = Boolean(form.id)

  const resetForm = () =>
    setForm({
      id: '',
      name: '',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      priority: '0',
      quotaRemaining: '',
      isActive: true,
    })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/llm-providers', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setRows(json.data)
      else setError(json.error || 'Failed to fetch providers')
    } catch (error) {
      if (process.env.NODE_ENV === 'development')
        console.error('Failed to fetch LLM providers:', error)
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchData()
  }, [isAdmin, fetchData])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    [rows],
  )

  const save = async () => {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      priority: Number(form.priority) || 0,
      isActive: form.isActive,
      quotaRemaining: toNullableNumber(form.quotaRemaining),
    }

    // Only send apiKey if set in UI (so edits don鈥檛 overwrite by accident).
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim()

    try {
      if (isEditing) {
        payload.id = form.id
        const res = await fetch('/api/llm-providers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Update failed')
      } else {
        if (!payload.apiKey) throw new Error('apiKey is required')
        const res = await fetch('/api/llm-providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Create failed')
      }

      setOpen(false)
      resetForm()
      fetchData()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.error(message || '保存失败')
    }
  }

  const editRow = (r: ProviderRow) => {
    setForm({
      id: r.id,
      name: r.name,
      apiKey: '',
      baseUrl: r.baseUrl,
      model: r.model,
      priority: String(r.priority),
      quotaRemaining: r.quotaRemaining === null ? '' : String(r.quotaRemaining),
      isActive: Boolean(r.isActive),
    })
    setOpen(true)
  }

  const del = async (id: string) => {
    if (!confirm('确定要删除该 API 配置吗？')) return
    const res = await fetch(`/api/llm-providers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) toast.error(json.error || 'Delete failed')
    fetchData()
  }

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
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/analytics">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings2 className="w-6 h-6" />
                大模型 API 配置
              </h1>
              <p className="text-sm text-muted-foreground">
                支持多个 API，按优先级自动切换；某个 API 配额用尽时会自动切到下一个。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v)
                if (!v) resetForm()
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    resetForm()
                    setOpen(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新增 API
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{isEditing ? '编辑 API' : '新增 API'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm mb-1">名称 *</div>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="text-sm mb-1">优先级（越小越优先）</div>
                      <Input
                        value={form.priority}
                        onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm mb-1">API Key {isEditing ? '(留空表示不改)' : '*'}</div>
                    <Input
                      value={form.apiKey}
                      onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm mb-1">Base URL</div>
                      <Input
                        value={form.baseUrl}
                        onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="text-sm mb-1">Model</div>
                      <Input
                        value={form.model}
                        onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <div className="text-sm mb-1">剩余额度（请求数，留空=无限）</div>
                      <Input
                        value={form.quotaRemaining}
                        onChange={(e) => setForm((p) => ({ ...p, quotaRemaining: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={form.isActive}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                      />
                      <span className="text-sm">启用</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={save}>保存</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API 列表</CardTitle>
            <CardDescription>
              系统会按 priority 顺序选择可用 API（quotaRemaining 大于 0 或为空）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-red-500 text-sm">{error}</div>
            ) : loading ? (
              <div className="text-muted-foreground text-sm">加载中...</div>
            ) : sortedRows.length === 0 ? (
              <div className="text-muted-foreground text-sm">暂无配置。请先新增至少一个 API。</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">名称</th>
                      <th className="text-left py-2 px-2 font-medium">Key</th>
                      <th className="text-left py-2 px-2 font-medium">Base URL</th>
                      <th className="text-left py-2 px-2 font-medium">Model</th>
                      <th className="text-right py-2 px-2 font-medium">优先级</th>
                      <th className="text-right py-2 px-2 font-medium">剩余</th>
                      <th className="text-right py-2 px-2 font-medium">已用</th>
                      <th className="text-left py-2 px-2 font-medium">最近使用</th>
                      <th className="text-left py-2 px-2 font-medium">错误</th>
                      <th className="text-right py-2 px-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">
                          {r.name}{' '}
                          {!r.isActive ? (
                            <span className="text-xs text-muted-foreground">(禁用)</span>
                          ) : null}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {r.apiKey}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground max-w-[220px] truncate">
                          {r.baseUrl}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{r.model}</td>
                        <td className="py-2 px-2 text-right">{r.priority}</td>
                        <td className="py-2 px-2 text-right">
                          {r.quotaRemaining === null ? '∞' : r.quotaRemaining}
                        </td>
                        <td className="py-2 px-2 text-right">{r.quotaUsed}</td>
                        <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                          {fmt(r.lastUsedAt)}
                        </td>
                        <td
                          className="py-2 px-2 text-muted-foreground max-w-[220px] truncate"
                          title={r.lastError || ''}
                        >
                          {r.lastError || '-'}
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => editRow(r)}
                            className="mr-2"
                          >
                            编辑
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => del(r.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
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
