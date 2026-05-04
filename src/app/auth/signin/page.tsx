'use client'

import { signIn, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RefreshCw } from 'lucide-react'

export default function SignIn() {
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background p-4">
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
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录 / 注册'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
