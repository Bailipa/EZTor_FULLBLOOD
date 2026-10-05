import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0,
  effects: [] as (() => void | (() => void))[],
}))
vi.mock('react', () => ({
  default: { createElement: () => null },
  useState: (initial: unknown) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? value(harness.states[index]) : value
    }]
  },
  useRef: (initial: unknown) => harness.refs[harness.refIndex++] ?? (harness.refs[harness.refIndex - 1] = { current: initial }),
  useCallback: (callback: unknown) => callback,
  useLayoutEffect: (effect: () => void) => harness.effects.push(effect),
  useEffect: (effect: () => void) => harness.effects.push(effect),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }))
vi.mock('@/components/ui/button', () => ({ Button: () => null }))
vi.mock('@/components/ui/textarea', () => ({ Textarea: () => null }))
vi.mock('@/components/ui/card', () => ({ Card: () => null, CardContent: () => null }))
vi.mock('lucide-react', () => ({ Loader2: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { ChatRoom } from '@/components/chat/ChatRoom'

class Stream {
  static opened: Stream[] = []
  close = vi.fn()
  onmessage: ((event: { data: string }) => void) | null = null
  constructor() { Stream.opened.push(this) }
}
const fetchMock = vi.fn()
function render(active: boolean) {
  harness.stateIndex = 0
  harness.refIndex = 0
  harness.effects = []
  ChatRoom({ active })
  return harness.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => !!cleanup)
}
let cleanups: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
  harness.states = []
  harness.refs = []
  Stream.opened = []
  fetchMock.mockReset()
  fetchMock.mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('EventSource', Stream)
  vi.stubGlobal('window', { location: { href: '' }, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => {
  cleanups.forEach(cleanup => cleanup())
  cleanups = []
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('mounted chat panel activity', () => {
  it('does no network or polling work while hidden', () => {
    cleanups = render(false)
    vi.advanceTimersByTime(60000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(Stream.opened).toHaveLength(0)
  })
  it('aborts reads, closes SSE and clears polling when hidden; resumes while retaining the draft', () => {
    cleanups = render(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    const stream = Stream.opened[0]
    harness.states[1] = 'unsent draft'
    cleanups.forEach(cleanup => cleanup())
    cleanups = render(false)
    expect(signal.aborted).toBe(true)
    expect(stream.close).toHaveBeenCalledOnce()
    stream.onmessage?.({ data: JSON.stringify({ type: 'message', data: { id: 'stale' } }) })
    expect(harness.states[0]).toEqual([])
    vi.advanceTimersByTime(60000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    cleanups = render(true)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(Stream.opened).toHaveLength(2)
    expect(harness.states[1]).toBe('unsent draft')
  })
  it('refreshes recent messages after resuming without dropping loaded history', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [{ id: 'recent', content: 'updated' }], pagination: { hasMore: false, nextCursor: null } }) })
    harness.states[0] = [{ id: 'old', content: 'older page' }, { id: 'recent', content: 'before' }]
    cleanups = render(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.states[0]).toEqual([{ id: 'old', content: 'older page' }, { id: 'recent', content: 'updated' }])
  })
  it('ignores late read responses after hiding the chat', async () => {
    const resolveReads: ((value: unknown) => void)[] = []
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveReads.push(resolve) }))
    cleanups = render(true)
    cleanups.forEach(cleanup => cleanup())
    cleanups = render(false)
    resolveReads.forEach(resolve => resolve({ ok: true, json: async () => ({ success: true, count: 99, data: [{ id: 'late' }], pagination: {} }) }))
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.states[0]).toEqual([])
    expect(harness.states[6]).toBe(0)
  })
})
