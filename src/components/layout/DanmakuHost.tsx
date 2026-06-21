'use client'

import { Danmaku } from '@/components/ui/danmaku'
import { useDanmakuStore } from '@/stores/danmakuStore'

export function DanmakuHost() {
  const showDanmaku = useDanmakuStore((s) => s.showDanmaku)
  if (!showDanmaku) return null
  return <Danmaku isVisible={showDanmaku} />
}