/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { isQuotaError, isRateLimitError, isConnectionError, maskApiKey } from '@/lib/llmPool'

describe('isQuotaError', () => {
  it('detects status 402', () => {
    expect(isQuotaError({ status: 402 })).toBe(true)
  })

  it('detects status 429', () => {
    expect(isQuotaError({ status: 429 })).toBe(true)
  })

  it('detects quota message', () => {
    expect(isQuotaError({ message: 'insufficient_quota' })).toBe(true)
  })

  it('detects Chinese quota message', () => {
    expect(isQuotaError({ message: '配额不足' })).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isQuotaError({ status: 500, message: 'Internal error' })).toBe(false)
  })

  it('handles null/undefined', () => {
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError({})).toBe(false)
  })
})

describe('isRateLimitError', () => {
  it('detects status 429', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true)
  })

  it('detects rate limit message', () => {
    expect(isRateLimitError({ message: 'rate_limit exceeded' })).toBe(true)
  })

  it('detects too many requests message', () => {
    expect(isRateLimitError({ message: 'too_many_requests' })).toBe(true)
  })

  it('returns false for non-rate-limit errors', () => {
    expect(isRateLimitError({ status: 500 })).toBe(false)
  })
})

describe('isConnectionError', () => {
  it('detects connection message', () => {
    expect(isConnectionError({ message: 'Connection refused' })).toBe(true)
  })

  it('detects timeout message', () => {
    expect(isConnectionError({ message: 'timeout' })).toBe(true)
  })

  it('detects ECONNREFUSED', () => {
    expect(isConnectionError({ message: 'ECONNREFUSED' })).toBe(true)
  })

  it('detects ENOTFOUND', () => {
    expect(isConnectionError({ message: 'ENOTFOUND' })).toBe(true)
  })

  it('detects SSL/certificate errors', () => {
    expect(isConnectionError({ code: 'SELF_SIGNED_CERT_IN_CHAIN' })).toBe(true)
    expect(isConnectionError({ message: 'SSL error' })).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isConnectionError({ status: 403, message: 'Forbidden' })).toBe(false)
  })
})

describe('maskApiKey', () => {
  it('masks long API keys', () => {
    expect(maskApiKey('sk-abcdefghijklmnop')).toBe('sk-a****mnop')
  })

  it('returns **** for short keys', () => {
    expect(maskApiKey('short')).toBe('****')
  })

  it('returns **** for empty keys', () => {
    expect(maskApiKey('')).toBe('****')
  })
})
