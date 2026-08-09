'use client'

import { useEffect, useState } from 'react'
import { isInsideApp, isAndroidApp, isDesktopApp, parseInstalledVersion, compareVersions } from '@/lib/appEnv'

export type AppVersionState = {
  /** 已挂载（避免 SSR/水合不一致，挂载前按浏览器态渲染） */
  mounted: boolean
  isApp: boolean
  installedVersion: string | null
  latestVersion: string | null
  /** null=未知/加载中；true=有更新；false=已是最新 */
  hasUpdate: boolean | null
  /** 最新 Windows 安装包路径（下载页用） */
  windowsInstaller: string | null
  /** 最新安卓 APK 路径（下载页用） */
  androidApk: string | null
  /** 最新 Mac Intel (x64) dmg 路径（下载页用） */
  macInstaller: string | null
  /** 最新 Mac Apple Silicon (arm64) dmg 路径（下载页用） */
  macArm64Installer: string | null
}

const INITIAL: AppVersionState = {
  mounted: false,
  isApp: false,
  installedVersion: null,
  latestVersion: null,
  hasUpdate: null,
  windowsInstaller: null,
  androidApk: null,
  macInstaller: null,
  macArm64Installer: null,
}

/**
 * 应用版本检测：识别是否在桌面/安卓 App 内，并对比服务器最新版本。
 */
export function useAppVersion(): AppVersionState {
  const [state, setState] = useState<AppVersionState>(INITIAL)

  useEffect(() => {
    const isApp = isInsideApp()
    const installed = parseInstalledVersion()
    setState((s) => ({ ...s, mounted: true, isApp, installedVersion: installed }))

    // 始终拉取版本/安装包清单：应用内比对更新，浏览器下载页需要安装包路径
    fetch('/api/version')
      .then((r) => r.json())
      .then((j) => {
        if (!j?.success) return
        const data = j.data ?? {}
        // 按自身平台对照版本，避免跨平台误报（安卓看 apk、桌面看 exe 等）
        const platform = isAndroidApp() ? 'android' : isDesktopApp() ? 'desktop' : null
        const latest: string | null =
          platform && data.platforms?.[platform]?.latestVersion
            ? data.platforms[platform].latestVersion
            : data.latestVersion ?? null
        setState((s) => ({
          ...s,
          latestVersion: latest,
          hasUpdate: latest && installed ? compareVersions(installed, latest) < 0 : false,
          windowsInstaller: data.platforms?.desktop?.latestInstaller
            ? `/downloads/${data.platforms.desktop.latestInstaller}`
            : null,
          androidApk: data.platforms?.android?.latestInstaller
            ? `/downloads/${data.platforms.android.latestInstaller}`
            : null,
          macInstaller: data.platforms?.mac?.installers?.find((f: string) => f.endsWith('.dmg') && !f.includes('arm64'))
            ? `/downloads/${data.platforms.mac.installers.find((f: string) => f.endsWith('.dmg') && !f.includes('arm64'))}`
            : null,
          macArm64Installer: data.platforms?.mac?.installers?.find((f: string) => f.endsWith('.dmg') && f.includes('arm64'))
            ? `/downloads/${data.platforms.mac.installers.find((f: string) => f.endsWith('.dmg') && f.includes('arm64'))}`
            : null,
        }))
      })
      .catch(() => setState((s) => ({ ...s, hasUpdate: false })))
  }, [])

  return state
}
