import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[], index: 0, reduced: false,
  effects: [] as (() => void | (() => void))[], layouts: [] as (() => void | (() => void))[],
}))
vi.mock('react', () => ({
  useRef: (value: unknown) => hooks.refs[hooks.index++] ?? (hooks.refs[hooks.index - 1] = { current: value }),
  useEffect: (effect: () => void) => hooks.effects.push(effect),
  useLayoutEffect: (effect: () => void) => hooks.layouts.push(effect),
}))
vi.mock('@/hooks/useReducedInterfaceMotion', () => ({ useReducedInterfaceMotion: () => hooks.reduced }))

import { panelSwipeDestination, usePanelSwipe } from '@/hooks/usePanelSwipe'

class Surface {
  controls = false
  parentElement: Surface | null = null
  scrollWidth = 360
  clientWidth = 360
  overflowX = 'visible'
  style: Record<string, unknown> = { removeProperty: (key: string) => { delete this.style[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] } }
  listeners = new Map<string, EventListener>()
  active: Surface = this
  addEventListener(name: string, listener: EventListener) { this.listeners.set(name, listener) }
  removeEventListener(name: string) { this.listeners.delete(name) }
  querySelector() { return this.active }
  closest() { return this.controls ? this : null }
  contains(target: Surface): boolean { return target === this || !!target.parentElement && this.contains(target.parentElement) }
  matches() { return this.controls }
  getBoundingClientRect() { return { width: 360 } }
}

let container: Surface
let panel: Surface
let mobile: boolean
let keyboard: boolean
let focused: Surface | null
let selection: string
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let cleanup: (() => void)[]
let select: ReturnType<typeof vi.fn<[string], boolean>>
let rootRef: { current: HTMLElement }

function Harness(active = 'first', enabled = true) {
  hooks.index = 0
  hooks.effects = []
  hooks.layouts = []
  usePanelSwipe(rootRef, active, ['first', 'second', 'third'], select, enabled)
}
function flushFrames() {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((frame) => frame(0))
}
function fire(name: string, x = 200, y = 200, target = panel, count = 1) {
  const touch = { identifier: 1, clientX: x, clientY: y }
  const event = { target, touches: Array(count).fill(touch), changedTouches: [touch], cancelable: true, preventDefault: vi.fn() }
  container.listeners.get(name)?.(event as unknown as Event)
  return event
}

beforeEach(() => {
  vi.useFakeTimers()
  hooks.refs = []
  hooks.reduced = false
  mobile = true
  keyboard = false
  focused = null
  selection = ''
  frames = new Map()
  nextFrame = 0
  cleanup = []
  container = new Surface()
  panel = new Surface()
  container.active = panel
  rootRef = { current: container as unknown as HTMLElement }
  select = vi.fn((_panel: string) => true)
  const win = new Surface()
  vi.stubGlobal('Element', Surface)
  vi.stubGlobal('window', Object.assign(win, {
    innerWidth: 400, matchMedia: () => ({ get matches() { return mobile } }),
    getSelection: () => ({ toString: () => selection }), setTimeout, clearTimeout,
    getComputedStyle: (node: Surface) => ({ overflowX: node.overflowX }),
  }))
  vi.stubGlobal('document', {
    get activeElement() { return focused },
    documentElement: { dataset: { get keyboardOpen() { return keyboard ? 'true' : 'false' } } },
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => {
  cleanup.reverse().forEach((fn) => fn())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function mount(enabled = true) {
  Harness('first', enabled)
  for (const effect of [...hooks.layouts, ...hooks.effects]) {
    const dispose = effect()
    if (dispose) cleanup.push(dispose)
  }
}

describe('mobile panel swipes', () => {
  it('left advances, right returns, and boundaries do not wrap', () => {
    expect(panelSwipeDestination(0, 3, -80, 5)).toBe(1)
    expect(panelSwipeDestination(1, 3, 80, 5)).toBe(0)
    expect(panelSwipeDestination(0, 3, 80, 5)).toBeNull()
    expect(panelSwipeDestination(2, 3, -80, 5)).toBeNull()
    expect(panelSwipeDestination(1, 3, 40, 0)).toBeNull()
    expect(panelSwipeDestination(1, 3, -80, 80)).toBeNull()
  })
  it('coalesces finger tracking into one frame and slides the new panel in', () => {
    mount()
    fire('touchstart')
    fire('touchmove', 170)
    fire('touchmove', 120)
    expect(frames.size).toBe(1)
    expect(select).not.toHaveBeenCalled()
    flushFrames()
    expect(panel.style.transform).toBe('translate3d(-80px, 0, 0)')
    fire('touchend', 120)
    expect(select).toHaveBeenCalledWith('second')
    expect(panel.style.transform).toBeUndefined()
    const incoming = new Surface()
    container.active = incoming
    Harness('second')
    hooks.layouts.forEach((effect) => effect())
    expect(incoming.style.transform).toBe('translate3d(79.2px, 0, 0)')
    flushFrames()
    expect(incoming.style.transform).toBe('translate3d(79.2px, 0, 0)')
    flushFrames()
    expect(incoming.style.transform).toBe('translate3d(0, 0, 0)')
    vi.advanceTimersByTime(230)
    expect(incoming.style.transform).toBeUndefined()
  })
  it('rebounds short, cancelled and blocked gestures without selecting', () => {
    mount()
    for (const end of ['touchend', 'touchcancel']) {
      fire('touchstart')
      fire('touchmove', 175)
      flushFrames()
      fire(end, 175)
      expect(panel.style.transform).toBe('translate3d(0, 0, 0)')
      vi.advanceTimersByTime(210)
      expect(panel.style.transform).toBeUndefined()
    }
    select.mockReturnValue(false)
    fire('touchstart')
    fire('touchmove', 100)
    flushFrames()
    fire('touchend', 100)
    expect(panel.style.transform).toBe('translate3d(0, 0, 0)')
  })
  it('leaves vertical scrolling, controls, selection, keyboard and edge gestures alone', () => {
    mount()
    fire('touchstart')
    expect(fire('touchmove', 195, 260).preventDefault).not.toHaveBeenCalled()
    fire('touchend', 100, 260)
    for (const mode of ['controls', 'focus', 'selection', 'keyboard', 'edge', 'multitouch']) {
      panel.controls = mode === 'controls'
      focused = mode === 'focus' ? Object.assign(new Surface(), { controls: true }) : null
      selection = mode === 'selection' ? 'selected text' : ''
      keyboard = mode === 'keyboard'
      fire('touchstart', mode === 'edge' ? 10 : 200, 200, panel, mode === 'multitouch' ? 2 : 1)
      expect(fire('touchmove', 100).preventDefault).not.toHaveBeenCalled()
      fire('touchend', 100)
    }
    expect(select).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })
  it('cancels midgesture multitouch and cleans up frames/listeners on unmount', () => {
    mount()
    fire('touchstart')
    fire('touchmove', 150)
    fire('touchmove', 100, 200, panel, 2)
    fire('touchend', 100)
    expect(select).not.toHaveBeenCalled()
    fire('touchstart')
    fire('touchmove', 100)
    cleanup.pop()?.()
    expect(frames.size).toBe(0)
    expect(container.listeners.size).toBe(0)
    expect(panel.style.transform).toBeUndefined()
  })
  it('does not claim a vertical scroll that starts with a sideways wobble', () => {
    mount()
    fire('touchstart')
    expect(fire('touchmove', 184, 208).preventDefault).not.toHaveBeenCalled()
    expect(fire('touchmove', 178, 242).preventDefault).not.toHaveBeenCalled()
    expect(fire('touchmove', 110, 250).preventDefault).not.toHaveBeenCalled()
    fire('touchend', 110, 250)
    expect(select).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    expect(panel.style.transform).toBeUndefined()
  })
  it('releases a horizontal gesture when vertical scrolling becomes dominant', () => {
    mount()
    fire('touchstart')
    expect(fire('touchmove', 165, 205).preventDefault).toHaveBeenCalledOnce()
    flushFrames()
    expect(fire('touchmove', 162, 260).preventDefault).not.toHaveBeenCalled()
    expect(fire('touchmove', 110, 300).preventDefault).not.toHaveBeenCalled()
    fire('touchend', 100, 300)
    vi.advanceTimersByTime(210)
    expect(select).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    expect(panel.style.transform).toBeUndefined()
    fire('touchstart')
    expect(fire('touchmove', 195, 120).preventDefault).not.toHaveBeenCalled()
  })
  it('does not switch panels on an ambiguous diagonal gesture', () => {
    mount()
    fire('touchstart')
    expect(fire('touchmove', 120, 250).preventDefault).not.toHaveBeenCalled()
    fire('touchend', 120, 250)
    expect(select).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })
  it('preserves horizontal scrolling in nested code, tables and lists', () => {
    mount()
    const scrollable = Object.assign(new Surface(), { parentElement: panel, scrollWidth: 800, overflowX: 'auto' })
    const text = Object.assign(new Surface(), { parentElement: scrollable })
    fire('touchstart', 200, 200, text)
    expect(fire('touchmove', 100, 200, text).preventDefault).not.toHaveBeenCalled()
    fire('touchend', 100, 200, text)
    expect(select).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })
  it('still navigates with reduced motion but never writes animated styles', () => {
    hooks.reduced = true
    mount()
    fire('touchstart')
    fire('touchmove', 100)
    fire('touchend', 100)
    expect(select).toHaveBeenCalledWith('second')
    expect(frames.size).toBe(0)
    expect(panel.style.transform).toBeUndefined()
  })
  it('never animates or changes desktop columns or a disabled workspace', () => {
    mobile = false
    mount()
    fire('touchstart')
    fire('touchmove', 100)
    fire('touchend', 100)
    expect(select).not.toHaveBeenCalled()
    expect(panel.style.transform).toBeUndefined()
    cleanup.pop()?.()
    mount(false)
    expect(container.listeners.size).toBe(0)
  })
})
