'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

const KeyboardVisibilityContext = createContext(false)

function isTextEditor(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.matches(
    'textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]):not([type="file"])',
  )
}

export function NativeKeyboardLayoutProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const keyboardOpenRef = useRef(false)

  const closeLayout = useCallback(() => {
    document.documentElement.style.removeProperty('--app-visible-height')
    delete document.documentElement.dataset.keyboardOpen
    keyboardOpenRef.current = false
    setKeyboardOpen(false)
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    const query = window.matchMedia('(max-width: 767px)')
    let frame = 0
    let restingHeight = 0
    let editor: HTMLElement | null = null

    const revealEditor = () => {
      if (!editor?.isConnected || !isTextEditor(editor) || document.activeElement !== editor) return
      const viewportBottom = (window.visualViewport?.height ?? window.innerHeight) + (window.visualViewport?.offsetTop ?? 0)
      for (let parent = editor.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (!/auto|scroll/.test(getComputedStyle(parent).overflowY)) continue
        const bounds = parent.getBoundingClientRect()
        const field = editor.getBoundingClientRect()
        const visibleBottom = Math.min(bounds.bottom, viewportBottom) - 12
        if (field.bottom > visibleBottom) parent.scrollTop += field.bottom - visibleBottom
        else if (field.top < bounds.top + 12) parent.scrollTop -= bounds.top + 12 - field.top
      }
    }

    const update = () => {
      const mobile = query.matches
      const visibleHeight = viewport?.height ?? window.innerHeight
      const editing = !!editor?.isConnected && isTextEditor(editor) && document.activeElement === editor
      if (!restingHeight) restingHeight = Math.max(visibleHeight, window.innerHeight)
      const open = mobile && editing && restingHeight - visibleHeight > 120

      if (!editing && !keyboardOpenRef.current) restingHeight = Math.max(visibleHeight, window.innerHeight)
      if (mobile) document.documentElement.style.setProperty('--app-visible-height', `${Math.max(0, visibleHeight)}px`)
      else document.documentElement.style.removeProperty('--app-visible-height')
      if (open) document.documentElement.dataset.keyboardOpen = 'true'
      else delete document.documentElement.dataset.keyboardOpen
      keyboardOpenRef.current = open
      setKeyboardOpen(open)
      if (open) requestAnimationFrame(revealEditor)
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const rotate = () => { restingHeight = 0; schedule() }
    const focus = (event: FocusEvent) => {
      editor = isTextEditor(event.target) ? event.target : null
      schedule()
    }

    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', rotate)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', schedule)
    query.addEventListener('change', schedule)
    update()

    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', rotate)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', schedule)
      query.removeEventListener('change', schedule)
      document.documentElement.style.removeProperty('--app-visible-height')
      delete document.documentElement.dataset.keyboardOpen
    }
  }, [])

  useEffect(() => { closeLayout() }, [pathname, closeLayout])

  return <KeyboardVisibilityContext.Provider value={keyboardOpen}>{children}</KeyboardVisibilityContext.Provider>
}

export function useKeyboardVisibility() {
  return useContext(KeyboardVisibilityContext)
}
