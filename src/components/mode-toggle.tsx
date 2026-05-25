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

  const isPurple = brandTheme === 'purple'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn('shrink-0 h-8 w-8 sm:h-9 sm:w-9', isPurple && 'border-primary text-primary')}>
          <Sun className="h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-3.5 w-3.5 sm:h-[1.2rem] sm:w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
          onValueChange={(v) => setBrandTheme(v as 'neutral' | 'purple')}
        >
          <DropdownMenuRadioItem value="neutral">
            <span className="mr-2 flex h-4 w-4 items-center justify-center">
              <span className="h-3 w-3 rounded-full border border-current" />
            </span>
            Default
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="purple">
            <PaintBucket className="mr-2 h-4 w-4" />
            Purple
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
