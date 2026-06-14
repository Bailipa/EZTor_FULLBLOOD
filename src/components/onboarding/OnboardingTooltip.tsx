'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface OnboardingTooltipProps {
  targetRef: React.RefObject<HTMLElement | null>
  title: string
  description: string
  onNext?: () => void
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  showArrow?: boolean
}

export function OnboardingTooltip({
  targetRef,
  title,
  description,
  onNext,
  position = 'bottom',
  showArrow = true,
}: OnboardingTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    const updatePosition = () => {
      if (!targetRef.current || !tooltipRef.current) return

      const targetRect = targetRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()

      let top = 0
      let left = 0
      let arrowTop = 0
      let arrowLeft = 0

      const padding = 8

      switch (position) {
        case 'top':
          top = targetRect.top - tooltipRect.height - 12
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
          arrowTop = tooltipRect.height
          arrowLeft = tooltipRect.width / 2 - 8
          break
        case 'bottom':
          top = targetRect.bottom + 12
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
          arrowTop = -12
          arrowLeft = tooltipRect.width / 2 - 8
          break
        case 'left':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
          left = targetRect.left - tooltipRect.width - 12
          arrowTop = tooltipRect.height / 2 - 8
          arrowLeft = tooltipRect.width
          break
        case 'right':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
          left = targetRect.right + 12
          arrowTop = tooltipRect.height / 2 - 8
          arrowLeft = -12
          break
        case 'center':
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2
          break
      }

      // 边界检查：防止溢出屏幕
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding))
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding))

      setTooltipStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
      })

      setArrowStyle({
        position: 'absolute',
        top: `${arrowTop}px`,
        left: `${arrowLeft}px`,
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

  const renderArrow = () => {
    if (!showArrow) return null

    const arrowClasses = {
      top: 'w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-card',
      bottom: 'w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-card',
      left: 'w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-card',
      right: 'w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-card',
      center: '', // center 位置不需要箭头
    }

    return (
      <div style={arrowStyle} className={arrowClasses[position]} />
    )
  }

  return (
    <div
      ref={tooltipRef}
      style={tooltipStyle}
      className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-[240px] sm:max-w-[280px]"
    >
      {renderArrow()}
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      {onNext && (
        <Button size="sm" onClick={onNext} className="w-full">
          知道了
        </Button>
      )}
    </div>
  )
}
