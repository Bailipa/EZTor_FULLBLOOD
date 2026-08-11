'use client'

import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Home, PenTool, BookOpen, MessageCircle, LogOut, ExternalLink, Trophy, Download, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { DonationButton } from '@/components/home/DonationModal'
import { useAppVersion } from '@/hooks/useAppVersion'
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
import { useQQGroupUrl } from '@/lib/siteConfig'

export interface SidebarNavItem {
  href: string
  label: string
  icon: LucideIcon
  requiresAuth?: boolean
}

export interface SidebarBottomItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface AppSidebarProps {
  navItems?: SidebarNavItem[]
  bottomItems?: SidebarBottomItem[]
  showDonation?: boolean
}

const DEFAULT_NAV_ITEMS: SidebarNavItem[] = [
  { href: '/', label: '首页', icon: Home, requiresAuth: false },
  { href: '/ai', label: 'AI询问', icon: Sparkles, requiresAuth: true },
  { href: '/dictation', label: '默写复习', icon: PenTool, requiresAuth: true },
  { href: '/history', label: '生词本', icon: BookOpen, requiresAuth: true },
  { href: '/leaderboard', label: '排行榜', icon: Trophy, requiresAuth: true },
  { href: '/download', label: '下载应用', icon: Download, requiresAuth: false },
]

export default function AppSidebar({ navItems, bottomItems, showDonation = true }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const qqGroupUrl = useQQGroupUrl()
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user
  const appVer = useAppVersion()

  const items = navItems ?? DEFAULT_NAV_ITEMS

  // 下载/更新项：浏览器恒显示"下载应用"；应用内仅确知有更新时显示"更新软件"，加载中/已最新均隐藏
  const isApp = appVer.mounted && appVer.isApp
  const downloadLabel = isApp ? '更新软件' : '下载应用'

  const visibleItems = items.filter((item) => {
    if (item.href !== '/download') return true
    if (!isApp) return true
    return appVer.hasUpdate === true
  })

  const defaultBottomItems: SidebarBottomItem[] = [
    {
      label: '反馈',
      icon: MessageCircle,
      onClick: () => window.open(qqGroupUrl, '_blank', 'noopener,noreferrer'),
    },
    {
      label: 'GitHub',
      icon: ExternalLink,
      onClick: () => window.open('https://github.com/Bailipa/EZTor_FULLBLOOD', '_blank', 'noopener,noreferrer'),
    },
  ]

  const bottoms = bottomItems ?? defaultBottomItems

  return (
    <aside className="hidden xl:flex xl:flex-col xl:fixed xl:left-0 xl:top-0 xl:w-[240px] xl:h-screen bg-sidebar border-r border-sidebar-border z-30">
      <div className="flex items-center gap-3 px-6 h-14 border-b border-sidebar-border shrink-0">
        <img src="/favicon.ico" alt="EZTor" className="w-8 h-8 rounded-lg" />
        <span className="font-semibold text-sidebar-foreground text-base">
          EZTor
        </span>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const isLocked = item.requiresAuth && !isAuthenticated
            const label = item.href === '/download' ? downloadLabel : item.label

            const handleClick = (e: React.MouseEvent) => {
              if (isLocked) {
                e.preventDefault()
                router.push('/auth/signin')
              }
            }

            return (
              <Link key={item.href} href={item.href} onClick={handleClick}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={`w-full justify-start gap-3 h-10 px-3 text-sm ${isLocked ? 'opacity-50' : ''}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1 shrink-0">
        <div className="flex items-center gap-1 px-3 pb-1">
          <ModeToggle />
          {isAuthenticated && showDonation && <DonationButton />}
        </div>
        {bottoms.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.label}
              variant="ghost"
              className={`w-full justify-start gap-3 h-10 px-3 text-sm ${
                item.variant === 'destructive'
                  ? 'text-destructive/70 hover:text-destructive'
                  : 'text-sidebar-foreground/70'
              }`}
              onClick={item.onClick}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Button>
          )
        })}

        {!isAuthenticated && (
          <Button
            variant="default"
            className="w-full justify-start gap-3 h-10 px-3 text-sm"
            onClick={() => router.push('/auth/signin')}
          >
            <LogOut className="w-4 h-4 shrink-0 rotate-180" />
            <span>登录</span>
          </Button>
        )}

        {isAuthenticated && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 px-3 text-sm text-destructive/70 hover:text-destructive"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>退出</span>
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
                  router.push('/')
                }}
              >
                确认退出
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        )}
      </div>
    </aside>
  )
}
