'use client'

import { signIn, useSession } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { usePageView } from '@/lib/analytics'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RefreshCw, Loader2 } from 'lucide-react'
import { isXiaoYingWebView } from '@/lib/isXiaoYingWebView'

export default function SignIn() {
  usePageView('Sign In')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaData, setCaptchaData] = useState<{
    image: string
    hash: string
    timestamp: number
  } | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const wasKicked = searchParams.get('kicked') === '1'

  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [showXiaoYingLogin, setShowXiaoYingLogin] = useState(false)
  const [xiaoyingLoading, setXiaoyingLoading] = useState(false)
  const [xiaoyingError, setXiaoyingError] = useState(false)
  const xiaoyingTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )online_limit=([^;]*)/)
    if (match) {
      setOnlineCount(parseInt(match[1], 10))
    }
    setShowXiaoYingLogin(isXiaoYingWebView())
  }, [])

  const isBlocked = wasKicked || onlineCount !== null

  useEffect(() => {
    if (status === 'authenticated') {
      const callbackUrl = searchParams.get('callbackUrl')
      router.push(callbackUrl || '/')
    }
  }, [status, router, searchParams])

  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha')
      const data = await res.json()
      setCaptchaData(data)
      setCaptchaInput('')
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch captcha', err)
    }
  }

  useEffect(() => {
    fetchCaptcha()
  }, [])

  const handleXiaoyingLogin = () => {
    setXiaoyingLoading(true)
    setXiaoyingError(false)
    
    xiaoyingTimerRef.current = setTimeout(() => {
      setXiaoyingLoading(false)
      setXiaoyingError(true)
    }, 3000)
    
    window.location.href = '/api/auth/xiaoying/start'
  }

  useEffect(() => {
    return () => {
      if (xiaoyingTimerRef.current) {
        clearTimeout(xiaoyingTimerRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (!captchaData) {
      setError('验证码未加载完成')
      setIsLoading(false)
      return
    }

    try {
      const res = await signIn('credentials', {
        username,
        password,
        captchaInput,
        captchaHash: captchaData.hash,
        captchaTimestamp: captchaData.timestamp.toString(),
        redirect: false,
      })

      if (res?.error) {
        setError(res.error)
        fetchCaptcha()
        setIsLoading(false)
      }
      // On success: keep isLoading=true, useEffect will redirect when status=authenticated
    } catch (_err) {
      setError('发生未知错误，请刷新页面后重试')
      fetchCaptcha()
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">欢迎使用EZTor!</CardTitle>
          <CardDescription>
            输入您的账号密码以访问您的个人词汇库。
            <br />
            <span className="text-primary text-xs mt-2 inline-block">
              如果账号不存在，会自动创建。
            </span>
            <br />
            <span className="text-red-500/80 text-xs mt-1 inline-block font-medium">
              ⚠️ 为了保障您的隐私，请不要使用与学校账户相同的密码
            </span>
            <span className="text-amber-500/80 text-xs mt-2 inline-block font-medium">
              ⚠️ 密码无法修改也无法找回，请务必牢记您的密码
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wasKicked && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400 text-center">
              当前服务器资源紧张，监测到您五分钟没有操作，判定为挂机，如需使用请尝试重新登录
            </div>
          )}
          {onlineCount !== null && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400 text-center">
              在线人数过多（当前在线 {onlineCount} 人），服务器资源紧张，请稍后再试
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="captcha">验证码</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="captcha"
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="请输入验证码"
                  required
                  className="flex-1"
                  autoComplete="off"
                />
                {captchaData ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={captchaData.image}
                    alt="验证码"
                    className="h-[50px] w-[150px] border rounded-md cursor-pointer"
                    onClick={fetchCaptcha}
                    title="点击刷新验证码"
                  />
                ) : (
                  <div className="h-[50px] w-[150px] border rounded-md flex items-center justify-center bg-muted">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading || isBlocked}>
              {isBlocked ? '当前不可用' : isLoading ? '登录中...' : '登录 / 注册'}
            </Button>
          </form>

          {showXiaoYingLogin && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">或</span>
                </div>
              </div>

              <div
                onClick={handleXiaoyingLogin}
                className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-neutral-300 bg-white px-5 text-base font-semibold leading-none text-neutral-900 hover:bg-neutral-50 transition-colors dark:border-neutral-200 dark:bg-[#171722] dark:text-neutral-50 dark:hover:bg-[#20202c]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleXiaoyingLogin()
                  }
                }}
              >
                {xiaoyingLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src="/xiaoying-icon.svg" alt="" className="h-6 w-6 shrink-0 dark:brightness-0 dark:invert" />
                )}
                <span>{xiaoyingLoading ? '登录中...' : '使用小应账号快捷登录'}</span>
              </div>

              {xiaoyingError && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-400 text-center">
                  <p className="font-semibold">小应生活版本过低</p>
                  <p className="mt-1">请点击下方按钮更新小应生活后再试</p>
                  <a 
                    href="https://xiaoying.life/download" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-3 inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    下载最新版本
                  </a>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
