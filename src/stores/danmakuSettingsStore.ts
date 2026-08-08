'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface DanmakuSettings {
  /** 弹幕速度倍率（1 = 默认，>1 更快） */
  speed: number
  /** 单词量倍率（1 = 默认，>1 更多） */
  amount: number
  /** 胶囊背景不透明度（0-100，百分比） */
  opacity: number
  /** 弹幕字号倍率（1 = 默认，>1 更大） */
  size: number
}

interface DanmakuSettingsState extends DanmakuSettings {
  setSpeed: (v: number) => void
  setAmount: (v: number) => void
  setOpacity: (v: number) => void
  setSize: (v: number) => void
  reset: () => void
}

export const DANMAKU_SETTINGS_KEY = 'vocab_danmaku_settings'
export const DANMAKU_SETTINGS_DEFAULTS: DanmakuSettings = {
  speed: 1,
  amount: 1,
  opacity: 80,
  size: 1,
}

export const DANMAKU_SETTINGS_LIMITS = {
  speed: { min: 0.5, max: 2, step: 0.1 },
  amount: { min: 0.5, max: 2, step: 0.1 },
  opacity: { min: 0, max: 100, step: 5 },
  size: { min: 0.5, max: 2, step: 0.1 },
} as const

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// SSR / 测试（node 无 localStorage）：用 noop 占位，避免 persist 初始化抛错；
// 浏览器仍写入真实 localStorage（JSON 格式被 overlay 端解析）
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const useDanmakuSettingsStore = create<DanmakuSettingsState>()(
  persist(
    (set) => ({
      ...DANMAKU_SETTINGS_DEFAULTS,
      setSpeed: (v) => set({ speed: Math.round(clamp(v, 0.5, 2) * 10) / 10 }),
      setAmount: (v) => set({ amount: Math.round(clamp(v, 0.5, 2) * 10) / 10 }),
      setOpacity: (v) => set({ opacity: clamp(Math.round(v), 0, 100) }),
      setSize: (v) => set({ size: Math.round(clamp(v, 0.5, 2) * 10) / 10 }),
      reset: () => set(DANMAKU_SETTINGS_DEFAULTS),
    }),
    {
      name: DANMAKU_SETTINGS_KEY,
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : localStorage,
      ),
    },
  ),
)
