'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, PenTool, BookOpen, Search, MessageSquare, Trophy } from 'lucide-react'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { OnboardingTooltip } from '@/components/onboarding/OnboardingTooltip'
import { useRef } from 'react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/dictation', label: '默写', icon: PenTool },
  { href: '/history', label: '生词本', icon: BookOpen },
  { href: '/translate', label: '查词', icon: Search },
  { href: '/leaderboard', label: '排行榜', icon: Trophy },
  { href: '/chat', label: '说话', icon: MessageSquare },
]

export default function MobileNavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentStep, isActive } = useOnboarding()
  const chatButtonRef = useRef<HTMLAnchorElement>(null)

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActiveTab = pathname === item.href
          const isChatButton = item.href === '/chat'
          const shouldHighlight = isActive && currentStep === 5 && isChatButton

          return (
            <Link
              key={item.href}
              href={item.href}
              ref={isChatButton ? chatButtonRef : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                shouldHighlight
                  ? 'text-primary animate-pulse'
                  : isActiveTab
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {shouldHighlight && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>

      {/* 引导步骤 5：Chat 功能介绍 */}
      {isActive && currentStep === 5 && (
        <OnboardingTooltip
          targetRef={chatButtonRef}
          title="💬 说话聊天"
          description="有问题或建议？点击这里与开发者交流。"
          onNext={() => {
            router.push('/chat')
          }}
          position="top"
        />
      )}
    </nav>
  )
}
