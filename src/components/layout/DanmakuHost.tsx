'use client'

import { useEffect } from 'react'
import { Danmaku } from '@/components/ui/danmaku'
import { useDanmakuStore } from '@/stores/danmakuStore'
import { useDanmakuSettingsStore } from '@/stores/danmakuSettingsStore'
import { isAndroidApp, isDesktopApp } from '@/lib/appEnv'

declare global {
  interface Window {
    /** 安卓原生桥：启停全局悬浮层（DanmakuService，WebView 加载同一份 danmaku-overlay.html） */
    AndroidDanmaku?: {
      setEnabled: (enabled: boolean) => void
      isActive: () => boolean
    }
  }
}

export function DanmakuHost() {
  const showDanmaku = useDanmakuStore((s) => s.showDanmaku)

  // 应用内开启弹幕 = 开启全局弹幕：
  //  - 安卓：原生 DanmakuService 悬浮层
  //  - 桌面：Electron 全局弹幕悬浮窗（覆盖整个屏幕，而非只在本窗口）
  // 因此应用内不再重复渲染局内弹幕，避免叠加。
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isAndroidApp()) {
      window.AndroidDanmaku?.setEnabled(showDanmaku)
      return
    }
    if (isDesktopApp()) {
      window.eztor?.setGlobalDanmaku?.(showDanmaku)
    }
  }, [showDanmaku])

  // 反向同步：托盘/快捷键从主进程改弹幕状态 → 同步回 App 内开关（并持久化）。
  // setFromExternal 会更新 showDanmaku，触发上面 effect 回发 set-overlay（幂等，不会死循环）。
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDesktopApp()) return
    return window.eztor?.onDanmakuStateChanged?.((enabled) => {
      useDanmakuStore.getState().setFromExternal(enabled)
    })
  }, [])

  // 托盘弹幕调节 → 应用内 store（滑块实时同步）；同时回发设置到悬浮层（持久化后由 storage 事件驱动）
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDesktopApp()) return
    return window.eztor?.onDanmakuSettingsApply?.(({ key, value }) => {
      const s = useDanmakuSettingsStore.getState()
      if (key === 'speed') s.setSpeed(value)
      else if (key === 'amount') s.setAmount(value)
      else if (key === 'opacity') s.setOpacity(value)
      else if (key === 'size') s.setSize(value)
    })
  }, [])

  // 应用内设置面板改动 → 上报主进程（托盘 radio 勾选态跟随）
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isDesktopApp()) return
    const report = () => {
      const s = useDanmakuSettingsStore.getState()
      window.eztor?.reportDanmakuSetting?.('speed', s.speed)
      window.eztor?.reportDanmakuSetting?.('amount', s.amount)
      window.eztor?.reportDanmakuSetting?.('opacity', s.opacity)
      window.eztor?.reportDanmakuSetting?.('size', s.size)
    }
    report()
    return useDanmakuSettingsStore.subscribe((state, prev) => {
      if (state.speed !== prev.speed) window.eztor?.reportDanmakuSetting?.('speed', state.speed)
      if (state.amount !== prev.amount) window.eztor?.reportDanmakuSetting?.('amount', state.amount)
      if (state.opacity !== prev.opacity) window.eztor?.reportDanmakuSetting?.('opacity', state.opacity)
      if (state.size !== prev.size) window.eztor?.reportDanmakuSetting?.('size', state.size)
    })
  }, [])

  // 安卓/桌面：弹幕由全局悬浮层渲染；浏览器：局内渲染
  if (isAndroidApp() || isDesktopApp()) return null
  if (!showDanmaku) return null
  return <Danmaku isVisible={showDanmaku} />
}
