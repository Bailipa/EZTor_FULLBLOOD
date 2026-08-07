'use client'

import { useEffect, useState } from 'react'

export type AppUpdateStatus = 'checking' | 'downloading' | 'uptodate' | 'ready' | 'error'

export type AppUpdateState = {
  status: AppUpdateStatus | null
  version: string | null
  percent: number | null
  error: string | null
}

const INITIAL: AppUpdateState = { status: null, version: null, percent: null, error: null }

/** 桌面端自动更新状态（electron-updater 经 preload 推送）：
 * checking / downloading(percent) / uptodate / ready(可重启安装) / error
 */
export function useAppUpdate(): AppUpdateState {
  const [state, setState] = useState<AppUpdateState>(INITIAL)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.eztor?.onUpdateStatus) return
    const off = window.eztor.onUpdateStatus((p) => {
      setState({
        status: (p.status as AppUpdateStatus) ?? null,
        version: p.version ?? null,
        percent: typeof p.percent === 'number' ? p.percent : null,
        error: p.message ?? null,
      })
    })
    return off
  }, [])

  return state
}
