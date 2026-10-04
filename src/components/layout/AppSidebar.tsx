'use client'

import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Home, PenTool, BookOpen, MessageCircle, LogOut, ExternalLink, Trophy, Download, Sparkles, Database, AlertCircle, Settings2 } from 'lucide-react'
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
import styles from '@/components/ai/translation-workspace.module.css'
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
  { href: '/ai', label: '翻译', icon: Sparkles, requiresAuth: false },
  { href: '/dictation', label: '默写复习', icon: PenTool, requiresAuth: true },
  { href: '/mistakes', label: '错词本', icon: AlertCircle, requiresAuth: true },
  { href: '/history', label: '生词本', icon: BookOpen, requiresAuth: true },
  { href: '/public-vocabulary', label: '公共词库', icon: Database, requiresAuth: false },
  { href: '/leaderboard', label: '排行榜', icon: Trophy, requiresAuth: true },
  { href: '/me', label: '设置', icon: Settings2, requiresAuth: false },
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
    <aside className={`${styles.sidebar} hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:bottom-0 md:w-[72px] xl:w-[208px] bg-sidebar border-r border-sidebar-border z-30`}>
      <div className={`${styles.sidebarBrand} flex items-center justify-center xl:justify-start gap-3 px-2 xl:px-6 shrink-0`}>
        <img src="/favicon.ico" alt="EZTor" className="w-8 h-8 rounded-lg" />
        <span className="hidden xl:inline font-semibold text-sidebar-foreground text-base">
          EZTor
        </span>
      </div>

      <ScrollArea className={`${styles.sidebarScroll} flex-1 px-1 xl:px-3`}>
        <nav className="space-y-1" aria-label="主导航">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href === '/ai' && pathname === '/chat') || (item.href === '/public-vocabulary' && pathname === '/contributions') || (item.href === '/leaderboard' && pathname.startsWith('/leaderboard/'))
            const isLocked = item.requiresAuth && status === 'unauthenticated'
            const label = item.href === '/download' ? downloadLabel : item.label

            const handleClick = (e: React.MouseEvent) => {
              if (isLocked) {
                e.preventDefault()
                router.push('/auth/signin')
              }
            }

            return (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                className={`${styles.sidebarLink} flex w-full justify-center xl:justify-start gap-3 h-10 rounded-md px-1 xl:px-3 text-sm ${isActive ? 'bg-primary/8 font-medium text-primary hover:bg-primary/12 hover:text-primary' : 'text-sidebar-foreground/70'} ${isLocked ? 'opacity-70' : ''} ${!navItems && ['/dictation', '/public-vocabulary', '/me'].includes(item.href) ? styles.sidebarGroupStart : ''}`}
              >
                <Link href={item.href} onClick={handleClick} aria-label={label} title={label} aria-current={isActive ? 'page' : undefined}>
                  <Icon className="size-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.7} />
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              </Button>
            )
          })}
        </nav>
      </ScrollArea>

      <div className={`${styles.sidebarFooter} px-1 xl:px-3 py-3 border-t border-sidebar-border space-y-1 shrink-0`}>
        <div className="flex items-center justify-center xl:justify-start gap-1 px-1 xl:px-3 pb-1">
          <ModeToggle />
          {isAuthenticated && showDonation && <span className="hidden xl:inline-flex"><DonationButton /></span>}
        </div>
        {bottoms.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.label}
              variant="ghost"
              aria-label={item.label}
              title={item.label}
              className={`w-full justify-center xl:justify-start gap-3 h-10 px-1 xl:px-3 text-sm ${
                item.variant === 'destructive'
                  ? 'text-destructive/70 hover:text-destructive'
                  : 'text-sidebar-foreground/70'
              }`}
              onClick={item.onClick}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline">{item.label}</span>
            </Button>
          )
        })}

        {!isAuthenticated && (
          <Button
            variant="outline"
            aria-label="登录"
            title="登录"
            className="w-full justify-center xl:justify-start gap-3 h-10 px-1 xl:px-3 text-sm"
            onClick={() => router.push('/auth/signin')}
          >
            <LogOut className="w-4 h-4 shrink-0 rotate-180" />
            <span className="hidden xl:inline">登录</span>
          </Button>
        )}

        {isAuthenticated && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              aria-label="退出"
              title="退出"
              className="w-full justify-center xl:justify-start gap-3 h-10 px-1 xl:px-3 text-sm text-destructive/70 hover:text-destructive"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline">退出</span>
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
