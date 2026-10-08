import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ create: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { analyticsEvent: { create: mocks.create } } }))
vi.mock('next-auth/next', () => ({ getServerSession: mocks.session }))
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { POST } from '@/app/api/analytics/route'
import { shouldRecordAnalytics } from '@/lib/analyticsPolicy'
describe('Meaningful analytics only', () => {
  it('ignores old-client navigation events before session or database work', async () => {
    for (const eventType of ['PAGE_VIEW', 'CTA_CLICK', 'FIRST_ACTION', 'MODAL_OPEN', 'MODAL_CLOSE']) {
      const response = await POST(new Request('http://localhost/api/analytics', { method: 'POST', body: JSON.stringify({ eventType }) }))
      expect(await response.json()).toEqual({ success: true, ignored: true })
    }
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it('retains learning outcomes and operational errors', () => {
    for (const type of ['TRANSLATE', 'DICTATION_COMPLETE', 'API_ERROR', 'REGISTER']) expect(shouldRecordAnalytics(type)).toBe(true)
  })
})
