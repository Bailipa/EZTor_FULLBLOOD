'use client'

import { useEffect } from 'react'
import { Danmaku } from '@/components/ui/danmaku'
import { useDanmakuStore } from '@/stores/danmakuStore'
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

  // 安卓/桌面：弹幕由全局悬浮层渲染；浏览器：局内渲染
  if (isAndroidApp() || isDesktopApp()) return null
  if (!showDanmaku) return null
  return <Danmaku isVisible={showDanmaku} />
}
