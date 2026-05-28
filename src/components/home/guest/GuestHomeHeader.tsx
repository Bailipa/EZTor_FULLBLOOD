'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { label: '使用方式', href: '#workflow' },
]

export function GuestHomeHeader() {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-accent/50 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-4 px-4 lg:px-16 xl:px-[72px]">
        <Link href="/" className="flex items-center gap-2 text-slate-950 dark:text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-foreground">EZTor</span>
        </Link>

        <nav className="hidden items-center gap-10 text-[15px] font-semibold text-foreground md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            className="h-10 px-4 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-primary"
            onClick={() => router.push('/auth/signin')}
          >
            登录
          </Button>
          <Button
            className="inline-flex h-10 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md hover:brightness-90"
            onClick={() => window.location.href = '/flywheel-preview.html'}
          >
            查看介绍
          </Button>
        </div>
      </div>
    </header>
  )
}
