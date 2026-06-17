'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { BarChart3, MessageSquare, Users, Languages, BookOpen, Database, Zap } from 'lucide-react'
import type { SidebarNavItem } from './AppSidebar'

const adminNavItems: SidebarNavItem[] = [
  { href: '/analytics', label: '数据', icon: BarChart3 },
  { href: '/admin/gamification', label: '学力', icon: Zap },
  { href: '/admin/chat', label: '聊天', icon: MessageSquare },
  { href: '/users', label: '用户', icon: Users },
  { href: '/translation-records', label: '翻译', icon: Languages },
  { href: '/public-words', label: '词库', icon: BookOpen },
  { href: '/llm-config', label: 'LLM', icon: Database },
]

export default function AdminMobileNavBar() {
  const pathname = usePathname()

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          const isActiveTab = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActiveTab
                  ? 'text-primary'
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
