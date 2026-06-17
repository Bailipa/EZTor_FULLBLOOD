'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useAdminCheck } from '@/hooks/useAdminCheck'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Users, Shield, Pencil, Zap, Flame, Trophy, ChevronLeft, ChevronRight } from 'lucide-react'
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
  createdAt: string
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

  const handleSearch = () => {
    setSearch(searchInput)
  }

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
                    <th className="text-left py-2 px-2 font-medium">用户名</th>
                    <th className="text-left py-2 px-2 font-medium">昵称</th>
                    <th className="text-right py-2 px-2 font-medium">学力</th>
                    <th className="text-left py-2 px-2 font-medium">学区</th>
                    <th className="text-left py-2 px-2 font-medium">称号</th>
                    <th className="text-right py-2 px-2 font-medium">打卡</th>
                    <th className="text-center py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">{u.username}</td>
                      <td className="py-2 px-2">{u.nickname || <span className="text-muted-foreground">未设置</span>}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-mono text-amber-600 dark:text-amber-400">{u.combatPower}</span>
                      </td>
                      <td className="py-2 px-2">{u.zoneName || <span className="text-muted-foreground">-</span>}</td>
                      <td className="py-2 px-2">
                        {u.zoneTitle ? (
                          <Badge variant="outline" className="text-xs">{u.zoneTitle}</Badge>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="py-2 px-2 text-right">{u.currentStreak}天</td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(u)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
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

      <EditUserDialog
        user={editingUser}
        zones={zones}
        onClose={() => setEditingUser(null)}
        onSaved={() => { setEditingUser(null); fetchUsers(pagination.page) }}
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
          <DialogTitle>编辑用户：{user.username}</DialogTitle>
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
                      <td className="py-2 px-2 text-right">{z.memberCount}</td>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingZone(z)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
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

      <EditZoneDialog
        zone={editingZone}
        onClose={() => setEditingZone(null)}
        onSaved={() => { setEditingZone(null); fetchZones() }}
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
  const [form, setForm] = useState({ name: '', maxMembers: 50, isActive: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (zone) {
      setForm({ name: zone.name, maxMembers: zone.maxMembers, isActive: zone.isActive })
    }
  }, [zone])

  const handleSave = async () => {
    if (!zone) return
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
              value={form.maxMembers}
              onChange={(e) => setForm({ ...form, maxMembers: parseInt(e.target.value) || 50 })}
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
