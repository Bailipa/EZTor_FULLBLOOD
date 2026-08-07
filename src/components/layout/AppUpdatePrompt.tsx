'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isDesktopApp } from '@/lib/appEnv'
import { useAppUpdate } from '@/hooks/useAppUpdate'

/**
 * 桌面端自动更新提示：electron-updater 后台下载完成后，弹出"重启更新"。
 * 点击后 quitAndInstall() —— 自动退出、静默安装、自动重启，无需手动关软件。
 */
export function AppUpdatePrompt() {
  const update = useAppUpdate()
  const shownReadyRef = useRef<string | null>(null)
  const shownErrorRef = useRef(false)

  useEffect(() => {
    if (!isDesktopApp() || typeof window === 'undefined') return

    if (update.status === 'ready' && update.version && shownReadyRef.current !== update.version) {
      shownReadyRef.current = update.version
      toast('新版本已就绪', {
        description: `EZTor ${update.version} 已下载完成，点击「重启更新」立即生效，无需手动关闭软件。`,
        duration: 12000,
        action: {
          label: '重启更新',
          onClick: () => window.eztor?.installUpdate?.(),
        },
      })
    }

    if (update.status === 'error' && !shownErrorRef.current) {
      shownErrorRef.current = true
      toast.error('更新检查失败', { description: '网络异常可稍后重试，或在下载页手动安装。' })
    }
  }, [update])

  return null
}
