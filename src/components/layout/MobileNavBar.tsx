'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, PenTool, BookOpen, Search } from 'lucide-react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/dictation', label: '默写', icon: PenTool },
  { href: '/history', label: '生词本', icon: BookOpen },
  { href: '/translate', label: '查词', icon: Search },
]

export default function MobileNavBar() {
  const pathname = usePathname()

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive
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
