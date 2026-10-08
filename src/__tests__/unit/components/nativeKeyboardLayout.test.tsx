import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], setState: vi.fn() }))
vi.mock('react', () => ({
  createContext: () => ({ Provider: 'provider' }),
  useContext: () => false,
  useState: () => [false, hooks.setState],
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
}))
vi.mock('react/jsx-runtime', () => ({ jsx: (type: unknown, props: unknown) => ({ type, props }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
import { NativeKeyboardLayoutProvider } from '@/components/layout/NativeKeyboardLayoutProvider'

class Editor {
  isConnected = true
  parentElement = null
  matches() { return true }
}
let viewport: EventTarget & { height: number; offsetTop: number }
let windowEvents: EventTarget
let documentEvents: EventTarget
let root: { style: { getPropertyValue: (name: string) => string; setProperty: (name: string, value: string) => void; removeProperty: (name: string) => void }; dataset: Record<string, string> }
let doc: { activeElement: Editor | null }
let frames: Map<number, FrameRequestCallback>
let cleanup: () => void
let nextFrame: number
function flushFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(callback => callback(0))
}
function focusEditor() {
  const editor = new Editor()
  doc.activeElement = editor
  const event = new Event('focusin')
  Object.defineProperty(event, 'target', { value: editor })
  documentEvents.dispatchEvent(event)
  flushFrame()
}
beforeEach(() => {
  hooks.effects = []; hooks.setState.mockClear()
  frames = new Map(); nextFrame = 0
  viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
  windowEvents = new EventTarget(); documentEvents = new EventTarget()
  const styles = new Map<string, string>()
  root = { dataset: {}, style: {
    getPropertyValue: name => styles.get(name) ?? '',
    setProperty: vi.fn((name: string, value: string) => styles.set(name, value)),
    removeProperty: vi.fn((name: string) => styles.delete(name)),
  } }
  doc = Object.assign(documentEvents, { activeElement: null, documentElement: root, body: {} })
  vi.stubGlobal('HTMLElement', Editor)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', Object.assign(windowEvents, { visualViewport: viewport, innerHeight: 800, matchMedia: () => Object.assign(new EventTarget(), { matches: true }) }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextFrame; frames.set(id, callback); return id })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  NativeKeyboardLayoutProvider({ children: null })
  cleanup = hooks.effects[0]() as () => void
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('native keyboard layout scheduling', () => {
  it('does not rewrite the same viewport height during scrolling', () => {
    expect(root.style.setProperty).toHaveBeenCalledTimes(1)
    viewport.dispatchEvent(new Event('scroll')); flushFrame()
    viewport.dispatchEvent(new Event('scroll')); flushFrame()
    expect(root.style.setProperty).toHaveBeenCalledTimes(1)
    expect(hooks.setState).not.toHaveBeenCalled()
  })
  it('updates keyboard context only when keyboard visibility changes', () => {
    focusEditor()
    viewport.height = 500
    viewport.offsetTop = 80
    viewport.dispatchEvent(new Event('resize')); flushFrame()
    expect(root.dataset.keyboardOpen).toBe('true')
    expect(root.style.getPropertyValue('--app-visible-top')).toBe('80px')
    expect(hooks.setState).toHaveBeenCalledTimes(1)
    expect(hooks.setState).toHaveBeenCalledWith(true)
    viewport.dispatchEvent(new Event('scroll')); flushFrame()
    expect(hooks.setState).toHaveBeenCalledTimes(1)
    viewport.height = 800
    viewport.dispatchEvent(new Event('resize')); flushFrame()
    expect(root.dataset.keyboardOpen).toBeUndefined()
    expect(root.style.getPropertyValue('--app-visible-top')).toBe('')
    expect(hooks.setState).toHaveBeenLastCalledWith(false)
  })
  it('cancels queued editor scrolling on unmount', () => {
    focusEditor()
    viewport.height = 500
    viewport.dispatchEvent(new Event('resize')); flushFrame()
    expect(frames.size).toBe(1)
    cleanup()
    expect(frames.size).toBe(0)
    expect(root.style.getPropertyValue('--app-visible-height')).toBe('')
  })
})
