'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { isDesktopApp } from '@/lib/appEnv'
import {
  MonitorDown,
  Smartphone,
  Download,
  Check,
  FileCode2,
  Loader2,
  Apple,
} from 'lucide-react'

// 兜底：/api/version 未返回时先用最新安装包路径（版本源统一后由接口动态决定）
const FALLBACK_WIN_INSTALLER = '/downloads/EZTor-Setup-1.13.0.exe'
const FALLBACK_ANDROID_APK = '/downloads/eztor-1.13.0.apk'
const FALLBACK_MAC_INSTALLER = '/downloads/EZTor-1.13.0.dmg'
const FALLBACK_MAC_ARM64_INSTALLER = '/downloads/EZTor-1.13.0-arm64.dmg'

export default function DownloadPage() {
  const appVer = useAppVersion()
  const appUpdate = useAppUpdate()
  // 自动下载更新开关（桌面端；主进程持久化）
  const [autoDownload, setAutoDownload] = useState(false)

  useEffect(() => {
    if (!isDesktopApp() || !window.eztor?.getAutoDownload) return
    window.eztor.getAutoDownload().then((v) => setAutoDownload(Boolean(v)))
  }, [])

  const handleAutoDownload = (enabled: boolean) => {
    setAutoDownload(enabled)
    window.eztor?.setAutoDownload?.(enabled)
  }

  const winInstaller = appVer.windowsInstaller ?? FALLBACK_WIN_INSTALLER
  const androidApk = appVer.androidApk ?? FALLBACK_ANDROID_APK
  const macInstaller = appVer.macInstaller ?? FALLBACK_MAC_INSTALLER
  const macArm64Installer = appVer.macArm64Installer ?? FALLBACK_MAC_ARM64_INSTALLER

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-4 md:p-8 pb-24 xl:pb-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">{appVer.mounted && appVer.isApp ? '更新 EZTor' : '下载 EZTor'}</h1>
            <p className="text-sm text-muted-foreground">
              桌面 / 安卓安装包 · 数据与网页版完全同步
            </p>
            {appVer.mounted && appVer.isApp && (
              <p className="text-sm text-muted-foreground">
                当前版本 v{appVer.installedVersion ?? '?'}
                {appVer.hasUpdate
                  ? ` · 发现新版本 v${appVer.latestVersion}，下载后覆盖安装即可更新`
                  : appVer.hasUpdate === false
                    ? ' · 已是最新版本'
                    : ''}
              </p>
            )}
          </header>

          <>
              {/* Windows */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <MonitorDown className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Windows 桌面版</h2>
                    <Badge variant="secondary" className="ml-auto">x64</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    独立窗口的 EZTor 桌面应用（浏览器套壳），含全局弹幕悬浮窗（快捷键
                    Ctrl+Shift+D），可固定到任务栏 / 桌面。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {isDesktopApp() && appUpdate.status === 'ready' ? (
                      <Button size="lg" onClick={() => window.eztor?.installUpdate?.()}>
                        <Check className="w-4 h-4 mr-1.5" />
                        新版本已就绪，点击重启更新
                      </Button>
                    ) : isDesktopApp() && appUpdate.status === 'available' ? (
                      <Button size="lg" onClick={() => window.eztor?.downloadUpdate?.()}>
                        <Download className="w-4 h-4 mr-1.5" />
                        发现新版本，立即更新
                      </Button>
                    ) : isDesktopApp() && appUpdate.status === 'downloading' ? (
                      <Button size="lg" disabled>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        正在后台下载更新… {appUpdate.percent != null ? `${appUpdate.percent}%` : ''}
                      </Button>
                    ) : (
                      <Button asChild size="lg">
                        <a href={winInstaller} download>
                          <Download className="w-4 h-4 mr-1.5" />
                          下载 Windows 安装包
                        </a>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="lg">
                      <a href="https://github.com/Bailipa/EZTor_FULLBLOOD" target="_blank" rel="noopener noreferrer">
                        <FileCode2 className="w-4 h-4 mr-1.5" />
                        查看源码
                      </a>
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div>
                      <p className="text-sm font-medium">自动下载更新</p>
                      <p className="text-xs text-muted-foreground">
                        开启后新版本后台自动下载，装好弹「重启更新」；关闭则每次先询问
                      </p>
                    </div>
                    {isDesktopApp() && window.eztor?.setAutoDownload ? (
                      <Switch
                        checked={autoDownload}
                        onCheckedChange={handleAutoDownload}
                        aria-label="自动下载更新"
                      />
                    ) : (
                      <Badge variant="secondary">仅桌面端</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    安装包暂未购买代码签名证书，浏览器 / Windows SmartScreen 可能提示"不安全 / 未知发布者"，
                    属正常拦截：Edge 下载时点「更多信息」→「仍要下载」；运行安装包时点「更多信息」→「仍要运行」即可。
                  </p>
                </CardContent>
              </Card>

              {/* macOS */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Apple className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">macOS 桌面版</h2>
                    <Badge variant="secondary" className="ml-auto">macOS 11.0+</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    独立窗口的 EZTor 桌面应用（浏览器套壳），含全局弹幕悬浮窗，可驻留菜单栏。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="lg">
                      <a href={macInstaller} download>
                        <Download className="w-4 h-4 mr-1.5" />
                        下载 Intel (x64)
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <a href={macArm64Installer} download>
                        <Download className="w-4 h-4 mr-1.5" />
                        下载 Apple 芯片 (arm64)
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    怎么判断芯片？左上角   →「关于本机」→「芯片」显示 Apple M1/M2/… 选 arm64；显示 Intel 选 x64。
                  </p>
                  <p className="text-xs text-amber-600/80 leading-relaxed border-l-2 border-amber-500/50 pl-2">
                    安装包未签名（内测版），首次打开会被 macOS 拦截。打开方法：
                    右键点 EZTor.app →「打开」→ 再点「打开」；若仍提示"已损坏"，
                    在终端执行：<code className="font-mono">xattr -cr /Applications/EZTor.app</code> 后重新打开。
                  </p>
                </CardContent>
              </Card>

              {/* Android */}
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">安卓 APK</h2>
                    <Badge variant="secondary" className="ml-auto">Android 7.0+</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    WebView 套壳版，安装后即是独立 App，图标、全屏、后台运行，与网页账号数据完全同步。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="lg">
                      <a href={androidApk} download>
                        <Download className="w-4 h-4 mr-1.5" />
                        下载安卓 APK
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    安装时需允许"安装未知来源应用"。APK 由仓库 android/ 工程构建。
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    也可直接用 Chrome「安装应用」方式安装网页版（PWA），无需 APK
                  </div>
                </CardContent>
              </Card>
            </>

          {/* 网页版 */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">网页版（免安装）</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                直接打开网页使用，所有设备数据同步。也支持浏览器「安装应用」变成独立窗口。
              </p>
              <Button asChild variant="outline">
                <Link href="/" target="_blank">
                  打开网页版
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
