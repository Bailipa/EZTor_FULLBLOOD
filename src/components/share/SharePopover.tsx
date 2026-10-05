'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Share2, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { copyToClipboard, shareOrCopy } from '@/lib/share'
import '@/app/share/[userId]/share-page.css'

interface ShareProfileData {
  nickname: string
  combatPower: number
  zoneRank: number
  streak: number
  totalWords: number
}

interface SharePopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  autoCloseSeconds?: number
}

export function SharePopover({ open, onOpenChange, userId, autoCloseSeconds = 0 }: SharePopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef(0)
  const pendingRef = useRef<number | null>(null)
  const [profile, setProfile] = useState<ShareProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [prepared, setPrepared] = useState(false)
  const [retry, setRetry] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    sessionRef.current += 1
    pendingRef.current = null
    setProfile(null)
    setImage(null)
    setPrepared(false)
    setSharing(false)
    setCountdown(open && autoCloseSeconds > 0 ? autoCloseSeconds : null)
    if (open) {
      setLoading(true)
      fetch(`/api/share-profile/${userId}`, { signal: controller.signal })
        .then((res) => res.json().then((data) => {
          if (!controller.signal.aborted && res.ok && data.success) setProfile(data.data)
        }))
        .catch(() => {})
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }
    return () => { controller.abort(); sessionRef.current += 1 }
  }, [open, userId, retry, autoCloseSeconds])

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown === 1) onOpenChange(false)
      setCountdown(countdown > 1 ? countdown - 1 : null)
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown, onOpenChange])

  const getShareUrl = () => `${window.location.origin}/share/${userId}`
  const getShareText = () => profile
    ? `我在EZTor背了${profile.totalWords}个单词，学力${profile.combatPower}，本月学区排名第${profile.zoneRank}名！你能超过我吗？`
    : ''

  const reportShare = async () => {
    try {
      await fetch('/api/game/tasks/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'SHARE', value: 1 }),
      })
    } catch { /* A completed share is still usable if the reward request fails. */ }
  }

  const handleShare = async () => {
    if (pendingRef.current !== null || !profile) return
    const session = sessionRef.current
    pendingRef.current = session
    setCountdown(null)
    setSharing(true)
    try {
      if (!prepared) {
        // Prepare once on demand; the next click retains Web Share user activation.
        let nextImage: string | null = null
        try {
          const { toPng } = await import('html-to-image')
          if (session !== sessionRef.current || !cardRef.current) return
          nextImage = await toPng(cardRef.current, {
            pixelRatio: 1, skipFonts: true,
            backgroundColor: getComputedStyle(cardRef.current).backgroundColor,
          })
        } catch { /* Keep the text/link fallback available. */ }
        if (session !== sessionRef.current) return
        setImage(nextImage)
        setPrepared(true)
        toast.info(nextImage ? '卡片已准备好，点击分享给朋友' : '图片生成失败，可继续分享文字与链接')
        return
      }
      const text = getShareText()
      const url = getShareUrl()
      const result = await shareOrCopy({ title: 'EZTor 学习战报', text, url }, `${text}\n${url}`, image)
      if (result === 'shared' || result === 'copied') await reportShare()
      if (session !== sessionRef.current) return
      if (result === 'shared' || result === 'copied') toast.success(result === 'copied' ? '已复制分享内容，可粘贴给好友' : '已打开分享')
      else if (result === 'failed') toast.error('分享失败，可复制下方链接')
    } catch {
      if (session === sessionRef.current) toast.error('分享失败，可复制下方链接')
    } finally {
      if (session === sessionRef.current && pendingRef.current === session) {
        pendingRef.current = null
        setSharing(false)
      }
    }
  }

  const handleCopyLink = async () => {
    if (pendingRef.current !== null || !profile) return
    const session = sessionRef.current
    pendingRef.current = session
    setCountdown(null)
    setSharing(true)
    try {
      const copied = await copyToClipboard(getShareUrl())
      if (copied) await reportShare()
      if (session !== sessionRef.current) return
      if (copied) toast.success('分享链接已复制')
      else toast.error('复制失败，请选择下方链接手动复制')
    } catch {
      if (session === sessionRef.current) toast.error('复制失败，请选择下方链接手动复制')
    } finally {
      if (session === sessionRef.current && pendingRef.current === session) {
        pendingRef.current = null
        setSharing(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5">
        <DialogTitle>分享学习成果</DialogTitle>
        <DialogDescription>先生成成果卡，再点击发送；也可直接复制分享链接。</DialogDescription>
        {countdown !== null && <p className="text-xs text-muted-foreground">{countdown} 秒后关闭 · 点击分享可保留此页</p>}
        {loading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin" aria-label="加载学习成果" /></div> : profile ? <>
          <div ref={cardRef} className="learning-share-card">
            <div className="learning-share-brand"><span>EZTor</span><span>学习成果</span></div>
            <h2 className="learning-share-name">{profile.nickname}</h2>
            <p className="learning-share-note">每次学习，积累一点。</p>
            <div className="learning-share-power"><strong>{profile.combatPower.toLocaleString()}</strong><span>总学力</span></div>
            <dl className="learning-share-stats">
              <div><dt>连续学习</dt><dd>{profile.streak}<small> 天</small></dd></div>
              <div><dt>已入库单词</dt><dd>{profile.totalWords.toLocaleString()}<small> 词</small></dd></div>
              <div><dt>本月学区排名</dt><dd>{profile.zoneRank > 0 ? `第 ${profile.zoneRank} 名` : '暂无排名'}</dd></div>
            </dl>
            <p className="learning-share-signoff">EZTor · An Easier Translator</p>
          </div>
          <Button className="w-full gap-2" disabled={sharing} onClick={handleShare}>
            {sharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            {sharing ? '正在处理…' : prepared ? '分享给朋友' : '生成分享卡片'}
          </Button>
          <Button variant="outline" className="w-full gap-2" disabled={sharing} onClick={handleCopyLink}><Copy className="size-4" />复制分享链接</Button>
          <input readOnly aria-label="分享链接，可手动复制" value={getShareUrl()} className="w-full text-xs text-muted-foreground bg-transparent border-b border-border py-2" onFocus={(event) => event.target.select()} />
          <p className="text-center text-xs text-muted-foreground">分享可获得 +15 学力（每日1次）</p>
        </> : <div className="space-y-3 py-8 text-center"><p className="text-sm text-muted-foreground">学习成果加载失败</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>重新加载</Button></div>}
      </DialogContent>
    </Dialog>
  )
}
