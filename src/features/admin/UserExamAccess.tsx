'use client'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type PaperAccess = { key: string; title: string; level: string; enabled: boolean }
export default function UserExamAccess({ user, onClose }: { user: { id: string; username: string }; onClose: () => void }) {
  const [papers, setPapers] = useState<PaperAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('ALL')
  const [saving, setSaving] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    void fetch(`/api/admin/users/${encodeURIComponent(user.id)}/exam-access`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error || '无法读取试卷权限')
        if (!controller.signal.aborted) setPapers(result.data)
      }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '无法读取试卷权限') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [user.id, reload])
  async function toggle(paper: PaperAccess) {
    setSaving(paper.key)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/exam-access`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperKey: paper.key, enabled: !paper.enabled }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || '权限保存失败')
      setPapers((previous) => previous.map((item) => item.key === paper.key ? { ...item, enabled: result.data.enabled } : item))
      toast.success(result.data.enabled ? '已开放这套试卷' : '已关闭这套试卷的访问权限')
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : '权限保存失败，请重试') }
    finally { setSaving(null) }
  }
  const visible = papers.filter((paper) => (level === 'ALL' || paper.level === level) && `${paper.title} ${paper.key}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
    <DialogContent className="max-h-[85dvh] flex flex-col sm:max-w-xl">
      <DialogHeader><DialogTitle>{user.username} · 真题权限</DialogTitle><DialogDescription>勾选即开放，取消即关闭。每套试卷的所有题型共用权限，答题记录保留。新账号默认不开放任何试卷。</DialogDescription></DialogHeader>
      <div className="flex gap-2">
        <Input aria-label="搜索试卷" placeholder="搜索年份、月份或套数" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="筛选级别" className="rounded-lg border bg-background px-2 text-sm" value={level} onChange={(event) => setLevel(event.target.value)}><option value="ALL">全部</option><option value="CET4">四级</option><option value="CET6">六级</option></select>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">已开放 {papers.filter((paper) => paper.enabled).length} / {papers.length} 套{saving ? ' · 保存中…' : ''}</p>
      <div className="min-h-0 overflow-y-auto space-y-2 pr-1">
        {loading ? <p role="status">读取权限中…</p> : error ? <div role="alert">{error}<Button variant="outline" onClick={() => setReload((value) => value + 1)}>重试</Button></div> : visible.length ? visible.map((paper) =>
          <label key={paper.key} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer">
            <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={paper.enabled} disabled={!!saving} onChange={() => void toggle(paper)} />
            <span className="min-w-0 flex-1 text-sm">{paper.level === 'CET4' ? '四级' : '六级'} · {paper.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">{paper.enabled ? '已开放' : '未开放'}</span>
          </label>) : <p className="text-sm text-muted-foreground">没有符合条件的试卷</p>}
      </div>
      <Button variant="outline" disabled={!!saving} onClick={onClose}>完成</Button>
    </DialogContent>
  </Dialog>
}
