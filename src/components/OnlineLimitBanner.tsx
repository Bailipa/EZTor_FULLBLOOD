'use client'

import { useState, useEffect } from 'react'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function OnlineLimitBanner() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const check = () => {
      const val = getCookie('online_limit')
      setCount(val ? parseInt(val, 10) : null)
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  if (count === null) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-3 px-4 text-sm font-medium shadow-lg">
      在线人数过多，当前在线 {count} 人。服务器资源紧张，请稍后再试。
    </div>
  )
}
