'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, PenTool, Sparkles, User } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface NavItem {
  href: string
  label: string
  icon: typeof Home
  requiresAuth: boolean
}

const navItems: NavItem[] = [
  { href: '/', label: '首页', icon: Home, requiresAuth: false },
  { href: '/dictation', label: '默写', icon: PenTool, requiresAuth: true },
  { href: '/ai', label: 'AI', icon: Sparkles, requiresAuth: true },
  { href: '/me', label: '我的', icon: User, requiresAuth: false },
]

export default function MobileNavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated' && session?.user

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      e.preventDefault()
      router.push('/auth/signin')
    }
  }

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActiveTab =
            item.href === '/me'
              ? pathname === '/me' || pathname === '/leaderboard' || pathname === '/chat'
              : pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActiveTab
                  ? 'text-primary'
                  : item.requiresAuth && !isAuthenticated
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
