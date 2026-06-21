'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  fallback?: string
}

export function BackButton({ fallback = '/me' }: BackButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="xl:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
      aria-label="返回"
    >
      <ChevronLeft className="w-5 h-5" />
      <span>返回</span>
    </button>
  )
}