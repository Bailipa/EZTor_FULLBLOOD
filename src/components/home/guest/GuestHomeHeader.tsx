'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GuestHomeHeaderProps {
  onStart: () => void
}

const navItems = [
  { label: '产品功能', href: '#features' },
  { label: '使用方式', href: '#workflow' },
  { label: '常见问题', href: '#faq' },
]

export function GuestHomeHeader({ onStart }: GuestHomeHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-8 lg:px-16 xl:px-[72px]">
        <Link href="/" className="flex items-center gap-3 text-slate-950 dark:text-white">
          <span className="flex h-9 w-9 items-center justify-center text-blue-600">
            <BookOpen className="h-8 w-8" />
          </span>
          <span className="text-3xl font-semibold tracking-tight text-[#061534]">EZTor</span>
        </Link>

        <nav className="hidden items-center gap-14 text-lg font-semibold text-[#061534] md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-blue-600"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            className="h-11 px-5 text-base font-semibold text-[#061534] hover:bg-slate-100 hover:text-blue-600"
            onClick={() => router.push('/auth/signin')}
          >
            登录
          </Button>
          <Button
            className="h-12 rounded-lg bg-blue-600 px-7 text-base font-semibold text-white shadow-[0_14px_30px_-18px_rgba(37,99,235,0.85)] hover:bg-blue-700"
            onClick={onStart}
          >
            免费开始
          </Button>
        </div>
      </div>
    </header>
  )
}
