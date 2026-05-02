/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('validateEnv', () => {
  it('returns errors for missing required vars', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_URL', '')
    vi.stubEnv('DATABASE_URL', '')

    const { validateEnv } = await import('@/lib/envValidator')
    const result = validateEnv()
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })

  it('returns valid when all required vars are set', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'A8x!mK92#pL5@vR7&wN3$qB1*eC6)zF4')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/db')

    const { validateEnv } = await import('@/lib/envValidator')
    const result = validateEnv()
    expect(result.valid).toBe(true)
  })

  it('detects insecure default values', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'your-random-secret-key-at-least-32-characters-long')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/db')

    const { validateEnv } = await import('@/lib/envValidator')
    const result = validateEnv()
    expect(result.valid).toBe(false)
    expect(result.insecureValues).toContain('NEXTAUTH_SECRET')
  })

  it('warns about weak NEXTAUTH_SECRET', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'aaaaaa')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/db')

    const { validateEnv } = await import('@/lib/envValidator')
    const result = validateEnv()
    expect(result.warnings.length).toBeGreaterThanOrEqual(1)
  })

  it('warns about SQLite in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXTAUTH_SECRET', 'a-secure-secret-key-that-is-long-enough-32!')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('DATABASE_URL', 'file:./dev.db')

    const { validateEnv } = await import('@/lib/envValidator')
    const result = validateEnv()
    expect(result.warnings.some((w) => w.includes('SQLite'))).toBe(true)
  })
})

describe('getRequiredEnvVar', () => {
  it('returns value when set', async () => {
    vi.stubEnv('TEST_VAR', 'hello')
    const { getRequiredEnvVar } = await import('@/lib/envValidator')
    expect(getRequiredEnvVar('TEST_VAR')).toBe('hello')
  })

  it('returns placeholder during test/build', async () => {
    vi.stubEnv('NEXT_PHASE', '')
    vi.stubEnv('NODE_ENV', 'test')
    const { getRequiredEnvVar } = await import('@/lib/envValidator')
    expect(getRequiredEnvVar('MISSING_VAR')).toContain('BUILD_PLACEHOLDER')
  })

  it('logs warning for insecure value', async () => {
    vi.stubEnv('TEST_VAR', 'your-secret')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { getRequiredEnvVar } = await import('@/lib/envValidator')
    getRequiredEnvVar('TEST_VAR')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('getOptionalEnvVar', () => {
  it('returns default when not set', async () => {
    vi.stubEnv('TEST_VAR', '')
    const { getOptionalEnvVar } = await import('@/lib/envValidator')
    expect(getOptionalEnvVar('TEST_VAR', 'default')).toBe('default')
  })

  it('returns value when set', async () => {
    vi.stubEnv('TEST_VAR', 'custom')
    const { getOptionalEnvVar } = await import('@/lib/envValidator')
    expect(getOptionalEnvVar('TEST_VAR')).toBe('custom')
  })
})

describe('maskSensitiveValue', () => {
  it('masks value keeping visibleChars each side', async () => {
    const { maskSensitiveValue } = await import('@/lib/envValidator')
    expect(maskSensitiveValue('abcdefghij', 3)).toBe('abc****hij')
  })

  it('fully masks short values', async () => {
    const { maskSensitiveValue } = await import('@/lib/envValidator')
    // length 3 <= 2*2=4, so fully masked
    expect(maskSensitiveValue('abc', 2)).toBe('***')
  })
})
