'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toPng } from 'html-to-image'
import { Share2, Copy, Download, Loader2, Zap, Trophy, Flame, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { shareOrCopy, copyToClipboard } from '@/lib/share'

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
  const [profile, setProfile] = useState<ShareProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [entered, setEntered] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

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
    if (open) {
      setEntered(false)
      if (autoCloseSeconds > 0) {
        setCountdown(autoCloseSeconds)
      }
      if (!profile) {
        fetchProfile()
      }
      const t = setTimeout(() => setEntered(true), 100)
      return () => clearTimeout(t)
    } else {
      setCountdown(null)
    }
  }, [open, autoCloseSeconds, profile, fetchProfile])

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown === 1) {
        onOpenChange(false)
        setCountdown(null)
      } else {
        setCountdown(countdown - 1)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown, onOpenChange])

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
    return `我在EZTor背了${profile.totalWords}个单词，学力${profile.combatPower}，本月学区排名第${profile.zoneRank}名！你能超过我吗？`
  }

  const handleShare = async () => {
    setCountdown(null)
    setSharing(true)
    const text = getShareText()
    const url = getShareUrl()
    const result = await shareOrCopy(
      { title: 'EZTor 学习战报', text, url },
      `${text}\n${url}`,
    )
    if (result === 'shared' || result === 'copied') {
      await reportShare()
      toast.success(result === 'copied' ? '已复制分享内容，可粘贴给好友' : '分享成功！')
    } else if (result === 'failed') {
      toast.error('分享失败，请截图或长按复制链接')
    }
    setSharing(false)
  }

  const handleCopyLink = async () => {
    setCountdown(null)
    const ok = await copyToClipboard(`${getShareText()}\n${getShareUrl()}`)
    if (ok) {
      await reportShare()
      toast.success('已复制到剪贴板')
    } else {
      toast.error('复制失败，请手动复制')
    }
  }

  const handleSaveImage = async () => {
    setCountdown(null)
    if (!cardRef.current) return
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
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

  return (
    <>
      <style>{`
        .share-popover-content {
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 25%, #0a1a2e 50%, #0a0a0a 100%) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
        }
        .share-popover-content::after {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px);
          pointer-events: none;
          z-index: 100;
          border-radius: inherit;
        }
        .share-glitch-title {
          position: relative;
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          background: linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #00ffff, #0077ff, #ff00ff, #ff0000);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: share-rainbow 3s linear infinite;
        }
        .share-glitch-title::before,
        .share-glitch-title::after {
          content: attr(data-text);
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: inherit;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .share-glitch-title::before {
          left: 2px;
          text-shadow: -2px 0 rgba(255,0,255,0.7);
          clip-path: inset(0 0 65% 0);
          animation: share-glitch 2.5s infinite linear alternate-reverse;
        }
        .share-glitch-title::after {
          left: -2px;
          text-shadow: 2px 0 rgba(0,255,255,0.7);
          clip-path: inset(35% 0 0 0);
          animation: share-glitch 2.5s infinite linear alternate-reverse reverse;
        }
        @keyframes share-rainbow { to { background-position: 200% center; } }
        @keyframes share-glitch {
          0% { clip-path: inset(20% 0 60% 0); }
          20% { clip-path: inset(55% 0 20% 0); }
          40% { clip-path: inset(10% 0 70% 0); }
          60% { clip-path: inset(80% 0 5% 0); }
          80% { clip-path: inset(30% 0 40% 0); }
          100% { clip-path: inset(65% 0 10% 0); }
        }
        .share-neon-name {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fff;
          text-shadow: 0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #ff00ff, 0 0 82px #ff00ff;
        }
        .share-stat-card {
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
        }
        .share-stat-num {
          display: inline-block;
          font-size: 1.4rem;
          font-weight: 900;
          background: linear-gradient(135deg, #ff0000, #ff7700, #ffff00, #00ff00, #00ffff);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: share-rainbow 4s ease infinite;
        }
        .share-stat-icon {
          display: inline-block;
          animation: share-spin-pulse 2s ease-in-out infinite;
        }
        @keyframes share-spin-pulse {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(15deg) scale(1.2); }
          50% { transform: rotate(0deg) scale(1); }
          75% { transform: rotate(-15deg) scale(1.2); }
        }
        .share-neon-btn {
          position: relative;
          font-weight: 700;
          letter-spacing: 0.05em;
          border: 2px solid transparent;
          background-origin: border-box;
          background-clip: padding-box, border-box;
          animation: share-neon-border 3s ease-in-out infinite;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .share-neon-btn:hover {
          box-shadow: 0 0 15px rgba(255,0,255,0.4), 0 0 30px rgba(0,255,255,0.2);
        }
        .share-neon-btn:active { transform: scale(0.95); }
        @keyframes share-neon-border {
          0%, 100% { box-shadow: 0 0 5px rgba(255,0,255,0.3), 0 0 10px rgba(0,255,255,0.1); }
          50% { box-shadow: 0 0 15px rgba(255,0,255,0.5), 0 0 30px rgba(0,255,255,0.3); }
        }
        .share-card-enter { animation: share-card-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes share-card-in {
          0% { transform: translateY(20px) scale(0.9); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .share-bird { position: absolute; pointer-events: none; z-index: 2; opacity: 0; will-change: transform, opacity; }
        .share-bird img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 0 8px rgba(255,255,255,0.2)); }
        .share-bird-1 { width: 80px; height: 80px; bottom: -20px; left: 5%; animation: sb1 9s ease-in-out infinite; }
        .share-bird-2 { width: 90px; height: 90px; top: -20px; right: 10%; animation: sb2 11s ease-in-out 1s infinite; }
        .share-bird-3 { width: 70px; height: 70px; top: 15%; left: -20px; animation: sb3 13s ease-in-out 2s infinite; }
        .share-bird-4 { width: 85px; height: 85px; bottom: 15%; right: -20px; animation: sb4 10s ease-in-out 3s infinite; }
        @keyframes sb1{0%{transform:translate(0,0) rotate(0deg);opacity:0}10%{opacity:.7}50%{transform:translate(50px,-60px) rotate(360deg);opacity:.5}90%{opacity:.7}100%{transform:translate(0,0) rotate(720deg);opacity:0}}
        @keyframes sb2{0%{transform:translate(0,0) rotate(0deg);opacity:0}10%{opacity:.6}50%{transform:translate(-40px,50px) rotate(-540deg);opacity:.4}90%{opacity:.6}100%{transform:translate(0,0) rotate(-1080deg);opacity:0}}
        @keyframes sb3{0%{transform:translate(0,0) rotate(0deg);opacity:0}10%{opacity:.5}50%{transform:translate(60px,40px) rotate(450deg);opacity:.4}90%{opacity:.5}100%{transform:translate(0,0) rotate(900deg);opacity:0}}
        @keyframes sb4{0%{transform:translate(0,0) rotate(0deg);opacity:0}10%{opacity:.6}50%{transform:translate(-50px,-40px) rotate(-360deg);opacity:.4}90%{opacity:.6}100%{transform:translate(0,0) rotate(-720deg);opacity:0}}
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="share-popover-content max-w-sm w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto p-4">
          <DialogTitle className="sr-only">分享学习成果</DialogTitle>
          <DialogDescription className="sr-only">分享你的学习成就给朋友，每日可获得 15 学力奖励</DialogDescription>
          {countdown !== null && countdown > 0 && (
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
              <div className="relative w-9 h-9">
                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke="url(#countdownGrad)"
                    strokeWidth="3"
                    strokeDasharray={`${(countdown / autoCloseSeconds) * 94.2} 94.2`}
                    strokeLinecap="round"
                    className="transition-[stroke-dasharray] duration-1000 ease-linear"
                  />
                  <defs>
                    <linearGradient id="countdownGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                  {countdown}
                </span>
              </div>
              <span className="text-xs text-white/60">秒后关闭</span>
            </div>
          )}
          <div className="share-bird share-bird-1"><img src="/birdone.png" alt="" /></div>
          <div className="share-bird share-bird-2"><img src="/birdtwo.png" alt="" /></div>
          <div className="share-bird share-bird-3"><img src="/birdthree.png" alt="" /></div>
          <div className="share-bird share-bird-4"><img src="/birdfour.png" alt="" /></div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-white/50" />
            </div>
          ) : profile ? (
            <div className="space-y-4 relative z-10">
              {/* Card preview */}
              <div
                ref={cardRef}
                className="w-full p-5 rounded-2xl share-card-enter relative"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  background: 'transparent',
                }}
              >
                <div className="text-center mb-4">
                  <div className="share-glitch-title" data-text="学习成果报告">
                    学习成果报告
                  </div>
                  <div className="share-neon-name mt-2">
                    {profile.nickname} 的学习成就
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="share-stat-card text-center p-3">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="share-stat-icon"><Zap className="w-4 h-4 text-amber-400" /></span>
                    </div>
                    <div className="share-stat-num">{profile.combatPower}</div>
                    <div className="text-[10px] mt-0.5 text-white/40">总学力</div>
                  </div>
                  <div className="share-stat-card text-center p-3">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="share-stat-icon"><Trophy className="w-4 h-4 text-yellow-400" /></span>
                    </div>
                    <div className="share-stat-num">第{profile.zoneRank}名</div>
                    <div className="text-[10px] mt-0.5 text-white/40">本月学区排名</div>
                  </div>
                  <div className="share-stat-card text-center p-3">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="share-stat-icon"><Flame className="w-4 h-4 text-orange-400" /></span>
                    </div>
                    <div className="share-stat-num">{profile.streak}天</div>
                    <div className="text-[10px] mt-0.5 text-white/40">连续打卡</div>
                  </div>
                  <div className="share-stat-card text-center p-3">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="share-stat-icon"><BookOpen className="w-4 h-4 text-blue-400" /></span>
                    </div>
                    <div className="share-stat-num">{profile.totalWords}+</div>
                    <div className="text-[10px] mt-0.5 text-white/40">已入库单词</div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-[10px] text-white/30">eztor.com</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={handleShare}
                  className="share-neon-btn w-full gap-2 bg-gradient-to-r from-purple-600/80 to-cyan-600/80 border-white/10 text-white hover:from-purple-500/80 hover:to-cyan-500/80"
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
                    className="gap-1.5 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    复制链接
                  </Button>
                  <Button
                    onClick={handleSaveImage}
                    variant="outline"
                    className="gap-1.5 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5" />
                    保存图片
                  </Button>
                </div>
              </div>

              <p className="text-center text-xs text-white/30">
                分享可获得 +15 学力（每日1次）
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-white/30">加载失败</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
