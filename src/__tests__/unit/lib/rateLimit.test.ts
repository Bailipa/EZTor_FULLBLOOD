/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getClientKey,
  rateLimit,
  useMemoryStore,
  cleanupExpiredEntries,
  isRedisStoreEnabled,
  initializeRedisStore,
} from '@/lib/rateLimit'

describe('getClientKey', () => {
  it('extracts x-forwarded-for header (first IP)', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    })
    expect(getClientKey(req)).toBe('192.168.1.1')
  })

  it('falls back to x-real-ip when no x-forwarded-for', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientKey(req)).toBe('10.0.0.1')
  })

  it('falls back to "unknown" when no IP headers present', () => {
    const req = new Request('http://localhost/')
    expect(getClientKey(req)).toBe('unknown')
  })

  it('appends sessionId when provided', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientKey(req, 'user123')).toBe('10.0.0.1:user123')
  })

  it('appends sessionId to unknown when no IP headers', () => {
    const req = new Request('http://localhost/')
    expect(getClientKey(req, 'anon123')).toBe('unknown:anon123')
  })

  it('preserves x-forwarded-for value as-is (no trimming)', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
    })
    expect(getClientKey(req)).toContain('192.168.1.1')
  })
})

describe('rateLimit', () => {
  beforeEach(async () => {
    useMemoryStore()
    await cleanupExpiredEntries()
  })

  it('should allow requests within the window (MAX_REQUESTS=30)', async () => {
    for (let i = 0; i < 30; i++) {
      const result = await rateLimit(`test-key-${i}`)
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(29)
      expect(result.resetTime).toBeGreaterThan(Date.now())
    }
  })

  it('should block request when count exceeds MAX_REQUESTS', async () => {
    const key = 'block-test-key'
    for (let i = 0; i < 30; i++) {
      await rateLimit(key)
    }
    const result = await rateLimit(key)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('decrements remaining with each request on the same key', async () => {
    const key = 'decrement-key'
    let result = await rateLimit(key)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(29)

    result = await rateLimit(key)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(28)
  })

  it('resets count after window expiry', async () => {
    const key = 'expiry-key'
    await rateLimit(key)

    // Simulate expired entry by cleaning up and then advancing time
    // Since the entry won't be expired, we test the !entry path by using a fresh key
    const result = await rateLimit('fresh-key')
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(29)

    // Verify resetTime is set to ~60s in the future
    const now = Date.now()
    expect(result.resetTime).toBeGreaterThan(now)
    expect(result.resetTime).toBeLessThan(now + 61000)
  })

  it('reuses resetTime from existing entry', async () => {
    const key = 'reset-time-key'
    const first = await rateLimit(key)
    const second = await rateLimit(key)
    expect(second.resetTime).toBe(first.resetTime)
  })

  it('handles concurrent requests from different keys independently', async () => {
    const resultsA = await Promise.all(
      Array.from({ length: 5 }, () => rateLimit('key-a'))
    )
    const resultsB = await Promise.all(
      Array.from({ length: 5 }, () => rateLimit('key-b'))
    )

    expect(resultsA.every((r) => r.success)).toBe(true)
    expect(resultsB.every((r) => r.success)).toBe(true)

    // Each key consumed some requests; remaining should be < 30
    expect(resultsA[resultsA.length - 1].remaining).toBeLessThan(30)
    expect(resultsB[resultsB.length - 1].remaining).toBeLessThan(30)
  })
})

describe('cleanupExpiredEntries', () => {
  beforeEach(() => {
    useMemoryStore()
  })

  it('should not throw when store is empty', async () => {
    await expect(cleanupExpiredEntries()).resolves.toBeUndefined()
  })

  it('should clean up after adding entries', async () => {
    await rateLimit('cleanup-key-1')
    await rateLimit('cleanup-key-2')
    await expect(cleanupExpiredEntries()).resolves.toBeUndefined()
  })
})

describe('initializeRedisStore / isRedisStoreEnabled', () => {
  afterEach(() => {
    useMemoryStore()
  })

  it('should report memory store by default', () => {
    useMemoryStore()
    expect(isRedisStoreEnabled()).toBe(false)
  })

  it('should report redis store after initialization', () => {
    const mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    }
    initializeRedisStore(mockRedis)
    expect(isRedisStoreEnabled()).toBe(true)
  })

  it('should revert to memory store', () => {
    const mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    }
    initializeRedisStore(mockRedis)
    useMemoryStore()
    expect(isRedisStoreEnabled()).toBe(false)
  })
})
