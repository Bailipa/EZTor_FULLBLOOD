/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

interface GlobalWithStore {
  localStorage: {
    _store: Map<string, string>
    getItem: (k: string) => string | null
    setItem: (k: string, v: string) => void
    removeItem: (k: string) => void
    clear: () => void
  }
  fetch: typeof fetch
  addEventListener: (event: string, handler: () => void) => void
  removeEventListener: (event: string, handler: () => void) => void
}

function makeLocalStorage() {
  const store = new Map<string, string>()
  return {
    _store: store,
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
}

function setupBrowserShim() {
  const ls = makeLocalStorage()
  vi.stubGlobal('window', {
    localStorage: ls,
    addEventListener: () => {},
    removeEventListener: () => {},
  })
  vi.stubGlobal('localStorage', ls)
  return ls
}

const originalFetch = globalThis.fetch

function mockFetchOk(words: unknown[] = [{ word: 'hello' }]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ success: true, data: words }),
  }) as unknown as typeof fetch
}

function mockFetchEmpty() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ success: true, data: [] }),
  }) as unknown as typeof fetch
}

function mockFetchFail() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch
}

const STORAGE_KEY = 'vocab_showDanmaku'

describe('danmakuStore - state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setupBrowserShim()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    globalThis.fetch = originalFetch
    vi.resetModules()
  })

  it('idle → toggle → counting → active (when words exist)', async () => {
    mockFetchOk()
    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    const store = useDanmakuStore.getState()

    expect(store.status).toBe('idle')

    const p = store.toggle()
    expect(useDanmakuStore.getState().status).toBe('counting')
    expect(useDanmakuStore.getState().showDanmaku).toBe(true)

    await vi.advanceTimersByTimeAsync(5000)
    await p

    expect(useDanmakuStore.getState().status).toBe('active')
  })

  it('counting → empty → idle when no words (3s reset)', async () => {
    mockFetchEmpty()
    const { useDanmakuStore } = await import('@/stores/danmakuStore')

    const p = useDanmakuStore.getState().toggle()
    await vi.advanceTimersByTimeAsync(5000)
    await p
    expect(useDanmakuStore.getState().status).toBe('empty')

    await vi.advanceTimersByTimeAsync(3000)
    expect(useDanmakuStore.getState().status).toBe('idle')
    expect(useDanmakuStore.getState().showDanmaku).toBe(false)
  })

  it('countdown value decrements each second during counting', async () => {
    mockFetchOk()
    const { useDanmakuStore } = await import('@/stores/danmakuStore')

    const p = useDanmakuStore.getState().toggle()
    expect(useDanmakuStore.getState().countdownValue).toBe(5)

    await vi.advanceTimersByTimeAsync(1000)
    expect(useDanmakuStore.getState().countdownValue).toBe(4)

    await vi.advanceTimersByTimeAsync(2000)
    expect(useDanmakuStore.getState().countdownValue).toBe(2)

    await vi.advanceTimersByTimeAsync(5000)
    await p
  })

  it('active → toggle → idle (immediate close)', async () => {
    mockFetchOk()
    const { useDanmakuStore } = await import('@/stores/danmakuStore')

    const p = useDanmakuStore.getState().toggle()
    await vi.advanceTimersByTimeAsync(5000)
    await p
    expect(useDanmakuStore.getState().status).toBe('active')

    await useDanmakuStore.getState().toggle()
    expect(useDanmakuStore.getState().status).toBe('idle')
  })

  it('empty → toggle → idle (immediate close)', async () => {
    mockFetchEmpty()
    const { useDanmakuStore } = await import('@/stores/danmakuStore')

    const p = useDanmakuStore.getState().toggle()
    await vi.advanceTimersByTimeAsync(5000)
    await p
    expect(useDanmakuStore.getState().status).toBe('empty')

    await useDanmakuStore.getState().toggle()
    expect(useDanmakuStore.getState().status).toBe('idle')
  })

  it('fetch failure → empty → idle', async () => {
    mockFetchFail()
    const { useDanmakuStore } = await import('@/stores/danmakuStore')

    const p = useDanmakuStore.getState().toggle()
    await vi.advanceTimersByTimeAsync(5000)
    await p
    expect(useDanmakuStore.getState().status).toBe('empty')

    await vi.advanceTimersByTimeAsync(3000)
    expect(useDanmakuStore.getState().status).toBe('idle')
  })
})

describe('danmakuStore - localStorage migration', () => {
  beforeEach(() => {
    setupBrowserShim()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads raw boolean true (legacy)', async () => {
    const ls = (globalThis as unknown as GlobalWithStore).localStorage
    ls.setItem(STORAGE_KEY, 'true')

    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(true)
    })
  })

  it('reads raw boolean false (legacy)', async () => {
    const ls = (globalThis as unknown as GlobalWithStore).localStorage
    ls.setItem(STORAGE_KEY, 'false')

    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(false)
    })
  })

  it('reads wrapped legacy {version, data}', async () => {
    const ls = (globalThis as unknown as GlobalWithStore).localStorage
    ls.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: '1.0.0', data: true, timestamp: 1700000000000 }),
    )

    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(true)
    })
  })

  it('reads zustand native format', async () => {
    const ls = (globalThis as unknown as GlobalWithStore).localStorage
    ls.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { showDanmaku: true }, version: 0 }),
    )

    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(true)
    })
  })

  it('defaults to false when no storage', async () => {
    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(false)
    })
  })

  it('writes zustand format after toggle', async () => {
    vi.useFakeTimers()
    mockFetchOk()

    const ls = (globalThis as unknown as GlobalWithStore).localStorage
    ls.setItem(STORAGE_KEY, 'true')

    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(true)
    })

    const p = useDanmakuStore.getState().toggle()
    await vi.advanceTimersByTimeAsync(5000)
    await p

    const raw = ls.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed).toHaveProperty('state')
    expect(parsed).toHaveProperty('version')

    vi.useRealTimers()
  })

  it('returns null for unparseable garbage', async () => {
    const ls = (globalThis as unknown as GlobalWithStore).localStorage
    ls.setItem(STORAGE_KEY, 'not-valid-json{{{')

    const { useDanmakuStore } = await import('@/stores/danmakuStore')
    await vi.waitFor(() => {
      expect(useDanmakuStore.getState().showDanmaku).toBe(false)
    })
  })
})