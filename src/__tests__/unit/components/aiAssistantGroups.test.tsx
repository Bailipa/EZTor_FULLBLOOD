import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({
  states: [] as unknown[], stateIndex: 0,
  effects: [] as (() => void | (() => void))[],
}))
vi.mock('react', () => ({
  default: { createElement: () => null },
  useState: (initial: unknown) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [harness.states[index], (value: unknown) => { harness.states[index] = value }]
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useLayoutEffect: (effect: () => void) => harness.effects.push(effect),
  useEffect: (effect: () => void) => harness.effects.push(effect),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'test-user' } }, status: 'authenticated' }) }))
vi.mock('react-markdown', () => ({ default: () => null }))
vi.mock('remark-gfm', () => ({ default: () => null }))
vi.mock('@/components/ui/login-prompt-modal', () => ({ useLoginPrompt: () => ({ promptLogin: vi.fn(), LoginPromptDialog: () => null }) }))

import { AiAssistant } from '@/components/ai/AiAssistant'

const fetchMock = vi.fn()
let cleanups: (() => void)[] = []
function render(groups?: { id: string; name: string }[]) {
  harness.stateIndex = 0
  harness.effects = []
  AiAssistant({ groups })
  cleanups = harness.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => !!cleanup)
}
beforeEach(() => {
  harness.states = []
  fetchMock.mockReset()
  fetchMock.mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('localStorage', { getItem: () => null })
})
afterEach(() => {
  cleanups.forEach(cleanup => cleanup())
  cleanups = []
  vi.unstubAllGlobals()
})

describe('AI workspace group reads', () => {
  it('uses supplied workspace groups, including an empty list, without another read', () => {
    const groups = [{ id: 'group-a', name: '生词本' }]
    render(groups)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(harness.states[6]).toEqual(groups)
    render([])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(harness.states[6]).toEqual([])
  })
  it('keeps a standalone read and aborts it before a stale response can update state', async () => {
    let resolveRead!: (value: unknown) => void
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveRead = resolve }))
    render()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    cleanups.forEach(cleanup => cleanup())
    expect(signal.aborted).toBe(true)
    resolveRead({ json: async () => ({ success: true, data: [{ id: 'stale', name: '旧账户' }] }) })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(harness.states[6]).toEqual([])
  })
})
