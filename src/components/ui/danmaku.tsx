'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '@wrksz/themes/client'

interface DanmakuItem {
  id: string
  word: string
  translation: string
  top: number
  duration: number
  delay: number
  endTime: number
}

export function Danmaku({ isVisible }: { isVisible: boolean }) {
  const { theme, systemTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<DanmakuItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const tracksFreeTimeRef = useRef<number[]>(Array(12).fill(0))

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark =
    resolvedTheme === 'dark' || theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  // 定期清理已经播放完毕的弹幕，防止 DOM 元素无限增长
  useEffect(() => {
    if (!isVisible) return

    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      // 这里必须断言 item.endTime，因为我们在接口里没定义，或者在接口里补上
      setItems((prevItems) => prevItems.filter((item) => item.endTime > now))
    }, 10000) // 每 10 秒清理一次

    return () => clearInterval(cleanupInterval)
  }, [isVisible])

  const fetchAndGenerateDanmaku = async (skipDelay = false) => {
    try {
      const res = await fetch(`/api/danmaku?limit=3&t=${Date.now()}`)
      const result = await res.json()

      if (result.success && result.data && result.data.length > 0) {
        const words = result.data
        const now = Date.now()
        const TRACK_COUNT = 10

        const newItems: DanmakuItem[] = []

        for (let i = 0; i < words.length; i++) {
          const w = words[i]

          let trackIndex = 0
          let delay = 0

          if (skipDelay) {
            trackIndex = i % TRACK_COUNT
            delay = 0.3 + Math.random() * 0.5
          } else {
            let availableTracks: number[] = []
            for (let t = 0; t < TRACK_COUNT; t++) {
              if (now > tracksFreeTimeRef.current[t]) {
                availableTracks.push(t)
              }
            }

            if (availableTracks.length > 0) {
              trackIndex = availableTracks[Math.floor(Math.random() * availableTracks.length)]
              delay = 0.3 + Math.random() * 3
            } else {
              let earliestTrack = 0
              let earliestTime = tracksFreeTimeRef.current[0]
              for (let t = 1; t < TRACK_COUNT; t++) {
                if (tracksFreeTimeRef.current[t] < earliestTime) {
                  earliestTime = tracksFreeTimeRef.current[t]
                  earliestTrack = t
                }
              }
              trackIndex = earliestTrack
              delay = (earliestTime - now) / 1000 + Math.random() * 5
            }
          }

          const top = 10 + trackIndex * (80 / TRACK_COUNT)
          const duration = 25 + Math.random() * 15

          const timeToClearEntry = duration * 0.4

          tracksFreeTimeRef.current[trackIndex] = now + delay * 1000 + timeToClearEntry * 1000

          newItems.push({
            id: `${w.word}-${now}-${i}`,
            word: w.word,
            translation: String(w.translation || '')
              .replace(/\s+/g, ' ')
              .slice(0, 40),
            top: top,
            duration: duration,
            delay: delay,
            endTime: now + (delay + duration) * 1000,
          })
        }

        setItems((prevItems) => {
          const combined = [...prevItems, ...newItems]
          if (combined.length > 100) {
            return combined.slice(combined.length - 100)
          }
          return combined
        })
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development')
        console.error('Failed to generate danmaku:', err)
    }
  }

  useEffect(() => {
    if (!isVisible) {
      setItems([])
      return
    }

    fetchAndGenerateDanmaku()

    const interval = setInterval(() => {
      fetchAndGenerateDanmaku()
    }, 12000)

    return () => clearInterval(interval)
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return

    const handleVisibilityChange = () => {
      // 从其它标签/窗口切回时：重置轨道但不清空已飘的词，避免空白
      if (document.visibilityState === 'visible') {
        tracksFreeTimeRef.current = Array(12).fill(0)
        fetchAndGenerateDanmaku(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isVisible])

  // 容器常驻：即使当前没有弹幕也渲染（不卸载），换页/瞬时空档也不会消失
  if (!mounted) return null
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          className="absolute whitespace-nowrap px-4 py-2 backdrop-blur-md rounded-full shadow-md flex items-center gap-3"
          style={{
            top: `${item.top}%`,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
          initial={{ x: '100vw', opacity: 0 }}
          animate={{ x: '-100vw', opacity: [0, 1, 1, 0] }}
          transition={{
            x: {
              duration: item.duration,
              ease: 'linear',
              delay: item.delay,
              repeat: 0,
            },
            opacity: {
              duration: item.duration,
              times: [0, 0.1, 0.9, 1],
              ease: 'linear',
              delay: item.delay,
              repeat: 0,
            },
          }}
        >
          <span className="font-bold text-lg" style={{ color: isDark ? '#f3f4f6' : '#111827' }}>
            {item.word}
          </span>
          <span className="text-sm" style={{ color: isDark ? '#d1d5db' : '#374151' }}>
            {item.translation}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
