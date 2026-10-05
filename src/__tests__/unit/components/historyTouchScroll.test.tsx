import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0, effects: [] as (() => void | (() => void))[], toggle: vi.fn(), selection: new Set<string>(), setSelection: vi.fn(), callbacks: [] as { fn: unknown; deps: unknown[] }[], callbackIndex: 0, layouts: [] as (() => void)[] }))
vi.mock('react', () => {
  const createElement = (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children })
  return {
    default: { createElement, memo: (component: unknown) => component },
    forwardRef: (component: unknown) => component,
    useState: (initial: unknown) => {
      const index = harness.stateIndex++
      if (!(index in harness.states)) harness.states[index] = typeof initial === 'function' ? initial() : initial
      return [harness.states[index], (value: unknown) => { harness.states[index] = value }]
    },
    useRef: (initial: unknown) => harness.refs[harness.refIndex++] ?? (harness.refs[harness.refIndex - 1] = { current: initial }),
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = harness.callbackIndex++
      const previous = harness.callbacks[index]
      if (!previous || deps.some((value, dep) => !Object.is(value, previous.deps[dep]))) harness.callbacks[index] = { fn: callback, deps }
      return harness.callbacks[index].fn
    },
    useLayoutEffect: (effect: () => void) => harness.layouts.push(effect),
    useEffect: (effect: () => void) => harness.effects.push(effect),
  }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({}) }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))
vi.mock('@/hooks/useCrudTable', () => ({ useCrudTable: () => ({ selectedIds: harness.selection, setSelectedIds: harness.setSelection, toggleSelection: harness.toggle, clearSelection: vi.fn(), isSelectionMode: true, setIsSelectionMode: vi.fn(), selectedCount: 0 }) }))
vi.mock('@/hooks/useImportExportVisibility', () => ({ useImportExportVisibility: () => ({ show: true }) }))
vi.mock('@/components/onboarding/OnboardingProvider', () => ({ useOnboarding: () => ({ isActive: false }) }))
vi.mock('@/components/onboarding/OnboardingTooltip', () => ({ OnboardingTooltip: () => null }))
vi.mock('@/components/layout/AppLayout', () => ({ default: () => null }))
vi.mock('@/components/vocabulary/ShareImportModal', () => ({ ShareImportModal: () => null }))
vi.mock('@/components/review-group/GroupShareModal', () => ({ GroupShareModal: () => null }))
vi.mock('@/components/vocabulary/WordDetailSheet', () => ({ WordDetailSheet: () => null }))
vi.mock('@/components/vocabulary/WordCard', () => ({ default: 'word-card' }))

import { HistoryWorkspacePanel } from '@/components/vocabulary/HistoryWorkspacePanel'

function findCard(node: unknown): Record<string, (...args: unknown[]) => void> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) { const found = findCard(item); if (found) return found }
    return null
  }
  const element = node as { type: unknown; props: Record<string, (...args: unknown[]) => void>; children: unknown[] }
  if (element.type === 'word-card') return element.props
  return findCard(element.children ?? (element.props as Record<string, unknown>)?.children)
}
let mouseUp: (() => void) | undefined
let cleanups: (() => void)[] = []
beforeEach(() => {
  harness.states = [[{ id: 'word-a', word: 'test', translation: '测试' }], 1, false]
  harness.refs = []
  harness.stateIndex = 0
  harness.refIndex = 0
  harness.effects = []
  harness.toggle.mockReset()
  harness.selection = new Set()
  harness.setSelection.mockReset()
  harness.callbacks = []
  harness.callbackIndex = 0
  harness.layouts = []
  mouseUp = undefined
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  vi.stubGlobal('window', { addEventListener: (name: string, fn: () => void) => { if (name === 'mouseup') mouseUp = fn }, removeEventListener: vi.fn() })
  vi.stubGlobal('document', { body: { style: {} }, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})
afterEach(() => { cleanups.forEach(cleanup => cleanup()); cleanups = []; vi.unstubAllGlobals() })

function render(runEffects = true) {
  harness.stateIndex = 0
  harness.refIndex = 0
  harness.callbackIndex = 0
  harness.effects = []
  harness.layouts = []
  const tree = HistoryWorkspacePanel({ embedded: true, active: true })
  harness.layouts.forEach(effect => effect())
  if (runEffects) cleanups = harness.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => !!cleanup)
  return findCard(tree)!
}
describe('history touch scrolling', () => {
  it('does not install a touchstart blocker; a tap toggles once despite compatibility mouse events', () => {
    const card = render()
    expect(document.addEventListener).not.toHaveBeenCalledWith('touchstart', expect.anything(), expect.anything())
    const touch = { touches: [{ clientX: 20, clientY: 20 }], preventDefault: vi.fn() }
    card.onTouchStart(0, 'word-a', touch)
    card.onTouchEnd()
    card.onMouseDown(0, 'word-a', {})
    mouseUp?.()
    expect(touch.preventDefault).not.toHaveBeenCalled()
    expect(harness.toggle).toHaveBeenCalledTimes(1)
    expect(harness.toggle).toHaveBeenCalledWith('word-a')
  })
  it('touchcancel from native scrolling cancels the press without changing selection', () => {
    const card = render()
    card.onTouchStart(0, 'word-a', { touches: [{ clientX: 20, clientY: 20 }] })
    card.onTouchCancel()
    card.onTouchEnd()
    card.onMouseDown(0, 'word-a', {})
    mouseUp?.()
    expect(harness.toggle).not.toHaveBeenCalled()
  })
  it('keeps press callbacks stable and starts dragging from the latest committed selection', () => {
    const first = render(false)
    harness.selection = new Set(['word-a', 'other'])
    const second = render(false)
    expect(second.onMouseDown).toBe(first.onMouseDown)
    expect(second.onTouchStart).toBe(first.onTouchStart)
    second.onTouchStart(0, 'word-a', { touches: [{ clientX: 20, clientY: 20 }] })
    vi.stubGlobal('document', { elementFromPoint: () => null })
    second.onTouchMove({ touches: [{ clientX: 40, clientY: 20 }] })
    second.onDragEnter(0)
    expect(harness.setSelection).toHaveBeenCalledWith(new Set(['other']))
  })

})
