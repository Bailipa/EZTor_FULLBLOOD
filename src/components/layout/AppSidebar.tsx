'use client'

import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Home, PenTool, BookOpen, MessageCircle, LogOut, ExternalLink } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { DonationButton } from '@/components/home/DonationModal'
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

export default function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const qqGroupUrl = useQQGroupUrl()

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/dictation', label: '默写复习', icon: PenTool },
    { href: '/history', label: '生词本', icon: BookOpen },
  ]

  const bottomItems = [
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
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3 h-10 px-3 text-sm"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1 shrink-0">
        <div className="flex items-center gap-1 px-3 pb-1">
          <ModeToggle />
          <DonationButton />
        </div>
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.label}
              variant="ghost"
              className="w-full justify-start gap-3 h-10 px-3 text-sm text-sidebar-foreground/70"
              onClick={item.onClick}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Button>
          )
        })}

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
      </div>
    </aside>
  )
}
