'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { isInterfaceStyle, type InterfaceStyle } from '@/lib/interfaceStyle'
import { commitUserPreferences, readUserPreferences, subscribeUserPreferences } from '@/lib/userPreferences'

import { DEFAULT_MINIMAL_FEATURES, equalMinimalFeatures, isMinimalFeatures, minimalMainFeature, type MinimalFeatures } from '@/lib/minimalFeatures'

const CACHE_KEY = 'eztor-interface-style'

type StyleContext = {
  minimalFeatures: MinimalFeatures
  selectMinimalFeatures: (features: MinimalFeatures) => Promise<void>
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
  const [minimalFeatures, setMinimalFeatures] = useState<MinimalFeatures>(DEFAULT_MINIMAL_FEATURES)
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
    let cachedFeatures = DEFAULT_MINIMAL_FEATURES
    try {
      const value = JSON.parse(localStorage.getItem(`${key}:features`) ?? 'null')
      if (isMinimalFeatures(value)) cachedFeatures = value
    } catch { /* Use the focus preset for a first visit. */ }
    setMinimalFeatures(cachedFeatures)
    setStyle(cached)
    applyStyle(cached)
    setError(null)
    setSaving(false)
    setReady(!userId)
    if (!userId) return

    const controller = new AbortController()
    const apply = (data: Awaited<ReturnType<typeof readUserPreferences>>) => {
      if (controller.signal.aborted) return
      if (!isInterfaceStyle(data.interfaceStyle)) throw new Error('invalid preference')
      const features = isMinimalFeatures(data.minimalFeatures) ? data.minimalFeatures : DEFAULT_MINIMAL_FEATURES
      setMinimalFeatures(features)
      setStyle(data.interfaceStyle)
      applyStyle(data.interfaceStyle)
      try {
        localStorage.setItem(key, data.interfaceStyle)
        localStorage.setItem(`${key}:features`, JSON.stringify(features))
      } catch {
        /* Cache is optional. */
      }
      setReady(true)
      setError(null)
    }
    const unsubscribe = subscribeUserPreferences(userId, ['interfaceStyle', 'minimalFeatures'], apply)
    readUserPreferences(userId, controller.signal).then(apply)
      .catch(() => {
        if (!controller.signal.aborted) {
          setReady(true)
          setError('界面设置读取失败，暂用此账号缓存设置，请重试。')
        }
      })
    return () => {
      unsubscribe()
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
          headers: { 'Content-Type': 'application/json', 'X-Preferences-Account': userId },
          body: JSON.stringify({ interfaceStyle: next }),
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok || !result.success || result.accountId !== userId || result.data?.interfaceStyle !== next)
          throw new Error('save failed')
        if (scope.current !== key || controller.signal.aborted) return
        commitUserPreferences(userId, result.data)
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

  const selectMinimalFeatures = useCallback(async (next: MinimalFeatures) => {
    if (!ready || saving || activeRequest.current || !isMinimalFeatures(next)) return
    const key = scope.current
    const previous = minimalFeatures
    setError(null)
    setMinimalFeatures(next)
    if (!userId) {
      try { localStorage.setItem(`${key}:features`, JSON.stringify(next)) }
      catch { setError('浏览器未允许保存设置，本次选择仍然有效。') }
      return
    }
    const controller = new AbortController()
    activeRequest.current = controller
    setSaving(true)
    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Preferences-Account': userId },
        body: JSON.stringify({ minimalFeatures: next }), signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok || !result.success || result.accountId !== userId || !equalMinimalFeatures(result.data?.minimalFeatures, next)) throw new Error('save failed')
      if (scope.current !== key || controller.signal.aborted) return
      commitUserPreferences(userId, result.data)
    } catch {
      if (scope.current !== key || controller.signal.aborted) return
      setMinimalFeatures(previous)
      setError('保存失败，已恢复原功能设置。请重试。')
    } finally {
      if (activeRequest.current === controller) { activeRequest.current = null; setSaving(false) }
    }
  }, [ready, saving, minimalFeatures, userId])

  return (
    <InterfaceStyleContext.Provider
      value={{
        style,
        minimalFeatures,
        selectMinimalFeatures,
        ready: ready && status !== 'loading' && scope.current === `${CACHE_KEY}:${userId ?? 'guest'}`,
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

export function useMinimalFeatures() {
  const { style, minimalFeatures, ready } = useInterfaceStyle()
  const minimal = style === 'minimal'
  return {
    minimal, ready,
    visible: (group: keyof MinimalFeatures, id: string) => !minimal || minimalFeatures[group].includes(id),
    mainVisible: (href: string) => !minimal || !minimalMainFeature(href) || minimalFeatures.main.includes(minimalMainFeature(href)!),
  }
}
