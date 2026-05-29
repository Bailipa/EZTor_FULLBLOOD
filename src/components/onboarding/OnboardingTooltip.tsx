'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface OnboardingTooltipProps {
  targetRef: React.RefObject<HTMLElement | null>
  title: string
  description: string
  onNext?: () => void
  onSkip?: () => void
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function OnboardingTooltip({
  targetRef,
  title,
  description,
  onNext,
  onSkip,
  position = 'bottom',
}: OnboardingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    const updatePosition = () => {
      if (!targetRef.current || !tooltipRef.current) return

      const targetRect = targetRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = targetRect.top - tooltipRect.height - 8
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
          break
        case 'bottom':
          top = targetRect.bottom + 8
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
          break
        case 'left':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
          left = targetRect.left - tooltipRect.width - 8
          break
        case 'right':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
          left = targetRect.right + 8
          break
      }

      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [targetRef, position])

  return (
    <div
      ref={tooltipRef}
      style={tooltipStyle}
      className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-[280px]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      {onNext && (
        <Button size="sm" onClick={onNext} className="w-full">
          下一步
        </Button>
      )}
    </div>
  )
}
