'use client'

import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { FlashcardWidget } from '@/components/ui/flashcard/flashcard-widget'
import { GameWidget } from '@/components/ui/game/GameWidget'
import { SharePoster } from '@/components/share'
import { useState, useEffect } from 'react'
import { Share2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { MonitorPlay, PenTool, BookOpen, LogIn } from 'lucide-react'
import { DonationButton } from './DonationModal'

interface HomeHeaderProps {
  showDanmaku: boolean
  onToggleDanmaku: () => void
  onFeatureClick?: (featureName: string) => void
}

export function HomeHeader({ showDanmaku, onToggleDanmaku, onFeatureClick }: HomeHeaderProps) {
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const [shareOpen, setShareOpen] = useState(false)
  const [githubDialogOpen, setGithubDialogOpen] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const handleFeatureClick = (featureName: string, callback?: () => void) => {
    if (!isAuthenticated && onFeatureClick) {
      onFeatureClick(featureName)
    } else if (callback) {
      callback()
    }
  }

  const handleGithubClick = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      await fetch('https://github.com', { mode: 'no-cors', signal: controller.signal })
      clearTimeout(timeoutId)
      window.open('https://github.com/Bailipa/EZTor_FULLBLOOD', '_blank', 'noopener,noreferrer')
    } catch {
      setCountdown(5)
      setGithubDialogOpen(true)
    }
  }

  useEffect(() => {
    if (!githubDialogOpen) return
    if (countdown === 0) {
      setGithubDialogOpen(false)
      window.location.href = `${window.location.origin}/`
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [githubDialogOpen, countdown])

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border transition-colors duration-300">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground">EZTor</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-muted-foreground">
          An Easier Translator.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400" role="alert">
          提示：翻译内容由 AI 大模型生成，请仔细甄别。
        </p>
      </div>
      <nav className="flex flex-wrap items-center gap-2 sm:gap-3" aria-label="主导航">
        {session?.user && (
          <span className="text-xs sm:text-sm text-muted-foreground w-full sm:w-auto sm:mr-2 mb-1 sm:mb-0">
            Hello, {session.user.name}
          </span>
        )}
        {isAuthenticated && <FlashcardWidget />}
        {isAuthenticated && <GameWidget />}
        <Button
          variant={showDanmaku ? 'default' : 'outline'}
          onClick={() => handleFeatureClick('弹幕复习', onToggleDanmaku)}
          className="gap-1.5 sm:gap-2 shadow-sm transition-all h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
          aria-label={showDanmaku ? '关闭弹幕复习' : '开启弹幕复习'}
          aria-pressed={showDanmaku}
        >
          <MonitorPlay className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
          <span>{showDanmaku ? '关闭弹幕复习' : '开启弹幕复习'}</span>
        </Button>
        {isAuthenticated ? (
          <>
            <Link href="/dictation" aria-label="前往默写复习页面">
              <Button
                variant="outline"
                className="gap-1.5 sm:gap-2 shadow-sm border-primary/20 text-primary hover:bg-primary/5 h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              >
                <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                <span>默写复习</span>
              </Button>
            </Link>
            <Link href="/history" aria-label="前往生词本页面">
              <Button
                variant="outline"
                className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
                <span>生词本</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => setShareOpen(true)}
              className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              aria-label="分享"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span>分享</span>
            </Button>
          </>
        ) : (
          <Link href="/auth/signin" aria-label="前往登录页面">
            <Button
              variant="default"
              className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span>登录</span>
            </Button>
          </Link>
        )}
        <ModeToggle />
        <Button
          variant="outline"
          size="icon"
          className="shadow-sm shrink-0 h-8 w-8 sm:h-9 sm:w-9"
          aria-label="GitHub"
          onClick={handleGithubClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5 sm:w-4 sm:h-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.285 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0Z" />
          </svg>
        </Button>
        <AlertDialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>无法打开 GitHub 喵</AlertDialogTitle>
              <AlertDialogDescription>
                你无法打开GitHub喵，这不是你的错喵，{countdown}秒后返回eztor喵
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setGithubDialogOpen(false)}>
                关闭
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setGithubDialogOpen(false)
                  window.location.href = `${window.location.origin}/`
                }}
              >
                返回首页
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <DonationButton />
        {isAuthenticated && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shadow-sm shrink-0 h-8 w-8 sm:h-9 sm:w-9"
                aria-label="退出登录"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                <AlertDialogDescription>
                  退出后您需要重新输入账号密码才能访问您的生词本。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await signOut({ redirect: false })
                    if (typeof window !== 'undefined') {
                      window.location.href = `${window.location.origin}/`
                    }
                  }}
                >
                  确认退出
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <SharePoster open={shareOpen} onOpenChange={setShareOpen} />
      </nav>
    </header>
  )
}
