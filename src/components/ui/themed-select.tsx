'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type ThemedSelectProps = Pick<ComponentProps<typeof Select>,
  'value' | 'defaultValue' | 'onValueChange' | 'disabled' | 'name' | 'required'
> & Pick<ComponentProps<typeof SelectTrigger>, 'id' | 'aria-label' | 'aria-labelledby'> & {
  children: ReactNode
  className?: string
}

/** Shared themed dropdown; Radix preserves keyboard navigation and form values. */
export function ThemedSelect({ children, className, id, 'aria-label': label, 'aria-labelledby': labelledBy, ...props }: ThemedSelectProps) {
  return (
    <Select {...props}>
      <SelectTrigger id={id} aria-label={label} aria-labelledby={labelledBy} className={cn('min-w-0 bg-background text-foreground', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-w-[calc(100vw-2rem)]">
        {children}
      </SelectContent>
    </Select>
  )
}

export { SelectItem }
