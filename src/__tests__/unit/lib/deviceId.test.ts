/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getDeviceId', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns empty string in Node.js (non-browser) environment', async () => {
    const { getDeviceId } = await import('@/lib/deviceId')
    expect(getDeviceId()).toBe('')
  })

  it('returns empty string when window is undefined', async () => {
    // Ensure window is not defined (should already be in node env)
    expect(typeof window).toBe('undefined')
    const { getDeviceId } = await import('@/lib/deviceId')
    expect(getDeviceId()).toBe('')
  })

  it('does not throw in non-browser environment', async () => {
    const { getDeviceId } = await import('@/lib/deviceId')
    expect(() => getDeviceId()).not.toThrow()
  })

  it('consistently returns empty string on repeated calls in node', async () => {
    const { getDeviceId } = await import('@/lib/deviceId')
    expect(getDeviceId()).toBe('')
    expect(getDeviceId()).toBe('')
    expect(getDeviceId()).toBe('')
  })
})

describe('getDeviceId (with mocked localStorage)', () => {
  it('generates and stores device ID when none exists', async () => {
    const store = new Map<string, string>()

    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })

    const { getDeviceId } = await import('@/lib/deviceId')

    const id = getDeviceId()
    expect(id).toMatch(/^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/)
    expect(id).toHaveLength(36)

    vi.unstubAllGlobals()
  })

  it('returns existing device ID from localStorage', async () => {
    const existingId = 'abcd1234-qwer-5678-tyui-9012zxcvbnmq'

    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key === 'vocab_device_id' ? existingId : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })

    vi.resetModules()
    const { getDeviceId } = await import('@/lib/deviceId')

    expect(getDeviceId()).toBe(existingId)

    vi.unstubAllGlobals()
  })

  it('does not overwrite existing device ID', async () => {
    const existingId = 'fixed-device-id-0000-0000-0000'
    const setItemSpy = vi.fn()

    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => existingId),
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })

    vi.resetModules()
    const { getDeviceId } = await import('@/lib/deviceId')

    getDeviceId()
    expect(setItemSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
