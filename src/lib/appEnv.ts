'use client'

/**
 * 应用环境识别：
 *  - 桌面 App（Electron）：preload 注入 window.eztor
 *  - 安卓 App（WebView）：UA 带 EZTorAndroid/<version>
 *  - 桌面 App（未来）：UA 带 EZTorDesktop/<version>
 */

/** 桌面 App（Electron）preload 注入的桥：弹幕 + 自动更新 */
declare global {
  interface Window {
    eztor?: {
      setGlobalDanmaku?: (enabled: boolean) => void
      onDanmakuStateChanged?: (cb: (enabled: boolean) => void) => () => void
      installUpdate?: () => void
      downloadUpdate?: () => void
      checkUpdate?: () => void
      setAutoDownload?: (enabled: boolean) => void
      getAutoDownload?: () => Promise<boolean>
      getUpdateStatus?: () => Promise<{
        status: string
        version?: string
        percent?: number
        message?: string
      } | null>
      onUpdateStatus?: (cb: (p: { status: string; version?: string; percent?: number; message?: string }) => void) => () => void
    }
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as unknown as { eztor?: unknown }).eztor !== 'undefined'
}

export function isAndroidApp(): boolean {
  if (typeof navigator === 'undefined') return false
  return /EZTorAndroid/i.test(navigator.userAgent)
}

export function isInsideApp(): boolean {
  return isDesktopApp() || isAndroidApp()
}

/** 从 UA 解析 App 已安装版本（如 0.3.0）；浏览器返回 null */
export function parseInstalledVersion(): string | null {
  if (typeof navigator === 'undefined') return null
  const m = /EZTor(?:Android|Desktop)\/(\d+\.\d+\.\d+)/i.exec(navigator.userAgent)
  return m ? m[1] : null
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}
