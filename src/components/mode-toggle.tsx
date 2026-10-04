'use client'

import * as React from 'react'
import { Moon, PaintBucket, Sun } from 'lucide-react'
import { useTheme } from '@wrksz/themes/client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBrandTheme } from '@/components/brand-theme-provider'
import { cn } from '@/lib/utils'

const appearanceOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: null },
] as const

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const { brandTheme, setBrandTheme } = useBrandTheme()

  const isBranded = brandTheme !== 'neutral'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn('relative shrink-0 h-11 w-11', isBranded && 'border-primary text-primary')}>
          <Sun className="h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 sm:h-[1.2rem] sm:w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={theme ?? 'system'}
          onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}
        >
          {appearanceOptions.map((opt) => {
            const Icon = opt.icon
            return (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {Icon ? <Icon className="mr-2 h-4 w-4" /> : <span className="mr-2 flex h-4 w-4 items-center justify-center text-xs">💻</span>}
                {opt.label}
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuRadioGroup
          value={brandTheme}
          onValueChange={(v) => setBrandTheme(v as 'neutral' | 'purple' | 'gold' | 'indigo')}
        >
          <DropdownMenuRadioItem value="neutral">
            <span className="mr-2 flex h-4 w-4 items-center justify-center">
              <span className="h-3 w-3 rounded-full border border-current" />
            </span>
            默认
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="purple">
            <PaintBucket className="mr-2 h-4 w-4" />
            紫色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="gold">
            <span className="mr-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-amber-950">金</span>
            辉金
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="indigo">
            <span className="mr-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#3048e8] text-[9px] font-bold text-white">靛</span>
            靛辉
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
