'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Submission = { id: string; name: string; yearSet: string; level: string; status: string; reviewNote?: string; createdAt: string }
const statusLabel: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '未通过' }

export default function MaterialContribution({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const [open, setOpen] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionAccount, setSubmissionAccount] = useState('')
  const [submissionLoadError, setSubmissionLoadError] = useState('')
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const activeAccount = useRef(accountId)
  activeAccount.current = accountId
  useEffect(() => {
    setSubmissions([]); setSubmissionAccount('')
    setSubmissionLoadError('')
    if (open) void load(accountId)
  }, [open, accountId])
  async function load(requestAccount: string) {
    setLoadingSubmissions(true); setSubmissionLoadError('')
    try {
      const response = await fetch('/api/study/material-submissions', { cache: 'no-store', headers: { 'x-study-account': requestAccount } })
      if (!response.ok) throw new Error('提交记录暂时无法加载')
      const data = await response.json()
      if (activeAccount.current !== requestAccount) return
      setSubmissions(data.submissions || [])
      setSubmissionAccount(requestAccount)
    } catch (e) {
      if (activeAccount.current === requestAccount) setSubmissionLoadError(e instanceof Error ? e.message : '提交记录暂时无法加载')
    } finally {
      if (activeAccount.current === requestAccount) setLoadingSubmissions(false)
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setResult('')
    const form = event.currentTarget
    const data = new FormData(form)
    const files = data.getAll('files').filter((item): item is File => item instanceof File && item.size > 0)
    if (files.reduce((total, file) => total + file.size, 0) > 10 * 1024 * 1024) { setError('文件总大小不能超过 10 MB'); setBusy(false); return }
    try {
      const response = await fetch('/api/study/material-submissions', { method: 'POST', headers: { 'x-study-account': accountId }, body: data })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '提交失败')
      if (activeAccount.current !== accountId) return
      setResult(`提交成功，编号 ${body.id}，当前状态：待审核。资料审核通过前不会进入资源目录。`)
      form.reset(); await load(accountId)
    } catch (e) { setError(e instanceof Error ? e.message : '提交失败，请稍后重试') }
    finally { setBusy(false) }
  }
  return <>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>贡献学习资料</DialogTitle><DialogDescription>提交内容仅管理员可查看；未经核验不会公开或直接发布答案。</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="grid gap-3">
          <label className="grid gap-1">资料名称<input name="name" required maxLength={160} className="rounded-md border bg-background px-3 py-2" placeholder="例如：2024 年 6 月 CET-4 第二套" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-1">年份 / 套次<input name="yearSet" required maxLength={100} className="rounded-md border bg-background px-3 py-2" placeholder="2024-06 · 第二套" /></label><label className="grid gap-1">级别<select name="level" className="rounded-md border bg-background px-3 py-2"><option value="CET-4">四级</option><option value="CET-6">六级</option></select></label></div>
          <label className="grid gap-1">来源 URL<input name="sourceUrl" type="url" required maxLength={1000} className="rounded-md border bg-background px-3 py-2" placeholder="https://…" /></label>
          <label className="grid gap-1">说明（选填）<textarea name="description" rows={2} maxLength={3000} className="rounded-md border bg-background px-3 py-2" /></label>
          <label className="grid gap-1">答案（选填）<textarea name="answers" rows={3} maxLength={20000} className="rounded-md border bg-background px-3 py-2" placeholder="请注明答案依据或版本" /></label>
          <label className="grid gap-1">资料文件<input name="files" type="file" multiple required accept=".pdf,.json,.txt,application/pdf,application/json,text/plain" className="rounded-md border bg-background px-3 py-2" /><span className="text-xs text-muted-foreground">PDF、JSON 或 TXT，最多 5 个文件，合计不超过 10 MB。</span></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{result && <p role="status" className="text-sm text-primary">{result}</p>}
          <Button type="submit" disabled={busy}>{busy ? '提交中…' : '提交审核'}</Button>
        </form>
        <section className="border-t pt-3"><h3 className="font-medium">我的提交</h3>{submissionLoadError ? <div className="mt-2 flex items-center gap-3 text-sm"><p role="alert" className="text-destructive">{submissionLoadError}</p><Button type="button" variant="outline" disabled={loadingSubmissions} onClick={() => void load(accountId)}>重试</Button></div> : submissionAccount !== accountId || loadingSubmissions ? <p className="mt-2 text-sm text-muted-foreground">正在加载提交记录…</p> : submissions.length ? <ul className="mt-2 grid gap-2 text-sm">{submissions.map((item) => <li key={item.id} className="grid gap-1 rounded-md border p-2"><div className="flex justify-between gap-3"><span>{item.name} · {item.yearSet} · {item.level}</span><span>{statusLabel[item.status] || item.status}</span></div>{item.reviewNote && <p className="text-muted-foreground">审核说明：{item.reviewNote}</p>}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">暂无提交记录</p>}</section>
      </DialogContent>
    </Dialog>
  </>
}
