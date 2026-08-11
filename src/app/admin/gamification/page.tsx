'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Loader2, Search, Users, Shield, Pencil, Zap, Flame, Trophy, ChevronLeft, ChevronRight, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface UserProfile {
  id: string
  userId: string
  username: string
  nickname: string | null
  combatPower: number
  monthlyPower: number
  weeklyPower: number
  dailyPowerGained: number
  dailyPowerCap: number
  currentStreak: number
  longestStreak: number
  zoneId: string | null
  zoneName: string | null
  zoneTitle: string | null
  unlockedFeatures: string[]
  lastActiveDate: string | null
  isAiFree?: boolean
  aiAskCount?: number
  createdAt: string
  provider: 'xiaoying' | 'local'
  externalSubject: string | null
  externalBoundAt: string | null
}

interface ZoneData {
  id: string
  name: string
  memberCount: number
  maxMembers: number
  isActive: boolean
  previousName: string | null
  renamedBy: string | null
  renamedAt: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface AllUser {
  id: string
  username: string
  createdAt: string
  nickname: string | null
  hasProfile: boolean
  profileId: string | null
  currentZoneId: string | null
  currentZoneName: string | null
  provider: 'xiaoying' | 'local'
  externalSubject: string | null
  externalBoundAt: string | null
}

interface AssignResult {
  userId: string
  ok: boolean
  noop?: boolean
  error?: string
}

export default function GamificationAdminPage() {
  const { isLoading: authLoading, isAdmin, status } = useAdminCheck()
  const [tab, setTab] = useState<'users' | 'zones'>('users')
  const isAuthenticated = status === 'authenticated'

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">无权访问</p>
          <Link href="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background p-6 md:p-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">学力系统管理</h1>
            <p className="text-muted-foreground">管理用户学力、学区、称号等</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={tab === 'users' ? 'default' : 'outline'}
              onClick={() => setTab('users')}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              用户管理
            </Button>
            <Button
              variant={tab === 'zones' ? 'default' : 'outline'}
              onClick={() => setTab('zones')}
              className="gap-2"
            >
              <Shield className="w-4 h-4" />
              学区管理
            </Button>
          </div>

          {tab === 'users' ? <UsersTab /> : <ZonesTab />}
        </div>
      </div>
    </AdminLayout>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [zones, setZones] = useState<ZoneData[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 })
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<{ userIds: string[]; title: string; source: 'inline' | 'bulk' | 'find-user' } | null>(null)
  const [findUserOpen, setFindUserOpen] = useState(false)

  const fetchUsers = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (zoneFilter && zoneFilter !== 'all') params.set('zoneId', zoneFilter)
      const res = await fetch(`/api/admin/gamification/users?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
        setPagination(data.pagination)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search, zoneFilter])

  useEffect(() => {
    fetch('/api/admin/gamification/zones')
      .then((r) => r.json())
      .then((data) => { if (data.success) setZones(data.data) })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchUsers(1) }, [fetchUsers])

  useEffect(() => { setSelectedIds(new Set()) }, [search, zoneFilter, pagination.page])

  const handleToggleAiFree = async (u: UserProfile) => {
    try {
      const res = await fetch(`/api/admin/gamification/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAiFree: !u.isAiFree }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`已${!u.isAiFree ? '开启' : '关闭'} ${u.username} 的 AI 免费`)
        fetchUsers(pagination.page)
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('网络错误')
    }
  }

  const handleSearch = () => {
    setSearch(searchInput)
  }

  const allOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.userId))
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        users.forEach((u) => next.delete(u.userId))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        users.forEach((u) => next.add(u.userId))
        return next
      })
    }
  }

  const handleAssigned = useCallback(() => {
    fetchUsers(pagination.page)
    fetch('/api/admin/gamification/zones')
      .then((r) => r.json())
      .then((data) => { if (data.success) setZones(data.data) })
      .catch(() => {})
    setSelectedIds(new Set())
  }, [fetchUsers, pagination.page])

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="搜索用户名或昵称..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} className="shrink-0">
                <Search className="w-4 h-4 mr-2" />
                搜索
              </Button>
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="全部学区" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部学区</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="shrink-0" onClick={() => setFindUserOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              指派任意用户
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-2 w-8">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="全选当前页"
                      />
                    </th>
                    <th className="text-left py-2 px-2 font-medium">用户名</th>
                    <th className="text-left py-2 px-2 font-medium">绑定/注册</th>
                    <th className="text-right py-2 px-2 font-medium">学力</th>
                    <th className="text-left py-2 px-2 font-medium">学区</th>
                    <th className="text-left py-2 px-2 font-medium">称号</th>
                    <th className="text-center py-2 px-2 font-medium">AI免费</th>
                    <th className="text-right py-2 px-2 font-medium">AI次数</th>
                    <th className="text-right py-2 px-2 font-medium">打卡</th>
                    <th className="text-center py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const checked = selectedIds.has(u.userId)
                    return (
                      <tr key={u.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev)
                                if (c) next.add(u.userId)
                                else next.delete(u.userId)
                                return next
                              })
                            }}
                            aria-label={`选择 ${u.username}`}
                          />
                        </td>
                        <td className="py-2 px-2 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span>{u.nickname || u.username}</span>
                            {u.provider === 'xiaoying' && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">小应</span>
                                <span className="font-mono">sub:…{u.externalSubject?.slice(-8)}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {u.provider === 'xiaoying' && u.externalBoundAt
                            ? `小应绑定：${new Date(u.externalBoundAt).toLocaleDateString('zh-CN')}`
                            : `注册：${new Date(u.createdAt).toLocaleDateString('zh-CN')}`}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className="font-mono text-amber-600 dark:text-amber-400">{u.combatPower}</span>
                        </td>
                        <td className="py-2 px-2">{u.zoneName || <span className="text-muted-foreground">-</span>}</td>
                        <td className="py-2 px-2">
                          {u.zoneTitle ? (
                            <Badge variant="outline" className="text-xs">{u.zoneTitle}</Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Switch
                            checked={!!u.isAiFree}
                            onCheckedChange={() => handleToggleAiFree(u)}
                            aria-label={`切换 ${u.username} 的 AI 免费`}
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-muted-foreground">{u.aiAskCount ?? 0}</td>
                        <td className="py-2 px-2 text-right">{u.currentStreak}天</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title={u.zoneName ? `改派学区（当前：${u.zoneName}）` : '指定加入学区'}
                              onClick={() =>
                                setAssignTarget({
                                  userIds: [u.userId],
                                  title: u.zoneName
                                    ? `改派学区：${u.username}`
                                    : `指定加入学区：${u.username}`,
                                  source: 'inline',
                                })
                              }
                            >
                              <Trophy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="编辑"
                              onClick={() => setEditingUser(u)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUsers(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchUsers(pagination.page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-background shadow-lg px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span>已选 <span className="font-semibold">{selectedIds.size}</span> 位用户</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="w-3.5 h-3.5 mr-1" />
                清除
              </Button>
            </div>
            <Button
              onClick={() =>
                setAssignTarget({
                  userIds: Array.from(selectedIds),
                  title: `批量指派 ${selectedIds.size} 位用户`,
                  source: 'bulk',
                })
              }
            >
              <Trophy className="w-4 h-4 mr-2" />
              批量加入学区
            </Button>
          </div>
        </div>
      )}

      <EditUserDialog
        user={editingUser}
        zones={zones}
        onClose={() => setEditingUser(null)}
        onSaved={() => { setEditingUser(null); fetchUsers(pagination.page) }}
      />

      {assignTarget && (
        <AssignZoneDialog
          userIds={assignTarget.userIds}
          title={assignTarget.title}
          source={assignTarget.source}
          zones={zones}
          onClose={() => setAssignTarget(null)}
          onDone={() => { setAssignTarget(null); handleAssigned() }}
        />
      )}

      <FindUserDialog
        open={findUserOpen}
        zones={zones}
        onClose={() => setFindUserOpen(false)}
        onAssigned={() => {
          setFindUserOpen(false)
          handleAssigned()
        }}
      />
    </>
  )
}

function EditUserDialog({
  user,
  zones,
  onClose,
  onSaved,
}: {
  user: UserProfile | null
  zones: ZoneData[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        nickname: user.nickname || '',
        combatPower: user.combatPower,
        monthlyPower: user.monthlyPower,
        weeklyPower: user.weeklyPower,
        dailyPowerGained: user.dailyPowerGained,
        dailyPowerCap: user.dailyPowerCap,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        zoneTitle: user.zoneTitle || '',
        zoneId: user.zoneId || '',
      })
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (form.nickname !== (user.nickname || '')) body.nickname = form.nickname || null
      if (Number(form.combatPower) !== user.combatPower) body.combatPower = Number(form.combatPower)
      if (Number(form.monthlyPower) !== user.monthlyPower) body.monthlyPower = Number(form.monthlyPower)
      if (Number(form.weeklyPower) !== user.weeklyPower) body.weeklyPower = Number(form.weeklyPower)
      if (Number(form.dailyPowerGained) !== user.dailyPowerGained) body.dailyPowerGained = Number(form.dailyPowerGained)
      if (Number(form.dailyPowerCap) !== user.dailyPowerCap) body.dailyPowerCap = Number(form.dailyPowerCap)
      if (Number(form.currentStreak) !== user.currentStreak) body.currentStreak = Number(form.currentStreak)
      if (Number(form.longestStreak) !== user.longestStreak) body.longestStreak = Number(form.longestStreak)
      if ((form.zoneTitle || '') !== (user.zoneTitle || '')) body.zoneTitle = form.zoneTitle || null
      const newZoneId = form.zoneId || null
      if (newZoneId !== (user.zoneId || null)) body.zoneId = newZoneId

      if (Object.keys(body).length === 0) {
        toast.info('没有要修改的字段')
        return
      }

      const res = await fetch(`/api/admin/gamification/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('修改成功')
        onSaved()
      } else {
        toast.error(data.error || '修改失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            编辑用户：{user.nickname || user.username}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({user.username})
              {user.provider === 'xiaoying' && (
                <span className="ml-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">小应</span>
              )}
            </span>
          </DialogTitle>
          <DialogDescription>管理员可直接修改任意字段，不受限制</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">昵称</label>
              <Input
                value={String(form.nickname || '')}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                placeholder="留空清除"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">称号</label>
              <Input
                value={String(form.zoneTitle || '')}
                onChange={(e) => setForm({ ...form, zoneTitle: e.target.value })}
                placeholder="留空使用默认"
                maxLength={6}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" />总学力</label>
              <Input
                type="number"
                value={Number(form.combatPower || 0)}
                onChange={(e) => setForm({ ...form, combatPower: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">月学力</label>
              <Input
                type="number"
                value={Number(form.monthlyPower || 0)}
                onChange={(e) => setForm({ ...form, monthlyPower: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">周学力</label>
              <Input
                type="number"
                value={Number(form.weeklyPower || 0)}
                onChange={(e) => setForm({ ...form, weeklyPower: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">今日已获学力</label>
              <Input
                type="number"
                value={Number(form.dailyPowerGained || 0)}
                onChange={(e) => setForm({ ...form, dailyPowerGained: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">每日学力上限</label>
              <Input
                type="number"
                value={Number(form.dailyPowerCap || 100)}
                onChange={(e) => setForm({ ...form, dailyPowerCap: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3" />连续打卡</label>
              <Input
                type="number"
                value={Number(form.currentStreak || 0)}
                onChange={(e) => setForm({ ...form, currentStreak: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">最长连续打卡</label>
              <Input
                type="number"
                value={Number(form.longestStreak || 0)}
                onChange={(e) => setForm({ ...form, longestStreak: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Trophy className="w-3 h-3" />所属学区</label>
            <Select
              value={String(form.zoneId || '__none__')}
              onValueChange={(v) => setForm({ ...form, zoneId: v === '__none__' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无学区</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>{z.name} ({z.memberCount}/{z.maxMembers})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            保存修改
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ZonesTab() {
  const [zones, setZones] = useState<ZoneData[]>([])
  const [loading, setLoading] = useState(true)
  const [editingZone, setEditingZone] = useState<ZoneData | null>(null)
  const [addMembersZone, setAddMembersZone] = useState<ZoneData | null>(null)

  const fetchZones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/gamification/zones')
      const data = await res.json()
      if (data.success) setZones(data.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchZones() }, [fetchZones])

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : zones.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">暂无学区</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">学区名称</th>
                    <th className="text-right py-2 px-2 font-medium">成员数</th>
                    <th className="text-right py-2 px-2 font-medium">最大人数</th>
                    <th className="text-left py-2 px-2 font-medium">状态</th>
                    <th className="text-left py-2 px-2 font-medium">原名称</th>
                    <th className="text-center py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{z.name}</td>
                      <td className="py-2 px-2 text-right">
                        {z.memberCount}
                        {z.memberCount > z.maxMembers && (
                          <span className="ml-1 text-xs text-amber-600 dark:text-amber-400" title="已超额">⚠</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">{z.maxMembers}</td>
                      <td className="py-2 px-2">
                        <Badge variant={z.isActive ? 'default' : 'secondary'}>
                          {z.isActive ? '活跃' : '停用'}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {z.previousName || '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="添加成员"
                            onClick={() => setAddMembersZone(z)}
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="编辑"
                            onClick={() => setEditingZone(z)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditZoneDialog
        zone={editingZone}
        onClose={() => setEditingZone(null)}
        onSaved={() => { setEditingZone(null); fetchZones() }}
      />

      <AddMembersDialog
        zone={addMembersZone}
        onClose={() => setAddMembersZone(null)}
        onAssigned={() => { setAddMembersZone(null); fetchZones() }}
      />
    </>
  )
}

function EditZoneDialog({
  zone,
  onClose,
  onSaved,
}: {
  zone: ZoneData | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', maxMembers: 15, isActive: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (zone) {
      setForm({ name: zone.name, maxMembers: zone.maxMembers, isActive: zone.isActive })
    }
  }, [zone])

  const handleSave = async () => {
    if (!zone) return
    if (!Number.isFinite(form.maxMembers) || form.maxMembers < 1) {
      toast.error('最大成员数至少为 1')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (form.name !== zone.name) body.name = form.name
      if (form.maxMembers !== zone.maxMembers) body.maxMembers = form.maxMembers
      if (form.isActive !== zone.isActive) body.isActive = form.isActive

      if (Object.keys(body).length === 0) {
        toast.info('没有要修改的字段')
        return
      }

      const res = await fetch(`/api/admin/gamification/zones/${zone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('修改成功')
        onSaved()
      } else {
        toast.error(data.error || '修改失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setSaving(false)
    }
  }

  if (!zone) return null

  return (
    <Dialog open={!!zone} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>编辑学区：{zone.name}</DialogTitle>
          <DialogDescription>修改学区属性</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">学区名称</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={12}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">最大成员数</label>
            <Input
              type="number"
              min={1}
              value={form.maxMembers}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                setForm({ ...form, maxMembers: Number.isNaN(v) ? 15 : v })
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm">活跃状态</label>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            保存修改
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AssignZoneDialog({
  userIds,
  title,
  source,
  zones,
  onClose,
  onDone,
}: {
  userIds: string[]
  title: string
  source: 'inline' | 'bulk' | 'find-user'
  zones: ZoneData[]
  onClose: () => void
  onDone: () => void
}) {
  const [zoneChoice, setZoneChoice] = useState('__none__')
  const [saving, setSaving] = useState(false)

  const activeZones = useMemo(() => zones.filter((z) => z.isActive), [zones])

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const zoneId = zoneChoice === '__none__' ? null : zoneChoice
      const res = await fetch('/api/admin/gamification/assign-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, zoneId, source }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || '指派失败')
        return
      }
      const { ok, noop, failed } = data.summary as { ok: number; noop: number; failed: number }
      const failedList = (data.results as AssignResult[]).filter((r) => !r.ok)
      if (failed === 0 && noop === 0) {
        toast.success(`已指派 ${ok} 位用户`)
      } else if (failed === 0) {
        toast.success(`已指派 ${ok} 位，跳过 ${noop} 位（已在目标学区）`)
      } else {
        toast.warning(
          `成功 ${ok} · 跳过 ${noop} · 失败 ${failed}` +
            (failedList.length > 0 ? `：${failedList[0].error}` : ''),
        )
      }
      onDone()
    } catch {
      toast.error('网络错误')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            管理员指派：绕过学区成员上限、不消耗学力、不影响转学区冷却。已写入审计日志。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="w-3 h-3" />目标学区
            </label>
            <Select value={zoneChoice} onValueChange={setZoneChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">移除学区</SelectItem>
                {activeZones.length === 0 && (
                  <SelectItem value="__no_active__" disabled>
                    暂无可用学区
                  </SelectItem>
                )}
                {activeZones.map((z) => {
                  const over = z.memberCount >= z.maxMembers
                  return (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name} ({z.memberCount}/{z.maxMembers})
                      {over ? ' ⚠' : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {zoneChoice !== '__none__' && (() => {
              const z = activeZones.find((x) => x.id === zoneChoice)
              if (!z) return null
              if (z.memberCount >= z.maxMembers) {
                return (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    目标学区已满 ({z.memberCount}/{z.maxMembers})，管理员将强制加入并产生超额。
                  </p>
                )
              }
              return null
            })()}
          </div>
          <div className="text-xs text-muted-foreground">
            本次将处理 <span className="font-semibold">{userIds.length}</span> 位用户
          </div>
          <Button
            onClick={handleConfirm}
            disabled={saving || (zoneChoice !== '__none__' && activeZones.length === 0)}
            className="w-full"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            确认指派
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FindUserDialog({
  open,
  zones,
  onClose,
  onAssigned,
}: {
  open: boolean
  zones: ZoneData[]
  onClose: () => void
  onAssigned: () => void
}) {
  const [users, setUsers] = useState<AllUser[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 1 })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<{ userIds: string[]; title: string } | null>(null)

  const fetchUsers = useCallback(async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/gamification/users-all?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
        setPagination(data.pagination)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => {
    if (open) fetchUsers(1)
  }, [open, fetchUsers])

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set())
      setSearch('')
      setSearchInput('')
    }
  }, [open])

  const allOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id))
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) users.forEach((u) => next.delete(u.id))
      else users.forEach((u) => next.add(u.id))
      return next
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>指派任意用户加入学区</DialogTitle>
            <DialogDescription>搜索任意用户（含未参与游戏的用户），可单条或多选指派</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="按用户名搜索..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            />
            <Button onClick={() => setSearch(searchInput)} className="shrink-0">
              <Search className="w-4 h-4 mr-2" />搜索
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">未找到用户</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="py-2 px-2 w-8">
                      <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} aria-label="全选" />
                    </th>
                    <th className="text-left py-2 px-2 font-medium">用户名</th>
                    <th className="text-left py-2 px-2 font-medium">绑定/注册</th>
                    <th className="text-left py-2 px-2 font-medium">当前学区</th>
                    <th className="text-center py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const checked = selectedIds.has(u.id)
                    return (
                      <tr key={u.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev)
                                if (c) next.add(u.id)
                                else next.delete(u.id)
                                return next
                              })
                            }}
                            aria-label={`选择 ${u.username}`}
                          />
                        </td>
                        <td className="py-2 px-2 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span>{u.nickname || u.username}</span>
                            {u.provider === 'xiaoying' && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">小应</span>
                                <span className="font-mono">sub:…{u.externalSubject?.slice(-8)}</span>
                              </div>
                            )}
                            {!u.hasProfile && (
                              <span className="text-xs text-muted-foreground">(无档案)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">
                          {u.provider === 'xiaoying' && u.externalBoundAt
                            ? `小应绑定：${new Date(u.externalBoundAt).toLocaleDateString('zh-CN')}`
                            : `注册：${new Date(u.createdAt).toLocaleDateString('zh-CN')}`}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {u.currentZoneName || <span>-</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setAssignTarget({
                                userIds: [u.id],
                                title: u.currentZoneName
                                  ? `改派学区：${u.username}`
                                  : `指定加入学区：${u.username}`,
                              })
                            }
                          >
                            <Trophy className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUsers(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchUsers(pagination.page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span>已选 <span className="font-semibold">{selectedIds.size}</span></span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="w-3.5 h-3.5 mr-1" />清除
                </Button>
              </div>
              <Button
                onClick={() =>
                  setAssignTarget({
                    userIds: Array.from(selectedIds),
                    title: `批量指派 ${selectedIds.size} 位用户`,
                  })
                }
              >
                <Trophy className="w-4 h-4 mr-2" />批量加入学区
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {assignTarget && (
        <AssignZoneDialog
          userIds={assignTarget.userIds}
          title={assignTarget.title}
          source="find-user"
          zones={zones}
          onClose={() => setAssignTarget(null)}
          onDone={() => {
            setAssignTarget(null)
            setSelectedIds(new Set())
            fetchUsers(pagination.page)
            onAssigned()
          }}
        />
      )}
    </>
  )
}

function AddMembersDialog({
  zone,
  onClose,
  onAssigned,
}: {
  zone: ZoneData | null
  onClose: () => void
  onAssigned: () => void
}) {
  const [users, setUsers] = useState<AllUser[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 1 })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async (page: number) => {
    if (!zone) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30', excludeZoneId: zone.id })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/gamification/users-all?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data)
        setPagination(data.pagination)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [zone, search])

  useEffect(() => {
    if (zone) {
      setSelectedIds(new Set())
      setSearch('')
      setSearchInput('')
      fetchUsers(1)
    }
  }, [zone, fetchUsers])

  const allOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id))
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) users.forEach((u) => next.delete(u.id))
      else users.forEach((u) => next.add(u.id))
      return next
    })
  }

  const handleConfirm = async () => {
    if (!zone || selectedIds.size === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/gamification/assign-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          zoneId: zone.id,
          source: 'zone-add',
        }),
      })
      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || '指派失败')
        return
      }
      const { ok, noop, failed } = data.summary as { ok: number; noop: number; failed: number }
      const failedList = (data.results as AssignResult[]).filter((r) => !r.ok)
      if (failed === 0 && noop === 0) {
        toast.success(`已添加 ${ok} 位成员至 ${zone.name}`)
      } else if (failed === 0) {
        toast.success(`已添加 ${ok} 位，跳过 ${noop} 位（已在本学区）`)
      } else {
        toast.warning(
          `成功 ${ok} · 跳过 ${noop} · 失败 ${failed}` +
            (failedList.length > 0 ? `：${failedList[0].error}` : ''),
        )
      }
      onAssigned()
    } catch {
      toast.error('网络错误')
    } finally {
      setSaving(false)
    }
  }

  if (!zone) return null

  const over = zone.memberCount >= zone.maxMembers

  return (
    <Dialog open={!!zone} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>向「{zone.name}」添加成员</DialogTitle>
          <DialogDescription>
            当前成员 {zone.memberCount} / {zone.maxMembers}
            {over && <span className="text-amber-600 dark:text-amber-400"> · 已超额，仍可继续添加</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="按用户名搜索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
          />
          <Button onClick={() => setSearch(searchInput)} className="shrink-0">
            <Search className="w-4 h-4 mr-2" />搜索
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">没有可添加的用户</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="py-2 px-2 w-8">
                    <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} aria-label="全选" />
                  </th>
<th className="text-left py-2 px-2 font-medium">用户名</th>
                    <th className="text-left py-2 px-2 font-medium">绑定/注册</th>
                    <th className="text-left py-2 px-2 font-medium">当前学区</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const checked = selectedIds.has(u.id)
                  return (
                    <tr key={u.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (c) next.add(u.id)
                              else next.delete(u.id)
                              return next
                            })
                          }}
                          aria-label={`选择 ${u.username}`}
                        />
                      </td>
                      <td className="py-2 px-2 font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>{u.nickname || u.username}</span>
                          {u.provider === 'xiaoying' && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5">小应</span>
                              <span className="font-mono">sub:…{u.externalSubject?.slice(-8)}</span>
                            </div>
                          )}
                          {!u.hasProfile && (
                            <span className="text-xs text-muted-foreground">(无档案)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">
                        {u.provider === 'xiaoying' && u.externalBoundAt
                          ? `小应绑定：${new Date(u.externalBoundAt).toLocaleDateString('zh-CN')}`
                          : `注册：${new Date(u.createdAt).toLocaleDateString('zh-CN')}`}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {u.currentZoneName || <span>-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchUsers(pagination.page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <div className="text-sm text-muted-foreground">
            已选 <span className="font-semibold">{selectedIds.size}</span> 位
          </div>
          <Button
            onClick={handleConfirm}
            disabled={saving || selectedIds.size === 0}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            加入「{zone.name}」
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
