import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  states: [] as unknown[], setters: [] as ((value: unknown) => void)[], refs: [] as { current: unknown }[], callbacks: [] as { fn: unknown; deps: unknown[] }[],
  stateIndex: 0, refIndex: 0, callbackIndex: 0, layouts: [] as (() => void)[],
}))
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>()
  return {
    ...react,
    useState: (initial: unknown) => {
      const index = hooks.stateIndex++
      if (!(index in hooks.states)) hooks.states[index] = initial
      hooks.setters[index] ??= (value: unknown) => { hooks.states[index] = typeof value === 'function' ? value(hooks.states[index]) : value }
      return [hooks.states[index], hooks.setters[index]]
    },
    useRef: (initial: unknown) => hooks.refs[hooks.refIndex++] ?? (hooks.refs[hooks.refIndex - 1] = { current: initial }),
    useCallback: (fn: unknown, deps: unknown[]) => {
      const index = hooks.callbackIndex++
      const previous = hooks.callbacks[index]
      if (!previous || deps.some((value, dep) => !Object.is(value, previous.deps[dep]))) hooks.callbacks[index] = { fn, deps }
      return hooks.callbacks[index].fn
    },
    useLayoutEffect: (effect: () => void) => hooks.layouts.push(effect),
    useEffect: () => {},
  }
})
vi.mock('@/lib/hapticFeedback', () => ({ triggerHapticFeedback: vi.fn() }))
vi.mock('@/lib/savedFeedbackScheduler', () => ({ scheduleSavedFeedback: vi.fn() }))

import { useRealtimeTranslation, type WordEntry } from '@/hooks/useRealtimeTranslation'
import { WordInputRow } from '@/components/home/WordInputRow'

const fetchMock = vi.fn()
function entry(id: string, word: string): WordEntry { return { id, word, translation: '', status: 'idle', isPublic: false, saveStatus: 'idle' } }
function render() {
  hooks.stateIndex = 0; hooks.refIndex = 0; hooks.callbackIndex = 0; hooks.layouts = []
  // This mock harness calls the hook directly to inspect committed state and callback identity.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useRealtimeTranslation({ showPos: true, showExample: true, targetGroupId: 'none', isGuest: true })
  hooks.layouts.forEach(effect => effect())
  return result
}
beforeEach(() => {
  hooks.states = [[entry('first', 'alpha'), entry('second', 'beta')]]
  hooks.setters = []; hooks.refs = []; hooks.callbacks = []
  fetchMock.mockReset(); fetchMock.mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('realtime row memo eligibility', () => {
  it('leaves a sibling entry and every row action shallow-equal after editing another row', () => {
    const first = render()
    first.updateWord('second', 'gamma', true)
    const second = render()
    expect(second.entries[0]).toBe(first.entries[0])
    expect(second.entries[1]).not.toBe(first.entries[1])
    const rowActions = ['updateWord', 'removeEntry', 'translateSingle', 'cancelTranslate', 'retryPublicTranslation', 'saveEntry', 'cancelSave', 'addEntry'] as const
    for (const action of rowActions) expect(second[action]).toBe(first[action])
    const memo = WordInputRow as unknown as { $$typeof: symbol; compare: unknown }
    expect(memo.$$typeof).toBe(Symbol.for('react.memo'))
    expect(memo.compare).toBeNull()
  })
  it('stable retry/translate actions use the latest committed word and add respects the latest empty row', () => {
    const first = render()
    first.updateWord('second', 'gamma', true)
    render()
    first.retryPublicTranslation('second')
    vi.advanceTimersByTime(300)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).words).toEqual(['gamma'])
    void first.translateSingle('second')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).words).toEqual(['gamma'])
    first.updateWord('second', '', true)
    render()
    expect(first.addEntry()).toBeNull()
    expect((hooks.states[0] as WordEntry[])).toHaveLength(2)
  })
})
