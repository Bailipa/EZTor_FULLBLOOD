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
import { MonitorDown, Smartphone, Download, Check, FileCode2, Loader2, Apple, Laptop, Globe2, ArrowLeft } from 'lucide-react'

const FALLBACK_WIN_INSTALLER = '/downloads/EZTor-Setup-1.13.0.exe'
const FALLBACK_ANDROID_APK = '/downloads/eztor-1.13.0.apk'
const FALLBACK_MAC_INSTALLER = '/downloads/EZTor-1.13.0.dmg'
const FALLBACK_MAC_ARM64_INSTALLER = '/downloads/EZTor-1.13.0-arm64.dmg'

type Platform = 'android' | 'iphone' | 'mac' | 'windows' | 'linux'
const platforms: Array<{ id: Platform; label: string; hint: string; icon: typeof Smartphone }> = [
  { id: 'android', label: 'Android', hint: '安装 APK', icon: Smartphone },
  { id: 'iphone', label: 'iPhone', hint: 'Safari 网页版', icon: Smartphone },
  { id: 'mac', label: 'Mac', hint: 'Intel 或 Apple 芯片', icon: Apple },
  { id: 'windows', label: 'Windows', hint: 'x64 安装包', icon: MonitorDown },
  { id: 'linux', label: 'Linux', hint: '浏览器网页版', icon: Laptop },
]

export default function DownloadPage() {
  const appVer = useAppVersion()
  const appUpdate = useAppUpdate()
  const [platform, setPlatform] = useState<Platform | null>(null)
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
  const selected = platforms.find((item) => item.id === platform)

  return (
    <AppLayout>
      <div data-workspace-page className="min-h-screen bg-background p-4 md:p-8 pb-24 xl:pb-8">
        <div data-workspace-content data-workspace-downloads className="max-w-2xl mx-auto space-y-6">
          <header data-workspace-toolbar className="indigo-page-header space-y-1">
            <h1 className="text-2xl font-bold">{appVer.mounted && appVer.isApp ? '更新 EZTor' : '下载 EZTor'}</h1>
            <p className="text-sm text-muted-foreground">先选择设备，马上找到适合你的安装方式。</p>
            {appVer.mounted && appVer.isApp && <p className="text-sm text-muted-foreground">当前版本 v{appVer.installedVersion ?? '?'}{appVer.hasUpdate ? ` · 发现新版本 v${appVer.latestVersion}` : appVer.hasUpdate === false ? ' · 已是最新版本' : ''}</p>}
          </header>

          {!selected ? (
            <Card><CardContent className="p-4 md:p-6 space-y-4"><div><h2 className="text-lg font-semibold">你的设备是？</h2><p className="text-sm text-muted-foreground mt-1">选择后只显示对应的下载方式，随时可以切换。</p></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{platforms.map(({ id, label, hint, icon: Icon }) => <Button key={id} type="button" variant="outline" className="h-auto min-h-24 flex-col items-start justify-center gap-2 p-4 text-left" onClick={() => setPlatform(id)}><Icon className="w-5 h-5 text-primary" aria-hidden="true" /><span className="font-semibold">{label}</span><span className="text-xs text-muted-foreground font-normal">{hint}</span></Button>)}</div></CardContent></Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setPlatform(null)}><ArrowLeft className="w-4 h-4 mr-1.5" />切换设备</Button><Badge variant="secondary">{selected.label}</Badge></div>

              {platform === 'windows' && <Card><CardContent className="p-5 space-y-4"><div className="flex items-center gap-2"><MonitorDown className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">Windows 桌面版</h2><Badge variant="secondary" className="ml-auto">x64</Badge></div><p className="text-sm text-muted-foreground">独立窗口的 EZTor 桌面应用，含全局弹幕悬浮窗，可固定到任务栏或桌面。</p><div className="flex flex-wrap gap-2">{isDesktopApp() && appUpdate.status === 'ready' ? <Button size="lg" onClick={() => window.eztor?.installUpdate?.()}><Check className="w-4 h-4 mr-1.5" />新版本已就绪，点击重启更新</Button> : isDesktopApp() && appUpdate.status === 'available' ? <Button size="lg" onClick={() => window.eztor?.downloadUpdate?.()}><Download className="w-4 h-4 mr-1.5" />发现新版本，立即更新</Button> : isDesktopApp() && appUpdate.status === 'downloading' ? <Button size="lg" disabled><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />正在后台下载更新… {appUpdate.percent != null ? `${appUpdate.percent}%` : ''}</Button> : <Button asChild size="lg"><a href={winInstaller} download><Download className="w-4 h-4 mr-1.5" />下载 Windows 安装包</a></Button>}<Button asChild variant="outline" size="lg"><a href="https://github.com/Bailipa/EZTor_FULLBLOOD" target="_blank" rel="noopener noreferrer"><FileCode2 className="w-4 h-4 mr-1.5" />查看源码</a></Button></div><div className="flex items-center justify-between gap-2 pt-1"><div><p className="text-sm font-medium">自动下载更新</p><p className="text-xs text-muted-foreground">开启后新版本会在后台下载</p></div>{isDesktopApp() && window.eztor?.setAutoDownload ? <Switch checked={autoDownload} onCheckedChange={handleAutoDownload} aria-label="自动下载更新" /> : <Badge variant="secondary">仅桌面端</Badge>}</div><p className="text-xs text-muted-foreground/70 leading-relaxed">安装包暂未购买代码签名证书，Windows 可能提示未知发布者；按提示选择“仍要下载”或“仍要运行”即可。</p></CardContent></Card>}

              {platform === 'mac' && <Card><CardContent className="p-5 space-y-4"><div className="flex items-center gap-2"><Apple className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">macOS 桌面版</h2><Badge variant="secondary" className="ml-auto">macOS 11.0+</Badge></div><p className="text-sm text-muted-foreground">选择与你的 Mac 芯片对应的安装包。</p><div className="flex flex-wrap gap-2"><Button asChild size="lg"><a href={macInstaller} download><Download className="w-4 h-4 mr-1.5" />下载 Intel (x64)</a></Button><Button asChild variant="outline" size="lg"><a href={macArm64Installer} download><Download className="w-4 h-4 mr-1.5" />下载 Apple 芯片 (arm64)</a></Button></div><p className="text-xs text-muted-foreground/70 leading-relaxed">“关于本机”中显示 Intel 选 x64，显示 Apple M1/M2/… 选 arm64。安装包未签名，首次打开请右键选择“打开”。</p></CardContent></Card>}

              {platform === 'android' && <Card><CardContent className="p-5 space-y-4"><div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">Android APK</h2><Badge variant="secondary" className="ml-auto">Android 7.0+</Badge></div><p className="text-sm text-muted-foreground">安装后即是独立 App，账号数据与网页版同步。</p><Button asChild size="lg"><a href={androidApk} download><Download className="w-4 h-4 mr-1.5" />下载 Android APK</a></Button><p className="text-xs text-muted-foreground/70 leading-relaxed">安装时需允许“安装未知来源应用”。也可用 Chrome 的“安装应用”方式使用网页版。</p></CardContent></Card>}

              {(platform === 'iphone' || platform === 'linux') && <Card><CardContent className="p-5 space-y-4"><div className="flex items-center gap-2"><Globe2 className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">网页版（免安装）</h2><Badge variant="secondary" className="ml-auto">{platform === 'iphone' ? 'Safari' : 'Linux'}</Badge></div><p className="text-sm text-muted-foreground">直接打开网页版使用，数据与其它设备同步。支持浏览器“添加到主屏幕”或“安装应用”。</p><Button asChild size="lg"><Link href="/" target="_blank"><Globe2 className="w-4 h-4 mr-1.5" />打开网页版</Link></Button></CardContent></Card>}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
