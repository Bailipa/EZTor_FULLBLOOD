'use client'

import { ReactNode } from 'react'
import AppSidebar from './AppSidebar'
import AdminMobileNavBar from './AdminMobileNavBar'
import { BarChart3, MessageSquare, Users, Languages, BookOpen, Database, ExternalLink, Zap } from 'lucide-react'
import type { SidebarNavItem, SidebarBottomItem } from './AppSidebar'

const adminNavItems: SidebarNavItem[] = [
  { href: '/analytics', label: '数据分析', icon: BarChart3 },
  { href: '/admin/gamification', label: '学力管理', icon: Zap },
  { href: '/admin/chat', label: '聊天管理', icon: MessageSquare },
  { href: '/users', label: '用户管理', icon: Users },
  { href: '/translation-records', label: '翻译记录', icon: Languages },
  { href: '/public-words', label: '公共词库', icon: BookOpen },
  { href: '/llm-config', label: 'LLM 配置', icon: Database },
]

const adminBottomItems: SidebarBottomItem[] = [
  {
    label: 'GitHub',
    icon: ExternalLink,
    onClick: () => window.open('https://github.com/Bailipa/EZTor_FULLBLOOD', '_blank', 'noopener,noreferrer'),
  },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppSidebar navItems={adminNavItems} bottomItems={adminBottomItems} showDonation={false} />
      <AdminMobileNavBar />
      <div className="xl:ml-[240px] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] xl:pb-0">
        {children}
      </div>
    </>
  )
}
