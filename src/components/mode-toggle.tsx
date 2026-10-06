'use client'

import * as React from 'react'
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
import {
  DarkThemeIcon,
  GoldThemeIcon,
  IndigoThemeIcon,
  LightThemeIcon,
  PurpleThemeIcon,
  SystemThemeIcon,
} from '@/components/icons/MinimalThemeIcons'
import { cn } from '@/lib/utils'

const appearanceOptions = [
  { value: 'light', label: 'Light', icon: LightThemeIcon },
  { value: 'dark', label: 'Dark', icon: DarkThemeIcon },
  { value: 'system', label: 'System', icon: SystemThemeIcon },
] as const

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const { brandTheme, setBrandTheme } = useBrandTheme()

  const isBranded = brandTheme !== 'neutral'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn('relative shrink-0 h-11 w-11', isBranded && 'border-primary text-primary')}>
          <LightThemeIcon className="size-4 sm:size-5 dark:hidden" />
          <DarkThemeIcon className="hidden size-4 sm:size-5 dark:block" />
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
                <Icon className="mr-2 h-4 w-4" />
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
          <DropdownMenuRadioItem value="purple">
            <PurpleThemeIcon className="mr-2 h-4 w-4" />
            紫色
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="gold">
            <GoldThemeIcon className="mr-2 h-4 w-4" />
            辉金
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="indigo">
            <IndigoThemeIcon className="mr-2 h-4 w-4" />
            靛辉（默认）
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
