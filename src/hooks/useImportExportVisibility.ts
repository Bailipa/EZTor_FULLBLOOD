'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readUserPreferences, subscribeUserPreferences } from '@/lib/userPreferences'

export function useImportExportVisibility(): { show: boolean; ready: boolean } {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const [show, setShow] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (status === 'loading') {
      setReady(false)
      return
    }

    if (status !== 'authenticated' || !userId) {
      setShow(false)
      setReady(true)
      return
    }

    const controller = new AbortController()
    let active = true
    setShow(false)
    setReady(false)
    const apply = (data: Awaited<ReturnType<typeof readUserPreferences>>) => {
      if (active) setShow(data.showImportExportActions === true)
    }
    const unsubscribe = subscribeUserPreferences(userId, ['showImportExportActions'], apply)
    readUserPreferences(userId, controller.signal).then(apply)
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true)
      })

    return () => {
      active = false
      unsubscribe()
      controller.abort()
    }
  }, [status, userId])

  return { show: status === 'authenticated' && show, ready }
}
