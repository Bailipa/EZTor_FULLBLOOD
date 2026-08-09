'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type DanmakuStatus = 'idle' | 'counting' | 'active' | 'empty'

interface DanmakuState {
  showDanmaku: boolean
  status: DanmakuStatus
  countdownValue: number
  toggle: () => Promise<void>
  /** 托盘/快捷键从主进程直接开启/关闭（跳过 5s 倒计时），并同步 App 内开关 */
  setFromExternal: (enabled: boolean) => void
}

const STORAGE_KEY = 'vocab_showDanmaku'
const COUNTDOWN_SECONDS = 5
const EMPTY_RESET_MS = 3000

interface StorageLike {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

function readLegacyShowDanmaku(raw: string): boolean | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'boolean') return parsed
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      const data = (parsed as { data: unknown }).data
      if (typeof data === 'boolean') return data
    }
  } catch {}
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

function customGetItem(name: string): string | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(name)
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'state' in parsed && 'version' in parsed) {
      return raw
    }
  } catch {}

  const legacy = readLegacyShowDanmaku(raw)
  if (legacy !== null) {
    return JSON.stringify({ state: { showDanmaku: legacy }, version: 0 })
  }
  return null
}

const storage: StorageLike = {
  getItem: customGetItem,
  setItem: (name, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(name, value)
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name)
  },
}

const timers: { intervalId?: ReturnType<typeof setInterval>; doneTimer?: ReturnType<typeof setTimeout>; resetTimer?: ReturnType<typeof setTimeout> } = {}

function clearAllTimers() {
  if (timers.intervalId) clearInterval(timers.intervalId)
  if (timers.doneTimer) clearTimeout(timers.doneTimer)
  if (timers.resetTimer) clearTimeout(timers.resetTimer)
  timers.intervalId = undefined
  timers.doneTimer = undefined
  timers.resetTimer = undefined
}

export const useDanmakuStore = create<DanmakuState>()(
  persist(
    (set, get) => ({
      showDanmaku: false,
      status: 'idle',
      countdownValue: COUNTDOWN_SECONDS,
      setFromExternal: (enabled) => {
        clearAllTimers()
        set(
          enabled
            ? { status: 'active', showDanmaku: true }
            : { status: 'idle', showDanmaku: false },
        )
      },
      toggle: async () => {
        const { status, showDanmaku } = get()

        if (status === 'empty') {
          clearAllTimers()
          set({ status: 'idle', showDanmaku: !showDanmaku })
          return
        }

        if (status === 'active') {
          clearAllTimers()
          set({ status: 'idle', showDanmaku: !showDanmaku })
          return
        }

        // 5 秒倒计时期间可反悔：再次点击立即取消（否则这一阶段点击被忽略，弹幕关不掉）
        if (status === 'counting') {
          clearAllTimers()
          set({ status: 'idle', showDanmaku: false })
          return
        }

        if (status !== 'idle') return
        clearAllTimers()
        set({ status: 'counting', countdownValue: COUNTDOWN_SECONDS, showDanmaku: true })

        timers.intervalId = setInterval(() => {
          set((s) => {
            if (s.countdownValue <= 1) {
              if (timers.intervalId) clearInterval(timers.intervalId)
              timers.intervalId = undefined
              return { countdownValue: 1 }
            }
            return { countdownValue: s.countdownValue - 1 }
          })
        }, 1000)

        try {
          // dryRun：只判断词库是否有词，不消耗系统性遍历的轮次（不标记已展示）
          const res = await fetch(`/api/danmaku?limit=1&dryRun=1&t=${Date.now()}`)
          const result = (await res.json()) as {
            success?: boolean
            data?: unknown[]
          }
          const hasWords = Boolean(result.success && Array.isArray(result.data) && result.data.length > 0)

          // 倒计时中取消（counting→idle）后才返回的请求要作废，
          // 否则残留 doneTimer 会在 5s 后把状态静默推成 active，下次点击行为错乱
          if (get().status !== 'counting') return

          timers.doneTimer = setTimeout(() => {
            clearAllTimers()
            if (hasWords) {
              set({ status: 'active' })
            } else {
              set({ status: 'empty' })
              timers.resetTimer = setTimeout(() => {
                clearAllTimers()
                set({ status: 'idle', showDanmaku: false })
              }, EMPTY_RESET_MS)
            }
          }, COUNTDOWN_SECONDS * 1000)
        } catch {
          if (get().status !== 'counting') return
          timers.doneTimer = setTimeout(() => {
            clearAllTimers()
            set({ status: 'empty' })
            timers.resetTimer = setTimeout(() => {
              clearAllTimers()
              set({ status: 'idle', showDanmaku: false })
            }, EMPTY_RESET_MS)
          }, COUNTDOWN_SECONDS * 1000)
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ showDanmaku: state.showDanmaku }),
      // reload 后恢复：只持久化了 showDanmaku，status 默认 idle 会与
      // 实际弹幕状态不一致（弹幕在飘但按钮显示"开启"）。恢复时若
      // showDanmaku=true 则同步 status=active，让按钮/弹幕一致。
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { showDanmaku?: boolean }
        const merged = { ...current, ...p }
        if (merged.showDanmaku) merged.status = 'active'
        return merged
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearAllTimers)
}