'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toPng } from 'html-to-image'
import { Share2, Copy, Download, Loader2, Zap, Trophy, Flame, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '@wrksz/themes/client'

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
}

export function SharePopover({ open, onOpenChange, userId }: SharePopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<ShareProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/share-profile/${userId}`)
      const data = await res.json()
      if (data.success) {
        setProfile(data.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (open && !profile) {
      fetchProfile()
    }
  }, [open, profile, fetchProfile])

  const reportShare = async () => {
    try {
      await fetch('/api/game/tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType: 'SHARE', value: 1 }),
      })
    } catch {
      // ignore
    }
  }

  const getShareUrl = () => `${window.location.origin}/share/${userId}`

  const getShareText = () => {
    if (!profile) return ''
    return `我在EZTor背了${profile.totalWords}个单词，学力${profile.combatPower}，学区排名第${profile.zoneRank}名！你能超过我吗？`
  }

  const handleShare = async () => {
    if (!navigator.share) {
      handleCopyLink()
      return
    }

    setSharing(true)
    try {
      await navigator.share({
        title: 'EZTor 学习战报',
        text: getShareText(),
        url: getShareUrl(),
      })
      await reportShare()
      toast.success('分享成功！')
    } catch {
      // user cancelled or error
    } finally {
      setSharing(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${getShareText()}\n${getShareUrl()}`)
      await reportShare()
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleSaveImage = async () => {
    if (!cardRef.current) return

    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
        skipFonts: true,
      })
      const link = document.createElement('a')
      link.download = `eztor-share-${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
      await reportShare()
      toast.success('图片已保存')
    } catch {
      toast.error('保存失败')
    }
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">分享学习成果</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <div
              ref={cardRef}
              className="w-full p-5 rounded-2xl"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
              }}
            >
              <div className="text-center mb-4">
                <div
                  className="text-xs tracking-widest mb-1"
                  style={{ color: isDark ? '#737373' : '#a3a3a3' }}
                >
                  EZTor
                </div>
                <div
                  className="text-lg font-semibold"
                  style={{ color: isDark ? '#fafafa' : '#171717' }}
                >
                  {profile.nickname} 的学习成就
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div
                  className="text-center p-3 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {profile.combatPower}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    学力
                  </div>
                </div>
                <div
                  className="text-center p-3 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    第{profile.zoneRank}名
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    学区排名
                  </div>
                </div>
                <div
                  className="text-center p-3 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {profile.streak}天
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    连续打卡
                  </div>
                </div>
                <div
                  className="text-center p-3 rounded-xl"
                  style={{ backgroundColor: isDark ? '#171717' : '#f5f5f5' }}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: isDark ? '#fafafa' : '#171717' }}
                  >
                    {profile.totalWords}+
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
                    已掌握单词
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-[10px]" style={{ color: isDark ? '#525252' : '#a3a3a3' }}>
                  eztor.com
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={handleShare}
                className="w-full gap-2"
                disabled={sharing}
              >
                {sharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                分享给朋友
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  复制链接
                </Button>
                <Button
                  onClick={handleSaveImage}
                  variant="outline"
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  保存图片
                </Button>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              分享可获得 +15 学力（每日1次）
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">加载失败</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
