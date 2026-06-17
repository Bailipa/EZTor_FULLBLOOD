'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ExternalLink, Smartphone } from 'lucide-react'
import confetti from 'canvas-confetti'
import './share-page.css'

interface ShareProfileData {
  nickname: string
  combatPower: number
  zoneRank: number
  streak: number
  totalWords: number
}

const BIRD_IMAGES = [
  '/birdone.png',
  '/birdtwo.png',
  '/birdthree.png',
  '/birdfour.png',
]

function CountUpNumber({
  target,
  duration = 1500,
  onComplete,
  suffix = '',
}: {
  target: number
  duration?: number
  onComplete?: () => void
  suffix?: string
}) {
  const [count, setCount] = useState(0)
  const [popped, setPopped] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    if (target <= 0) {
      setCount(0)
      setPopped(true)
      onComplete?.()
      return
    }

    const start = performance.now()
    let raf: number

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(eased * target)

      setCount(current)

      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setCount(target)
        if (!doneRef.current) {
          doneRef.current = true
          setPopped(true)
          onComplete?.()
        }
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, onComplete])

  return (
    <span className={`stat-number ${popped ? 'pop' : ''}`}>
      {count}{suffix}
    </span>
  )
}

function StatCard({
  icon,
  label,
  value,
  suffix = '',
  delay,
  onExplode,
}: {
  icon: string
  label: string
  value: number
  suffix?: string
  delay: number
  onExplode?: (el: HTMLElement) => void
}) {
  const [entered, setEntered] = useState(false)
  const [showNumber, setShowNumber] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t1 = setTimeout(() => setEntered(true), delay)
    const t2 = setTimeout(() => setShowNumber(true), delay + 300)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [delay])

  const handleComplete = useCallback(() => {
    if (cardRef.current && onExplode) {
      onExplode(cardRef.current)
    }
  }, [onExplode])

  return (
    <div
      ref={cardRef}
      className={`stat-card ${entered ? 'entered' : ''}`}
    >
      <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        <div className="stat-icon text-2xl mb-2">{icon}</div>
        <div className="min-h-[2.8rem] flex items-center justify-center">
          {showNumber ? (
            <CountUpNumber
              target={value}
              suffix={suffix}
              onComplete={handleComplete}
            />
          ) : (
            <span className="stat-number opacity-0">0</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  )
}

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [profile, setProfile] = useState<ShareProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yaliEntered, setYaliEntered] = useState(false)
  const [nicknameEntered, setNicknameEntered] = useState(false)
  const [ctaEntered, setCtaEntered] = useState(false)
  const [shaking, setShaking] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/share-profile/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setProfile(data.data)
        } else {
          setError(data.error || '用户不存在')
        }
      })
      .catch(() => {
        setError('加载失败')
      })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!profile) return
    const t1 = setTimeout(() => setYaliEntered(true), 300)
    const t2 = setTimeout(() => setNicknameEntered(true), 800)
    const t3 = setTimeout(() => setCtaEntered(true), 3200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [profile])

  const triggerShake = useCallback(() => {
    setShaking(true)
    setTimeout(() => setShaking(false), 300)
  }, [])

  const triggerCardExplosion = useCallback((el: HTMLElement) => {
    triggerShake()

    const rect = el.getBoundingClientRect()
    const x = (rect.left + rect.width / 2) / window.innerWidth
    const y = (rect.top + rect.height / 2) / window.innerHeight

    confetti({
      particleCount: 40,
      spread: 60,
      startVelocity: 20,
      gravity: 1.5,
      origin: { x, y },
      colors: ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#00ffff', '#ff00ff'],
      ticks: 80,
      scalar: 0.8,
    })
  }, [triggerShake])

  const triggerFinalConfetti = useCallback(() => {
    if (!pageRef.current) return

    const yaliEl = pageRef.current.querySelector('.yali-container')
    if (yaliEl) {
      const rect = yaliEl.getBoundingClientRect()
      const x = (rect.left + rect.width / 2) / window.innerWidth
      const y = (rect.top + rect.height / 2) / window.innerHeight

      confetti({
        particleCount: 120,
        spread: 100,
        startVelocity: 30,
        gravity: 1,
        origin: { x, y },
        colors: ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#00ffff', '#0077ff', '#ff00ff'],
        ticks: 150,
        scalar: 1,
      })
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    const t = setTimeout(triggerFinalConfetti, 2800)
    return () => clearTimeout(t)
  }, [profile, triggerFinalConfetti])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen share-page-bg">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen share-page-bg gap-4 p-4">
        <p className="text-lg text-red-400">{error || '用户不存在'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div
      ref={pageRef}
      className={`share-page-bg crt-overlay min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden ${shaking ? 'screen-shake' : ''}`}
    >
      {/* 浮动 bird 粒子 */}
      {BIRD_IMAGES.map((src, i) => (
        <div key={i} className={`bird-particle bird-${i + 1}`}>
          <img src={src} alt="" draggable={false} />
        </div>
      ))}

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Glitch 标题 */}
        <div className="text-center">
          <h1 className="glitch-title" data-text="学习成果报告">
            学习成果报告
          </h1>
        </div>

        {/* yali 主视觉 */}
        <div className="flex justify-center">
          <div className={`yali-container ${yaliEntered ? 'entered' : ''}`}>
            <img
              src="/yali.png"
              alt="yali"
              className="yali-img"
              draggable={false}
            />
          </div>
        </div>

        {/* 霓虹昵称 */}
        <p className={`neon-nickname text-center ${nicknameEntered ? '' : 'opacity-0'}`}>
          {profile.nickname} 的学习成就
        </p>

        {/* 数据卡片 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon="⚡"
            label="学力"
            value={profile.combatPower}
            delay={1000}
            onExplode={triggerCardExplosion}
          />
          <StatCard
            icon="🏆"
            label="学区排名"
            value={profile.zoneRank}
            suffix="th"
            delay={1400}
            onExplode={triggerCardExplosion}
          />
          <StatCard
            icon="🔥"
            label="连续打卡"
            value={profile.streak}
            suffix="天"
            delay={1800}
            onExplode={triggerCardExplosion}
          />
          <StatCard
            icon="📖"
            label="已入库单词"
            value={profile.totalWords}
            suffix="+"
            delay={2200}
            onExplode={triggerCardExplosion}
          />
        </div>

        {/* CTA 按钮 */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => router.push('/')}
            className={`neon-btn ${ctaEntered ? 'entered' : ''} w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white flex items-center justify-center gap-2`}
          >
            <ExternalLink className="w-4 h-4" />
            立即体验 EZTor网页版
          </button>

          <button
            onClick={() => window.open('https://www.xiaoying.life', '_blank')}
            className={`neon-btn ${ctaEntered ? 'entered' : ''} w-full py-3 px-6 rounded-xl bg-white/5 border border-white/20 text-white flex items-center justify-center gap-2`}
          >
            <Smartphone className="w-4 h-4" />
            上应大学生必备校园课表APP下载
          </button>
        </div>

        {/* 页脚 */}
        <div className="share-footer text-center space-y-1 pt-4">
          <p className="text-xs text-muted-foreground">
            分享自 EZTor - 让翻译更简单
          </p>
          <p className="text-xs text-muted-foreground/60">
            EZTor - An Easier Translator
          </p>
        </div>
      </div>
    </div>
  )
}
