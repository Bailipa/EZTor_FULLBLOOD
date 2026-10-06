'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export type EventType =
  | 'PAGE_VIEW'
  | 'TRANSLATE'
  | 'TRANSLATE_ONLY'
  | 'DICTATION_START'
  | 'DICTATION_COMPLETE'
  | 'DICTATION_ERROR'
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'SHARE'
  | 'CTA_CLICK'
  | 'FIRST_ACTION'
  | 'ONBOARDING_COMPLETE'
  | 'ERROR'
  | 'API_ERROR'

const SESSION_KEY = 'analytics_session_id'
const SESSION_EXPIRY = 30 * 60 * 1000 // 30 minutes

function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as { id?: unknown; timestamp?: unknown }
      if (
        typeof parsed.id === 'string' &&
        typeof parsed.timestamp === 'number' &&
        Date.now() - parsed.timestamp < SESSION_EXPIRY
      ) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, timestamp: Date.now() }))
        return parsed.id
      }
    }
  } catch {
    // Storage can be unavailable in private browsing or a restricted webview.
  }

  const newId =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: newId, timestamp: Date.now() }))
  } catch {
    // Tracking still works for this request when storage is unavailable.
  }
  return newId
}

export function getAnalyticsSessionId(): string {
  return getSessionId()
}

export function useAnalytics() {
  const sessionIdRef = useRef<string>('')
  const firstActionRef = useRef(false)

  useEffect(() => {
    sessionIdRef.current = getSessionId()
  }, [])

  const track = useCallback(async (eventType: EventType, metadata?: Record<string, unknown>) => {
    try {
      if (!sessionIdRef.current) sessionIdRef.current = getSessionId()
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionIdRef.current,
        },
        body: JSON.stringify({ eventType, metadata }),
      })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Analytics track error:', error)
    }
  }, [])

  const trackFirstAction = useCallback((action: string) => {
    const sessionId = sessionIdRef.current || getSessionId()
    sessionIdRef.current = sessionId
    const storageKey = sessionId ? `analytics_first_action:${sessionId}` : ''
    if (firstActionRef.current || (storageKey && localStorage.getItem(storageKey))) return
    firstActionRef.current = true
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, '1')
      } catch {
        // The in-memory ref still prevents duplicate events in this mount.
      }
    }
    track('FIRST_ACTION', { action })
  }, [track])

  const trackPageView = useCallback(
    (pageName?: string) => {
      track('PAGE_VIEW', {
        path: window.location.pathname,
        pageName: pageName || document.title,
      })
    },
    [track],
  )

  const trackTranslate = useCallback(
    (wordCount: number, cached: boolean) => {
      track('TRANSLATE', { wordCount, cached })
      trackFirstAction('translate')
    },
    [track, trackFirstAction],
  )

  const trackTranslateOnly = useCallback(
    (charCount: number) => {
      track('TRANSLATE_ONLY', { charCount })
    },
    [track],
  )

  const trackDictationStart = useCallback(
    (wordCount: number, mode: string) => {
      track('DICTATION_START', { wordCount, mode })
      trackFirstAction('dictation')
    },
    [track, trackFirstAction],
  )

  const trackDictationComplete = useCallback(
    (score: number, total: number) => {
      track('DICTATION_COMPLETE', { score, total, percentage: Math.round((score / total) * 100) })
    },
    [track],
  )

  const trackError = useCallback(
    (errorType: string, message: string) => {
      track('ERROR', { errorType, message: message.substring(0, 200) })
    },
    [track],
  )

  const trackShare = useCallback(
    (platform: string, contentType: string) => {
      track('SHARE', { platform, contentType })
    },
    [track],
  )

  return {
    track,
    trackPageView,
    trackTranslate,
    trackTranslateOnly,
    trackDictationStart,
    trackDictationComplete,
    trackFirstAction,
    trackError,
    trackShare,
  }
}

export function usePageView(pageName?: string) {
  const pathname = usePathname()
  const { trackPageView } = useAnalytics()
  const trackedRef = useRef(false)

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true
      trackPageView(pageName)
    }
  }, [pathname, pageName, trackPageView])
}
