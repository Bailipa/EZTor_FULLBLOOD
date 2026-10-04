'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { isInterfaceStyle, type InterfaceStyle } from '@/lib/interfaceStyle'

const CACHE_KEY = 'eztor-interface-style'

type StyleContext = {
  style: InterfaceStyle
  ready: boolean
  saving: boolean
  error: string | null
  selectStyle: (style: InterfaceStyle) => Promise<void>
  retry: () => void
}

const InterfaceStyleContext = createContext<StyleContext | null>(null)

function applyStyle(style: InterfaceStyle) {
  document.documentElement.setAttribute('data-ui-style', style)
  try {
    localStorage.setItem(CACHE_KEY, style)
  } catch {
    /* The current page still works without storage. */
  }
}

function readStyle(key: string): InterfaceStyle {
  try {
    const value = localStorage.getItem(key)
    return isInterfaceStyle(value) ? value : 'reading'
  } catch {
    return 'reading'
  }
}

export function InterfaceStyleProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const [style, setStyle] = useState<InterfaceStyle>('reading')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const activeRequest = useRef<AbortController | null>(null)
  const scope = useRef('')

  useEffect(() => {
    if (status === 'loading') return
    const key = `${CACHE_KEY}:${userId ?? 'guest'}`
    scope.current = key
    const cached = readStyle(key)
    setStyle(cached)
    applyStyle(cached)
    setError(null)
    setSaving(false)
    setReady(!userId)
    if (!userId) return

    const controller = new AbortController()
    fetch('/api/preferences', { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        if (controller.signal.aborted) return
        if (!result.success || !isInterfaceStyle(result.data?.interfaceStyle))
          throw new Error('invalid preference')
        setStyle(result.data.interfaceStyle)
        applyStyle(result.data.interfaceStyle)
        try {
          localStorage.setItem(key, result.data.interfaceStyle)
        } catch {
          /* Cache is optional. */
        }
        setReady(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('界面设置读取失败，请重试。')
      })
    return () => {
      controller.abort()
      activeRequest.current?.abort()
    }
  }, [status, userId, attempt])

  const selectStyle = useCallback(
    async (next: InterfaceStyle) => {
      if (!ready || saving || activeRequest.current || !isInterfaceStyle(next)) return
      const key = scope.current
      const previous = style
      setError(null)
      setStyle(next)
      applyStyle(next)
      if (!userId) {
        try {
          localStorage.setItem(key, next)
        } catch {
          setError('浏览器未允许保存设置，本次切换仍然有效。')
        }
        return
      }
      // Keep a single in-flight write so rapid selections cannot finish out of order.
      const controller = new AbortController()
      activeRequest.current = controller
      setSaving(true)
      try {
        const response = await fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interfaceStyle: next }),
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok || !result.success || result.data?.interfaceStyle !== next)
          throw new Error('save failed')
        if (scope.current !== key || controller.signal.aborted) return
        try {
          localStorage.setItem(key, next)
        } catch {
          /* The account value is already saved. */
        }
      } catch {
        if (scope.current !== key || controller.signal.aborted) return
        setStyle(previous)
        applyStyle(previous)
        setError('保存失败，已恢复原风格。请重试。')
      } finally {
        if (activeRequest.current === controller) {
          activeRequest.current = null
          setSaving(false)
        }
      }
    },
    [ready, saving, style, userId],
  )

  return (
    <InterfaceStyleContext.Provider
      value={{
        style,
        ready,
        saving,
        error,
        selectStyle,
        retry: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </InterfaceStyleContext.Provider>
  )
}

export function useInterfaceStyle() {
  const context = useContext(InterfaceStyleContext)
  if (!context) throw new Error('InterfaceStyleProvider is missing')
  return context
}
