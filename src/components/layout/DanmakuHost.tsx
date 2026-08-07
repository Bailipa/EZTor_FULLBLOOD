'use client'

import { useEffect } from 'react'
import { Danmaku } from '@/components/ui/danmaku'
import { useDanmakuStore } from '@/stores/danmakuStore'
import { isAndroidApp } from '@/lib/appEnv'

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

  // 安卓端：弹幕由原生全局悬浮层渲染（与局内同一套规则），
  // 网页不再重复渲染避免叠加；状态变化同步到原生桥。
  useEffect(() => {
    if (!isAndroidApp() || typeof window === 'undefined') return
    window.AndroidDanmaku?.setEnabled(showDanmaku)
  }, [showDanmaku])

  if (isAndroidApp()) return null
  if (!showDanmaku) return null
  return <Danmaku isVisible={showDanmaku} />
}
