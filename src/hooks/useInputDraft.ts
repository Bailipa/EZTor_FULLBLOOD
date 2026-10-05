'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useSession } from 'next-auth/react'

const textCodec = {
  encode: (value: string) => value || null,
  decode: (raw: string) => raw,
  isEmpty: (value: string) => !value,
}
const createEmptyText = () => ''

function writeDraft<T>(key: string, value: T, codec: { encode: (value: T) => string | null }) {
  try {
    const raw = codec.encode(value)
    if (raw === null || raw.length > 100_000) localStorage.removeItem(key)
    else if (localStorage.getItem(key) !== raw) localStorage.setItem(key, raw)
  } catch { /* Draft persistence is optional when storage is unavailable. */ }
}

export function useInputDraft<T = string>(
  name: string,
  createInitial: () => T = createEmptyText as () => T,
  codec: { encode: (value: T) => string | null; decode: (raw: string) => T; isEmpty: (value: T) => boolean } = textCodec as unknown as { encode: (value: T) => string | null; decode: (raw: string) => T; isEmpty: (value: T) => boolean },
): [T, Dispatch<SetStateAction<T>>, string | null] {
  const { data: session, status } = useSession()
  const scope = status === 'loading' ? null : status === 'authenticated' && session?.user?.id ? `user:${session.user.id}` : 'guest'
  const key = scope ? `eztor:input-draft:v1:${name}:${encodeURIComponent(scope)}` : null
  const [initial] = useState(createInitial)
  const [state, setState] = useState<{ key: string | null; value: T }>({ key: null, value: initial })
  const committed = useRef(state)
  const activeKey = useRef(key)
  const codecRef = useRef(codec)
  const value = state.key === key ? state.value : initial

  useLayoutEffect(() => {
    activeKey.current = key
    codecRef.current = codec
    if (committed.current.key && committed.current.key !== key) writeDraft(committed.current.key, committed.current.value, codecRef.current)
    committed.current = state
    if (state.key === key) return
    let restored = createInitial()
    if (key) {
      try {
        const raw = localStorage.getItem(key)
        if (raw !== null && raw.length <= 100_000) restored = codec.decode(raw)
      } catch { /* Unavailable or invalid storage leaves an empty input. */ }
    }
    setState({ key, value: restored })
  }, [key, state, codec, createInitial])

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((update) => {
    setState((current) => {
      if (current.key !== activeKey.current) return current
      return { key: current.key, value: typeof update === 'function' ? (update as (previous: T) => T)(current.value) : update }
    })
  }, [])

  const flush = useCallback(() => {
    const latest = committed.current
    if (latest.key === key && key) writeDraft(key, latest.value, codecRef.current)
  }, [key])

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [flush])

  useEffect(() => {
    if (!key || state.key !== key) return
    if (codecRef.current.isEmpty(state.value)) { flush(); return }
    const timer = window.setTimeout(flush, 500)
    return () => window.clearTimeout(timer)
  }, [key, state, flush])

  return [value, setValue, key]
}
