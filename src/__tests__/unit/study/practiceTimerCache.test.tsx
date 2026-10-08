import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExamSessionView } from '@/features/study/examTypes'
import { emptyPracticeTiming } from '@/features/study/practiceTiming'

const h = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], cursor: 0, refCursor: 0, effectCursor: 0,
  effects: [] as { deps: unknown[]; cleanup?: () => void }[], pending: [] as (() => void)[],
  request: vi.fn(), now: 1000,
}))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual,
    useState: (initial: unknown) => {
      const index = h.cursor++
      if (!(index in h.states)) h.states[index] = initial
      return [h.states[index], (value: unknown) => { h.states[index] = typeof value === 'function' ? value(h.states[index]) : value }]
    },
    useRef: (initial: unknown) => h.refs[h.refCursor++] ?? (h.refs[h.refCursor - 1] = { current: initial }),
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = h.effectCursor++
      const previous = h.effects[index]
      if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return
      h.pending.push(() => { previous?.cleanup?.(); const cleanup = effect(); h.effects[index] = { deps, cleanup: cleanup || undefined } })
    },
  }
})
vi.mock('@/components/ui/button', () => ({ Button: 'button' }))
vi.mock('@/features/study/client', () => ({ studyRequest: h.request }))
import PracticeTimer from '@/features/study/PracticeTimer'

type Element = { type: string | ((props: unknown) => Element); props: { children?: unknown; onClick?: () => void; [key: string]: unknown } }
const key = 'cet-practice-timing:v1:alice:attempt'
const listeners = new Map<string, (event?: unknown) => void>()
const storage = new Map<string, string>()
const session = { id: 'attempt', mode: 'FULL', status: 'TRANSLATION', stageStartedAt: '2026-10-08T00:00:00.000Z' } as ExamSessionView
function render(current = session) {
  h.cursor = 0; h.refCursor = 0; h.effectCursor = 0; h.pending = []
  const wrapper = PracticeTimer({ accountId: 'alice', session: current })
  const tree = wrapper.type(wrapper.props) as Element
  h.pending.forEach(effect => effect())
  return tree
}
function button(element: unknown): Element | undefined {
  if (!element || typeof element !== 'object') return
  if (Array.isArray(element)) return element.map(button).find(Boolean)
  const node = element as Element
  if (node.type === 'button') return node
  return button(node.props?.children)
}
function unmount() { h.effects.forEach(effect => effect.cleanup?.()); resetHooks() }
function resetHooks() { h.states = []; h.refs = []; h.effects = []; h.pending = [] }
function mount(current = session) { render(current); return render(current) }
beforeEach(() => {
  resetHooks(); storage.clear(); listeners.clear(); h.now = 1000
  vi.spyOn(Date, 'now').mockImplementation(() => h.now)
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  vi.stubGlobal('window', { setInterval: vi.fn(() => 1), clearInterval: vi.fn(), addEventListener: (name: string, callback: (event?: unknown) => void) => listeners.set(name, callback), removeEventListener: (name: string) => listeners.delete(name) })
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() })
  h.request.mockReset().mockImplementation(async (_account, _url, options) => JSON.parse(options.body))
})
describe('practice timer local cache lifecycle', () => {
  it('flushes the final fractional second before a completed view saves the attempt', () => {
    button(mount())!.props.onClick!()
    h.now = 2750
    unmount()
    mount({ ...session, status: 'COMPLETE' })
    expect(h.request).toHaveBeenCalledWith('alice', '/api/study/exams/attempts/attempt/timing', expect.objectContaining({ body: expect.any(String) }))
    const timing = JSON.parse(h.request.mock.calls[0][2].body)
    expect(timing.modules.TRANSLATION).toBe(1750)
    expect(timing.totalMs).toBe(1750)
  })
  it('does not let a passive or superseded tab overwrite another tab on unmount', () => {
    button(mount())!.props.onClick!()
    const other = { ...emptyPracticeTiming(), tracked: true, modules: { ...emptyPracticeTiming().modules, TRANSLATION: 8000 }, totalMs: 8000, owner: 'other-tab' }
    storage.set(key, JSON.stringify(other))
    h.now = 9000
    // Even if the storage event has not arrived, cleanup checks the latest owner.
    unmount()
    expect(JSON.parse(storage.get(key)!)).toEqual(other)
    mount()
    h.now = 15000
    unmount()
    expect(JSON.parse(storage.get(key)!)).toEqual(other)
  })
  it('adopts another tab’s snapshot paused and starts from the latest total', () => {
    button(mount())!.props.onClick!()
    const other = { ...emptyPracticeTiming(), tracked: true, modules: { ...emptyPracticeTiming().modules, TRANSLATION: 4000 }, totalMs: 4000, owner: 'other-tab' }
    storage.set(key, JSON.stringify(other))
    listeners.get('storage')!({ storageArea: localStorage, key, newValue: JSON.stringify(other) })
    button(render())!.props.onClick!()
    h.now = 1500
    unmount()
    expect(JSON.parse(storage.get(key)!).totalMs).toBe(4500)
  })
  it('does not reclaim ownership when a stale tab clicks pause before receiving the storage event', () => {
    button(mount())!.props.onClick!()
    const other = { ...emptyPracticeTiming(), tracked: true, modules: { ...emptyPracticeTiming().modules, TRANSLATION: 9000 }, totalMs: 9000, owner: 'other-tab' }
    storage.set(key, JSON.stringify(other))
    h.now = 2000
    button(render())!.props.onClick!()
    expect(JSON.parse(storage.get(key)!)).toEqual(other)
    unmount()
    expect(JSON.parse(storage.get(key)!)).toEqual(other)
  })
  it.each(['read', 'write'])('retains timing across module and completion remounts when storage %s fails', failure => {
    const current = { ...session, id: `blocked-${failure}`, status: 'WRITING' as const }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => { if (failure === 'read') throw new Error('blocked'); return storage.get(key) ?? null },
      setItem: () => { throw new Error('blocked') },
    })
    button(mount(current))!.props.onClick!()
    h.now = 2000
    unmount()
    const next = { ...current, status: 'TRANSLATION' as const }
    const tree = mount(next)
    expect(JSON.stringify(tree)).toContain('当前标签内仍会保留')
    button(tree)!.props.onClick!()
    h.now = 2750
    unmount()
    mount({ ...current, status: 'COMPLETE' })
    const timing = JSON.parse(h.request.mock.calls[0][2].body)
    expect(timing.modules.WRITING).toBe(1000)
    expect(timing.modules.TRANSLATION).toBe(750)
    expect(timing.totalMs).toBe(1750)
  })

})
