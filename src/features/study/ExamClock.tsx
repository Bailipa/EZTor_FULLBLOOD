'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type ClockValue = { remaining: number | null; elapsed: number }
type ExamClockProps = {
  children: ReactNode
  deadline: number | null
  stageStartedAt: number
  serverOffset: number
  expiryKey: string
  onExpire: () => void
}

const ClockContext = createContext<ClockValue | null>(null)

export function ExamClock({ children, deadline, stageStartedAt, serverOffset, expiryKey, onExpire }: ExamClockProps) {
  const [clock, setClock] = useState<ClockValue>(() => readExamClock(deadline, stageStartedAt, serverOffset))
  const expireRef = useRef(onExpire)
  const expiredKey = useRef('')

  useEffect(() => { expireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    const update = () => {
      const next = readExamClock(deadline, stageStartedAt, serverOffset)
      setClock((current) => current.remaining === next.remaining && current.elapsed === next.elapsed ? current : next)
    }
    update()
    const timer = window.setInterval(update, 1000)
    const resume = () => { if (document.visibilityState !== 'hidden') update() }
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [deadline, serverOffset, stageStartedAt])

  useEffect(() => {
    if (clock.remaining !== 0 || deadline === null) return
    if (expiredKey.current === expiryKey) return
    expiredKey.current = expiryKey
    expireRef.current()
  }, [clock.remaining, deadline, expiryKey])

  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>
}

export function ExamClockReadout({ className, elapsed = false }: { className?: string; elapsed?: boolean }) {
  const clock = useContext(ClockContext)
  if (!clock) throw new Error('ExamClockReadout must be rendered inside ExamClock')
  const value = elapsed
    ? `${clock.elapsed} 分钟`
    : clock.remaining === null ? '不限时' : `${Math.floor(clock.remaining / 60)}:${String(clock.remaining % 60).padStart(2, '0')}`
  return <span className={className}>{value}</span>
}

export function readExamClock(deadline: number | null, stageStartedAt: number, serverOffset: number, clientNow = Date.now()): ClockValue {
  const now = clientNow + serverOffset
  return {
    remaining: deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000)),
    elapsed: Math.max(0, Math.floor((now - stageStartedAt) / 60000)),
  }
}
