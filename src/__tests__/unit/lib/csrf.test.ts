/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import { validateCsrf, checkCsrfHeader } from '@/lib/csrf'
import { NextRequest } from 'next/server'

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
): NextRequest {
  const url = new URL(path, 'http://localhost')
  const request = new NextRequest(url.toString(), {
    method,
    headers: new Headers({ host: 'localhost', ...headers }),
  })
  return request
}

describe('validateCsrf', () => {
  it('allows GET requests without origin/referer', () => {
    const req = makeRequest('GET', '/api/translate')
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('allows HEAD and OPTIONS without origin/referer', () => {
    expect(validateCsrf(makeRequest('HEAD', '/api/translate'))).toEqual({ valid: true })
    expect(validateCsrf(makeRequest('OPTIONS', '/api/translate'))).toEqual({ valid: true })
  })

  it('allows POST to CSRF-exempt paths without origin/referer', () => {
    const req = makeRequest('POST', '/api/auth/login')
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('allows POST to CSRF-exempt subpaths', () => {
    const req = makeRequest('POST', '/api/auth/callback/credentials')
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('allows POST to /api/captcha without origin', () => {
    const req = makeRequest('POST', '/api/captcha')
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('rejects POST with no origin and no referer', () => {
    const req = makeRequest('POST', '/api/translate')
    const result = validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing origin')
  })

  it('rejects POST with origin not matching host', () => {
    const req = makeRequest('POST', '/api/translate', { origin: 'https://evil.com' })
    const result = validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('not allowed')
  })

  it('allows POST with matching origin', () => {
    const req = makeRequest('POST', '/api/translate', { origin: 'http://localhost' })
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('allows POST with HTTPS matching origin', () => {
    const req = makeRequest('POST', '/api/translate', {
      host: 'example.com',
      origin: 'https://example.com',
    })
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('extracts origin from referer when origin is missing', () => {
    const req = makeRequest('POST', '/api/translate', {
      referer: 'http://localhost/some-page',
    })
    expect(validateCsrf(req)).toEqual({ valid: true })
  })

  it('rejects when referer is an invalid URL', () => {
    const req = makeRequest('POST', '/api/translate', {
      referer: 'not-a-url',
    })
    const result = validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid referer')
  })

  it('rejects when host header is missing even with origin', () => {
    const url = new URL('http://localhost/api/translate')
    const req = new NextRequest(url.toString(), {
      method: 'POST',
      headers: { origin: 'http://localhost' },
    })
    const result = validateCsrf(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing host')
  })
})

describe('checkCsrfHeader', () => {
  it('allows GET requests without headers', () => {
    const req = new Request('http://localhost/api/test', { method: 'GET' })
    expect(checkCsrfHeader(req)).toEqual({ valid: true })
  })

  it('rejects POST with no origin/referer', () => {
    const req = new Request('http://localhost/api/test', { method: 'POST' })
    const result = checkCsrfHeader(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing origin')
  })

  it('allows POST with matching origin', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { origin: 'http://localhost', host: 'localhost' },
    })
    expect(checkCsrfHeader(req)).toEqual({ valid: true })
  })

  it('rejects POST with mismatched origin', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { origin: 'https://evil.com', host: 'localhost' },
    })
    const result = checkCsrfHeader(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('not allowed')
  })

  it('rejects when referer is invalid URL', () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { referer: 'bad-url', host: 'localhost' },
    })
    const result = checkCsrfHeader(req)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid referer')
  })
})
