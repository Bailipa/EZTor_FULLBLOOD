'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export function useImportExportVisibility(): { show: boolean; ready: boolean } {
  const { status } = useSession()
  const [show, setShow] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (status === 'loading') {
      setReady(false)
      return
    }

    if (status !== 'authenticated') {
      setShow(false)
      setReady(true)
      return
    }

    const controller = new AbortController()
    let active = true
    setShow(false)
    setReady(false)
    fetch('/api/preferences', { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        if (active && result.success) setShow(result.data?.showImportExportActions === true)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [status])

  return { show: status === 'authenticated' && show, ready }
}
