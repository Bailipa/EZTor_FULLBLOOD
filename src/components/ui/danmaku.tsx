'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '@wrksz/themes/client'
import { useDanmakuSettingsStore } from '@/stores/danmakuSettingsStore'

interface DanmakuItem {
  id: string
  word: string
  translation: string
  top: number
  delay: number
  /** 基础时长（25-40s），实际速度 = baseDuration × playbackRate（speed 实时调速） */
  baseDuration: number
}

const TRACK_COUNT = 10
const MAX_ITEMS = 100
const FETCH_INTERVAL_MS = 12000

/**
 * 单词量调小"立竿见影"的目标数：按本次变化比例移除（而非 当前数量×新倍率）。
 * 否则连续调小/拖动滑块时会对已经缩小过的数量反复相乘，密度被一步步踩低；
 * 且速度/透明度改动若复用此逻辑也会把弹幕越删越少。
 */
export function amountRemovalTarget(current: number, newAmount: number, oldAmount: number): number {
  const ratio = newAmount / oldAmount
  if (ratio >= 1) return current
  return Math.round(current * ratio)
}

/**
 * 轮询间隔随速度自适应：弹幕在屏时长 = baseDuration / speed（playbackRate 调速），
 * 速度减半 → 每条弹幕停留时间翻倍。若轮询间隔固定，同样的拉取频率会让
 * 同时在屏数量翻倍（"速度调小数量反而增加"）。间隔 ∝ 1/speed 后数量恒定。
 */
export function danmakuPollInterval(speed: number): number {
  return Math.max(3000, FETCH_INTERVAL_MS / speed)
}

/**
 * 弹幕渲染（浏览器端）：WAAPI 驱动（与 danmaku-overlay.html 同规则）——
 * playbackRate 可对已在途弹幕实时平滑调速（CSS animation 改 duration 会跳变）。
 * 透明度/字号变化走父组件重渲染，实时生效。
 * memo + 内部订阅 speed：速度滑块拖动时子组件零重渲染，主线程不卡动画。
 */
function DanmakuBulletBase({
  item,
  opacity,
  size,
  isDark,
  onDone,
  onRegister,
}: {
  item: DanmakuItem
  opacity: number
  size: number
  isDark: boolean
  onDone: (id: string) => void
  onRegister: (id: string, anims: Animation[] | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const animsRef = useRef<Animation[]>([])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fly = el.animate(
      [{ transform: 'translateX(100vw)' }, { transform: 'translateX(-100vw)' }],
      {
        duration: item.baseDuration * 1000,
        delay: item.delay * 1000,
        iterations: 1,
        fill: 'both',
        easing: 'linear',
      },
    )
    const fade = el.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }],
      {
        duration: item.baseDuration * 1000,
        delay: item.delay * 1000,
        iterations: 1,
        fill: 'both',
        easing: 'linear',
      },
    )
    fly.playbackRate = useDanmakuSettingsStore.getState().speed
    fade.playbackRate = useDanmakuSettingsStore.getState().speed
    animsRef.current = [fly, fade]
    fly.onfinish = () => onDone(item.id)
    onRegister(item.id, [fly, fade])

    // 速度实时：订阅 store，在途弹幕立即按新 speed 调速且不触发重渲染
    const unsub = useDanmakuSettingsStore.subscribe((state, prev) => {
      if (state.speed === prev.speed) return
      for (const a of animsRef.current) a.playbackRate = state.speed
    })

    return () => {
      unsub()
      fly.cancel()
      fade.cancel()
      animsRef.current = []
      onRegister(item.id, null)
    }
    // 弹幕唯一，动画只在挂载时创建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className="absolute whitespace-nowrap rounded-full shadow-md flex items-center gap-3 will-change-transform"
      style={{
        top: `${item.top}%`,
        padding: `${Math.round(8 * size)}px ${Math.round(16 * size)}px`,
        backgroundColor: isDark
          ? `rgba(0, 0, 0, ${opacity / 100})`
          : `rgba(255, 255, 255, ${opacity / 100})`,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <span
        className="font-bold"
        style={{ color: isDark ? '#f3f4f6' : '#111827', fontSize: `${Math.round(18 * size)}px` }}
      >
        {item.word}
      </span>
      <span
        className=""
        style={{ color: isDark ? '#d1d5db' : '#374151', fontSize: `${Math.round(14 * size)}px` }}
      >
        {item.translation}
      </span>
    </div>
  )
}

export const DanmakuBullet = memo(DanmakuBulletBase)

export function Danmaku({ isVisible }: { isVisible: boolean }) {
  const { theme, systemTheme, resolvedTheme } = useTheme()
  const opacity = useDanmakuSettingsStore((s) => s.opacity)
  const size = useDanmakuSettingsStore((s) => s.size)
  const speed = useDanmakuSettingsStore((s) => s.speed)
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<DanmakuItem[]>([])
  const tracksFreeTimeRef = useRef<number[]>(Array(TRACK_COUNT).fill(0))
  const animsRef = useRef<Map<string, Animation[]>>(new Map())
  // 每条在途弹幕的轨道 + 轨道占用截止时间（side-channel，不进 React state）：
  // 调速时据此缩放剩余占用，避免同轨新弹幕与在途弹幕重叠（weizhenye/danmaku 的
  // (comment.width + stage.width) / speed 模型在本实现中的近似——占用时间随速度反比缩放）。
  const busyRef = useRef<Map<string, { track: number; busyUntil: number }>>(new Map())

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark =
    resolvedTheme === 'dark' || theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  const register = useCallback((id: string, anims: Animation[] | null) => {
    if (anims) animsRef.current.set(id, anims)
    else {
      animsRef.current.delete(id)
      busyRef.current.delete(id)
    }
  }, [])

  const handleDone = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  // 兜底清理：按动画 playState 移除已完成弹幕（onfinish 已移除，此为异常残留防线）
  useEffect(() => {
    if (!isVisible) return
    const cleanupInterval = setInterval(() => {
      setItems((prev) =>
        prev.filter((it) => {
          const anims = animsRef.current.get(it.id)
          return !(anims && anims[0] && anims[0].playState === 'finished')
        }),
      )
    }, 2000)
    return () => clearInterval(cleanupInterval)
  }, [isVisible])

  const fetchAndGenerateDanmaku = async (skipDelay = false) => {
    try {
      // getState() 而非 hook 选择器：函数被 interval/订阅闭包持有，getState() 每次取最新
      const { speed, amount } = useDanmakuSettingsStore.getState()
      // ceil 而非 round：0.5-0.8x 都 round 到 2（滑块死区），ceil 让 0.7x 起就响应
      const limit = Math.max(1, Math.min(8, Math.ceil(3 * amount)))
      const res = await fetch(`/api/danmaku?limit=${limit}&t=${Date.now()}`)
      const result = await res.json()

      if (result.success && result.data && result.data.length > 0) {
        const words = result.data
        const now = Date.now()

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
          const baseDuration = 25 + Math.random() * 15
          // 轨道占用 ≈ 弹幕自身穿越右缘的时间（参考 weizhenye/danmaku 的
          // (comment.width + stage.width) / speed 模型）。0.4×时长过度保守：
          // 轨道常年"忙碌"导致新弹幕被推迟、到达不均匀，单词量滑块的密度映射被稀释。
          // 0.15× ≈ 3.75-6s 的"进场+安全间距"，密度由 limit 主导、更可预测。
          const timeToClearEntry = (baseDuration / speed) * 0.15
          const busyUntil = now + delay * 1000 + timeToClearEntry * 1000
          tracksFreeTimeRef.current[trackIndex] = busyUntil

          const id = `${w.word}-${now}-${i}`
          busyRef.current.set(id, { track: trackIndex, busyUntil })

          newItems.push({
            id: id,
            word: w.word,
            translation: String(w.translation || '')
              .replace(/\s+/g, ' ')
              .slice(0, 40),
            top: top,
            delay: delay,
            baseDuration: baseDuration,
          })
        }

        setItems((prevItems) => {
          const combined = [...prevItems, ...newItems]
          if (combined.length > MAX_ITEMS) {
            return combined.slice(combined.length - MAX_ITEMS)
          }
          return combined
        })
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development')
        console.error('Failed to generate danmaku:', err)
    }
  }

  // 初始 + 可见性切回：拉一批（间隔轮询独立在下一个 effect，避免调速时重复拉取）
  useEffect(() => {
    if (!isVisible) {
      setItems([])
      return
    }
    fetchAndGenerateDanmaku()
  }, [isVisible])

  // 周期轮询：间隔随速度自适应（速度慢→间隔长），保证"速度调小数量不增加"
  useEffect(() => {
    if (!isVisible) return
    const interval = setInterval(() => {
      fetchAndGenerateDanmaku()
    }, danmakuPollInterval(speed))
    return () => clearInterval(interval)
  }, [isVisible, speed])

  // 设置变更 → 即时生效：
  //   速度：playbackRate 已在子弹内实时调速
  //   单词量：调小立即按比例移除在途弹幕；调大立即快速铺开补一批
  //   透明度/字号：走重渲染
  // 防抖 500ms：拖滑块期间只发一次补拉请求。
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isVisible) return

    const unsub = useDanmakuSettingsStore.subscribe((state, prev) => {
      if (state.speed === prev.speed && state.amount === prev.amount) return

      // 调速后重算每条在途弹幕的轨道空闲时间（剩余占用 × 旧速/新速）。
      // 否则 tracksFreeTime 是旧速度下算的，改慢速后同轨新弹幕会追尾在途弹幕。
      if (state.speed !== prev.speed) {
        const ratio = prev.speed / state.speed
        const now = Date.now()
        for (const entry of busyRef.current.values()) {
          const remaining = entry.busyUntil - now
          if (remaining > 0) {
            entry.busyUntil = now + remaining * ratio
            if (entry.busyUntil > tracksFreeTimeRef.current[entry.track]) {
              tracksFreeTimeRef.current[entry.track] = entry.busyUntil
            }
          }
        }
      }

      if (state.amount !== prev.amount) {
        setItems((prevItems) => {
          const target = amountRemovalTarget(prevItems.length, state.amount, prev.amount)
          if (prevItems.length <= target) return prevItems
          // 保留最新 target 条：slice(0,target) 保留的是即将飘完的旧弹幕，
          // 删完屏幕几秒内就清空了，复习节奏被打断。保留最新 → 剩余弹幕生命期长，
          // 密度立刻降下来但屏幕不空（旧的自然飘完退场）。
          return prevItems.slice(prevItems.length - target)
        })
      }

      // 调大才补拉（快速铺开显现）；调小只移除，不补拉（避免刚删又补回）。
      // 速度不再触发补拉：WAAPI 对新旧弹幕实时调速，补拉是 CSS 方案遗留，
      // 且低速补拉会塞入更多长寿命弹幕，反而推高数量。
      const amountUp = state.amount > prev.amount
      if (amountUp) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null
          fetchAndGenerateDanmaku(true)
        }, 500)
      }
    })

    return () => {
      unsub()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return

    const handleVisibilityChange = () => {
      // 从其它标签/窗口切回时：重置轨道但不清空已飘的词，避免空白
      if (document.visibilityState === 'visible') {
        tracksFreeTimeRef.current = Array(TRACK_COUNT).fill(0)
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
      className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {items.map((item) => (
        <DanmakuBullet
          key={item.id}
          item={item}
          opacity={opacity}
          size={size}
          isDark={isDark}
          onDone={handleDone}
          onRegister={register}
        />
      ))}
    </div>
  )
}
