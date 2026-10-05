'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useReducedInterfaceMotion } from './useReducedInterfaceMotion'

const editingControls = 'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [data-no-panel-swipe]'

// Deliberately do not wrap at the first/last panel.
export function panelSwipeDestination(index: number, count: number, deltaX: number, deltaY: number) {
  if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return null
  const next = index + (deltaX < 0 ? 1 : -1)
  return next >= 0 && next < count ? next : null
}

export function usePanelSwipe<T extends string>(
  containerRef: RefObject<HTMLElement | null>,
  active: T,
  panels: readonly T[],
  select: (panel: T) => boolean,
  enabled = true,
) {
  const reducedMotion = useReducedInterfaceMotion()
  const latest = useRef({ active, panels, select })
  useLayoutEffect(() => { latest.current = { active, panels, select } }, [active, panels, select])
  const incoming = useRef<number | null>(null)
  const resetMotion = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    resetMotion.current()
    const offset = incoming.current
    incoming.current = null
    if (offset === null || !enabled || reducedMotion || !window.matchMedia('(max-width: 63.999rem)').matches) return
    const panel = containerRef.current?.querySelector<HTMLElement>('[data-panel-swipe-active="true"]')
    if (!panel) return
    panel.style.transition = 'none'
    panel.style.willChange = 'transform, opacity'
    panel.style.transform = `translate3d(${offset}px, 0, 0)`
    panel.style.opacity = '0.82'
    // Give the browser a frame to paint the entry pose without forcing layout.
    let timer = 0
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        panel.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out'
        panel.style.transform = 'translate3d(0, 0, 0)'
        panel.style.opacity = '1'
        timer = window.setTimeout(() => resetMotion.current(), 230)
      })
    })
    resetMotion.current = () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      for (const property of ['transition', 'will-change', 'transform', 'opacity']) panel.style.removeProperty(property)
      resetMotion.current = () => {}
    }
    return () => resetMotion.current()
  }, [active, containerRef, enabled, reducedMotion])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return
    let gesture: { id: number; x: number; y: number; axis: 'pending' | 'horizontal'; panel: HTMLElement; width: number } | null = null
    let frame = 0
    let shift = 0
    const mobile = window.matchMedia('(max-width: 63.999rem)')
    const clearFrame = () => { cancelAnimationFrame(frame); frame = 0 }
    const editing = () => document.documentElement.dataset.keyboardOpen === 'true'
      || document.activeElement?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
      || !!window.getSelection()?.toString()
    const settle = () => {
      const current = gesture
      gesture = null
      clearFrame()
      if (!current || current.axis !== 'horizontal' || reducedMotion) return
      current.panel.style.transition = 'transform 180ms ease-out, opacity 180ms ease-out'
      current.panel.style.transform = 'translate3d(0, 0, 0)'
      current.panel.style.opacity = '1'
      const timer = window.setTimeout(() => resetMotion.current(), 210)
      resetMotion.current = () => {
        window.clearTimeout(timer)
        for (const property of ['transition', 'will-change', 'transform', 'opacity']) current.panel.style.removeProperty(property)
        resetMotion.current = () => {}
      }
    }
    const start = (event: TouchEvent) => {
      settle()
      resetMotion.current()
      const target = event.target
      const touch = event.touches[0]
      if (!mobile.matches || event.touches.length !== 1 || editing() || !(target instanceof Element) || target.closest(editingControls)
        || touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return
      const panel = container.querySelector<HTMLElement>('[data-panel-swipe-active="true"]')
      if (!panel || !panel.contains(target)) return
      // Tables, code blocks and horizontal lists keep their own native scrolling.
      for (let node: Element | null = target; node && node !== panel; node = node.parentElement) {
        if (node.scrollWidth > node.clientWidth + 1 && /^(auto|scroll)$/.test(window.getComputedStyle(node).overflowX)) return
      }
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, axis: 'pending', panel, width: panel.getBoundingClientRect().width }
    }
    const move = (event: TouchEvent) => {
      const current = gesture
      if (!current) return
      if (event.touches.length !== 1 || !mobile.matches || editing()) { settle(); return }
      const touch = Array.from(event.touches).find((item) => item.identifier === current.id)
      if (!touch) { settle(); return }
      const dx = touch.clientX - current.x
      const dy = touch.clientY - current.y
      // A small sideways wobble must not claim a vertical page scroll.
      if (Math.abs(dy) >= 10 && Math.abs(dy) >= Math.abs(dx)) { settle(); return }
      if (current.axis === 'pending') {
        if (Math.abs(dx) < 24 || Math.abs(dx) < Math.abs(dy) * 1.8) return
        current.axis = 'horizontal'
      }
      if (!event.cancelable) { settle(); return }
      event.preventDefault()
      if (reducedMotion) return
      const { active: selected, panels: choices } = latest.current
      const index = choices.indexOf(selected)
      const atBoundary = dx > 0 ? index === 0 : index === choices.length - 1
      shift = Math.max(-current.width * 0.4, Math.min(current.width * 0.4, dx * (atBoundary ? 0.18 : 1)))
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        current.panel.style.transition = 'none'
        current.panel.style.willChange = 'transform, opacity'
        current.panel.style.transform = `translate3d(${shift}px, 0, 0)`
        current.panel.style.opacity = `${1 - Math.min(Math.abs(shift) / current.width * 0.5, 0.2)}`
        resetMotion.current = () => {
          for (const property of ['transition', 'will-change', 'transform', 'opacity']) current.panel.style.removeProperty(property)
          resetMotion.current = () => {}
        }
      })
    }
    const end = (event: TouchEvent) => {
      const current = gesture
      if (!current) return
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === current.id)
      const { active: selected, panels: choices, select: choose } = latest.current
      const destination = touch && current.axis === 'horizontal' && mobile.matches && !editing()
        ? panelSwipeDestination(choices.indexOf(selected), choices.length, touch.clientX - current.x, touch.clientY - current.y)
        : null
      if (destination === null) { settle(); return }
      clearFrame()
      incoming.current = reducedMotion ? null : (touch!.clientX < current.x ? 1 : -1) * Math.min(current.width * 0.22, 80)
      if (!choose(choices[destination])) { incoming.current = null; settle(); return }
      gesture = null
      resetMotion.current()
    }
    const cancel = () => { settle(); incoming.current = null }
    const resize = () => { cancel(); resetMotion.current() }
    container.addEventListener('touchstart', start, { passive: true })
    container.addEventListener('touchmove', move, { passive: false })
    container.addEventListener('touchend', end, { passive: true })
    container.addEventListener('touchcancel', cancel, { passive: true })
    window.addEventListener('resize', resize)
    window.addEventListener('blur', cancel)
    return () => {
      clearFrame()
      resetMotion.current()
      incoming.current = null
      container.removeEventListener('touchstart', start)
      container.removeEventListener('touchmove', move)
      container.removeEventListener('touchend', end)
      container.removeEventListener('touchcancel', cancel)
      window.removeEventListener('resize', resize)
      window.removeEventListener('blur', cancel)
    }
  }, [containerRef, enabled, reducedMotion])
}
