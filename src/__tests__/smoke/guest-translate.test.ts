/**
 * Smoke test: Guest translation flow
 *
 * Validates: homepage → word submission → translation result
 * Requires a running server.
 * Run with: NEXT_PUBLIC_APP_URL=http://localhost:3000 npx vitest src/__tests__/smoke/
 */

import { describe, it, expect } from 'vitest'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

describe('Guest translation smoke test', () => {
  it('GET / returns 200', async () => {
    const res = await fetch(`${BASE}/`)
    expect(res.status).toBe(200)
  })

  it('POST /api/public-translate endpoint exists and responds', async () => {
    const res = await fetch(`${BASE}/api/public-translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: 'hello', sourceLang: 'en', targetLang: 'zh' }),
    })

    // Accept 200 (success) or 403 (missing CSRF/Origin in CI).
    // A 500 or connection refused would indicate a server issue.
    expect([200, 403, 401, 429]).toContain(res.status)

    if (res.status === 200) {
      const json = await res.json()
      expect(json).toHaveProperty('translation')
      expect(typeof json.translation).toBe('string')
      expect(json.translation.length).toBeGreaterThan(0)
    }
  })

  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('status')
  })

  it('POST /api/public-translate rejects empty word', async () => {
    const res = await fetch(`${BASE}/api/public-translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '', sourceLang: 'en', targetLang: 'zh' }),
    })
    // 400 expected; 403/401 also acceptable if CSRF blocks first
    expect([400, 403, 401]).toContain(res.status)
  })
})
