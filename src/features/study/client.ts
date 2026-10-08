'use client'

import { useEffect, useRef } from 'react'

export class StudyRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}
export async function studyRequest<T>(accountId: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Study-Account': accountId, ...options.headers } })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) throw new StudyRequestError(result?.error || '暂时无法连接，请重试', response.status)
  if (result.accountId !== accountId) throw new StudyRequestError('账号已变化，请重新打开学习页面', 409)
  return result.data as T
}

// Event-driven clock: hidden tabs and unfocused windows do not accrue study time.
export function useStudyClock(enabled: boolean) {
  const clock = useRef({ elapsed: 0, since: null as number | null })
  const take = () => {
    const current = clock.current
    const now = performance.now()
    const elapsed = Math.min(900000, Math.round(current.elapsed + (current.since === null ? 0 : now - current.since)))
    current.elapsed = 0
    if (current.since !== null) current.since = now
    return elapsed
  }
  useEffect(() => {
    const current = clock.current
    const update = () => {
      const now = performance.now()
      if (current.since !== null) current.elapsed += now - current.since
      current.since = enabled && document.visibilityState === 'visible' && document.hasFocus() ? now : null
    }
    update()
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      update()
      current.since = null
    }
  }, [enabled])
  return take
}
