'use client'

import { useState, useEffect } from 'react'

const DEFAULT_QQ_GROUP_URL = 'https://qm.qq.com/q/7NNZCF2dHi'

let cachedUrl: string | null = null
let pendingPromise: Promise<string> | null = null

function fetchQQGroupUrl(): Promise<string> {
  if (cachedUrl) return Promise.resolve(cachedUrl)
  if (pendingPromise) return pendingPromise

  pendingPromise = fetch('/site-config.json')
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch site config')
      return r.json()
    })
    .then((data): string => {
      const url = data.qqGroupUrl || DEFAULT_QQ_GROUP_URL
      cachedUrl = url
      return url
    })
    .catch((): string => {
      cachedUrl = DEFAULT_QQ_GROUP_URL
      return DEFAULT_QQ_GROUP_URL
    })
    .finally(() => {
      pendingPromise = null
    })

  return pendingPromise
}

export function useQQGroupUrl(): string {
  const [url, setUrl] = useState(cachedUrl || DEFAULT_QQ_GROUP_URL)

  useEffect(() => {
    let cancelled = false
    fetchQQGroupUrl().then((result) => {
      if (!cancelled) setUrl(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return url
}
