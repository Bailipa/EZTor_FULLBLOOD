import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), rate: vi.fn() }))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ default: { user: { findUnique: mocks.user } } }))
vi.mock('@/lib/rateLimit', () => ({ rateLimit: mocks.rate }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { studyApi, studyBody } from '@/services/study/api'

const request = (headers: Record<string, string> = {}, method = 'GET') => new Request('http://localhost:3000/api/study', { method, headers: { host: 'localhost:3000', ...headers } })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { id: 'alice' } })
  mocks.user.mockResolvedValue({ isAdmin: false, isBanned: false, banExpiresAt: null })
  mocks.rate.mockResolvedValue({ success: true })
})

describe('study API authentication and request protection', () => {
  it('never runs a callback without authentication', async () => {
    mocks.session.mockResolvedValue(null)
    const action = vi.fn()
    expect((await studyApi(request(), action)).status).toBe(401)
    expect(action).not.toHaveBeenCalled()
  })
  it('rejects a stale account header before reading or writing learning records', async () => {
    const action = vi.fn()
    expect((await studyApi(request({ 'x-study-account': 'bob' }), action)).status).toBe(409)
    expect(action).not.toHaveBeenCalled()
  })
  it('enforces database admin flags and bans', async () => {
    const action = vi.fn()
    expect((await studyApi(request(), action, true)).status).toBe(403)
    mocks.user.mockResolvedValue({ isAdmin: true, isBanned: true, banExpiresAt: null })
    expect((await studyApi(request(), action)).status).toBe(403)
    expect(action).not.toHaveBeenCalled()
  })
  it('checks mutation origin and rate limits', async () => {
    const action = vi.fn()
    expect((await studyApi(request({}, 'POST'), action)).status).toBe(403)
    expect((await studyApi(request({ origin: 'https://another.example' }, 'POST'), action)).status).toBe(403)
    mocks.rate.mockResolvedValue({ success: false })
    expect((await studyApi(request({ origin: 'http://localhost:3000' }, 'POST'), action)).status).toBe(429)
    expect(action).not.toHaveBeenCalled()
  })
  it('marks account records private and exposes only the current account ID', async () => {
    const action = vi.fn().mockResolvedValue({ progress: 1 })
    const response = await studyApi(request({ 'x-study-account': 'alice' }), action)
    expect(action).toHaveBeenCalledWith('alice')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ success: true, data: { progress: 1 }, accountId: 'alice' })
  })
})

describe('bounded JSON imports', () => {
  it('rejects bad JSON, arrays and oversized bodies', async () => {
    for (const body of ['invalid', '[]', '"text"']) await expect(studyBody(new Request('http://localhost/api/study', { method: 'POST', body }))).rejects.toThrow()
    await expect(studyBody(new Request('http://localhost/api/study', { method: 'POST', body: '{"content":"oversized"}' }), 8)).rejects.toMatchObject({ status: 413 })
    expect(await studyBody(new Request('http://localhost/api/study', { method: 'POST', body: '{"meaning":"图书馆"}' }))).toEqual({ meaning: '图书馆' })
  })
  it('counts actual chunked bytes without trusting content length', async () => {
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"a":"'))
      controller.enqueue(new TextEncoder().encode('1234567890"}'))
      controller.close()
    } })
    const req = new Request('http://localhost/api/study', { method: 'POST', body: stream, duplex: 'half' } as RequestInit)
    await expect(studyBody(req, 10)).rejects.toMatchObject({ status: 413 })
  })
})
