'use client'

import { useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { isDesktopApp } from '@/lib/appEnv'
import {
  MonitorDown,
  Smartphone,
  Download,
  Check,
  FileCode2,
  Lock,
  Loader2,
  FlaskConical,
} from 'lucide-react'

// 兜底：/api/version 未返回时先用 0.3.0 路径（版本源统一后由接口动态决定）
const FALLBACK_WIN_INSTALLER = '/downloads/EZTor-Setup-0.3.0.exe'
const FALLBACK_ANDROID_APK = '/downloads/eztor-0.3.0.apk'

export default function DownloadPage() {
  const appVer = useAppVersion()
  const appUpdate = useAppUpdate()
  const [password, setPassword] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const winInstaller = appVer.windowsInstaller ?? FALLBACK_WIN_INSTALLER
  const androidApk = appVer.androidApk ?? FALLBACK_ANDROID_APK

  const handleUnlock = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/download/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.success) {
        setUnlocked(true)
        setError('')
      } else {
        setError(data.error || '下载密码错误，请重试')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setChecking(false)
    }
  }

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

          {!unlocked ? (
            /* 密码门禁 */
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <FlaskConical className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">软件下载功能测试中</h2>
                    <p className="text-sm text-muted-foreground">
                      安装包目前仅面向内测用户，输入下载密码后开放下载。
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">下载密码</label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setError('')
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                      placeholder="请输入下载密码"
                      className="flex-1"
                    />
                    <Button onClick={handleUnlock} disabled={checking || !password} className="gap-1.5">
                      {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      解锁下载
                    </Button>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
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
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    安装包暂未购买代码签名证书，浏览器 / Windows SmartScreen 可能提示"不安全 / 未知发布者"，
                    属正常拦截：Edge 下载时点「更多信息」→「仍要下载」；运行安装包时点「更多信息」→「仍要运行」即可。
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
          )}

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
