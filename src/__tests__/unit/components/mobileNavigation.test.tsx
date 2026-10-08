import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0, hidden: new Set<string>(), showDanmaku: true, pathname: '/', status: 'unauthenticated', push: vi.fn(), prefetch: vi.fn(), toggle: vi.fn(), effects: [] as { effect: () => void | (() => void); deps: unknown[] }[] }))
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: unknown) => { harness.states[index] = value }]
  },
  useRef: (initial: unknown) => harness.refs[harness.refIndex++] ?? (harness.refs[harness.refIndex - 1] = { current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => harness.effects.push({ effect, deps }),
}))
vi.mock('react/jsx-runtime', () => {
  const element = (type: unknown, props: Record<string, unknown>) => ({ type, props })
  return { Fragment: 'fragment', jsx: element, jsxs: element }
})
vi.mock('next/navigation', () => ({ usePathname: () => harness.pathname, useRouter: () => ({ push: harness.push, prefetch: harness.prefetch }) }))
vi.mock('next/link', () => ({ default: 'a' }))
vi.mock('next/dynamic', () => ({ default: () => 'menu-flashcard' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: harness.status }) }))
vi.mock('radix-ui', () => ({ Dialog: { Root: 'dialog-root', Trigger: 'dialog-trigger', Portal: 'dialog-portal', Content: 'dialog-content', Title: 'dialog-title', Description: 'dialog-description' } }))
vi.mock('lucide-react', () => Object.fromEntries(['Home', 'PenTool', 'Sparkles', 'Settings2', 'Grid2X2', 'LockKeyhole', 'BookOpen', 'Trophy', 'MonitorDown', 'Coffee', 'MonitorPlay'].map(name => [name, name])))
vi.mock('@/components/interface-style-provider', () => ({ useMinimalFeatures: () => ({ mainVisible: (href: string) => !harness.hidden.has(href), visible: () => harness.showDanmaku }) }))
vi.mock('@/components/layout/NativeKeyboardLayoutProvider', () => ({ useKeyboardVisibility: () => false }))
vi.mock('@/components/home/DonationModal', () => ({ DonationDialog: 'donation-dialog' }))
vi.mock('@/features/gamification/components/FeatureLockedDialog', () => ({ FeatureLockedDialog: 'feature-locked-dialog' }))
vi.mock('@/stores/danmakuStore', () => ({ useDanmakuStore: (selector: (state: unknown) => unknown) => selector({ status: 'idle', countdownValue: 3, toggle: harness.toggle }) }))
vi.mock('@/lib/feedbackSounds', () => ({ playFeedbackSound: vi.fn(), startRadialChargeSound: vi.fn(), stopRadialChargeSound: vi.fn() }))

import MobileNavBar from '@/components/layout/MobileNavBar'

type Element = { type: unknown; props: Record<string, any> }
function visit(node: unknown, predicate: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => visit(child, predicate))
  if (!node || typeof node !== 'object') return []
  const element = node as Element
  return [...(predicate(element) ? [element] : []), ...visit(element.props.children, predicate)]
}
function render() { harness.stateIndex = 0; harness.refIndex = 0; harness.effects = []; return MobileNavBar() }
function root(tree: unknown) { return visit(tree, item => item.type === 'dialog-root')[0] }
function launcher(tree: unknown) { return visit(tree, item => item.type === 'button' && item.props.onPointerDown)[0] }
function content(tree: unknown) { return visit(tree, item => item.type === 'dialog-content')[0] }
function nodes(tree: unknown) { return visit(tree, item => item.type === 'li' && item.props.style) }
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height })
let reads = 0
const frames = new Map<number, FrameRequestCallback>()
let frameId = 0
function flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)) }
function element(bounds: ReturnType<typeof rect>, onClick?: () => void) {
  return { getBoundingClientRect: () => { reads++; return bounds }, click: vi.fn(onClick ?? (() => {})), focus: vi.fn(), style: { transform: '' }, setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() }
}
function mountTargets(tree: unknown, width = 375, height = 667) {
  const size = width < 360 ? 48 : 56
  const scale = width < 360 ? .883 : 1
  const hub = { x: width / 2, y: height - 38 }
  const targets = new Map<string, ReturnType<typeof element>>()
  for (const node of nodes(tree)) {
    const link = visit(node, item => item.type === 'a')[0]
    const x = hub.x + parseFloat(node.props.style['--x']) * scale
    const y = hub.y - parseFloat(node.props.style['--y']) * scale
    const target = element(rect(x - size / 2, y - size / 2, size, size))
    link.props.ref(target)
    targets.set(link.props.href, target)
  }
  const download = visit(tree, item => item.type === 'a' && item.props.href === '/download')[0]
  const donation = visit(tree, item => item.type === 'button' && item.props['aria-label'] === '打赏作者')[0]
  download.props.ref.current = element(rect(16, 12, 110, 44))
  donation.props.ref.current = element(rect(width - 126, 12, 110, 44), donation.props.onClick)
  const danmaku = visit(tree, item => item.type === 'button' && item.props['aria-label'] === '开启弹幕复习')[0]
  if (danmaku) danmaku.props.ref.current = element(rect(hub.x - 58, hub.y - 74, 116, 44), danmaku.props.onClick)
  const cursor = visit(tree, item => item.type === 'span' && item.props.ref)[0]
  cursor.props.ref.current = element(rect(0, 0, 12, 12))
  return { hub, targets, download: download.props.ref.current, donation: donation.props.ref.current }
}
function pointer(currentTarget: unknown, clientX: number, clientY: number, pointerId = 1) {
  return { currentTarget, clientX, clientY, pointerId, isPrimary: true, button: 0, preventDefault: vi.fn() }
}
function begin(width = 375, height = 667) {
  let tree = render()
  const button = launcher(tree)
  const trigger = element(rect(width / 2 - 69, height - 64, 138, 52))
  button.props.onPointerDown(pointer(trigger, width / 2, height - 38))
  tree = render()
  const mounted = mountTargets(tree, width, height)
  return { ...mounted, trigger, handlers: launcher(tree).props, tree }
}

beforeEach(() => {
  harness.states = []; harness.refs = []; harness.hidden = new Set(); harness.showDanmaku = true; harness.pathname = '/'; harness.status = 'unauthenticated'
  harness.push.mockReset(); harness.prefetch.mockReset(); harness.toggle.mockReset(); frames.clear(); frameId = 0; reads = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('mobile radial navigation', () => {
  it.each([320, 375, 390])('keeps all seven targets in bounds and separated at %d px', width => {
    const tree = render()
    const { targets } = mountTargets(tree, width)
    const bounds = [...targets.values()].map(target => target.getBoundingClientRect())
    expect(bounds).toHaveLength(7)
    for (const bound of bounds) {
      expect(bound.width).toBeGreaterThanOrEqual(44)
      expect(bound.left).toBeGreaterThanOrEqual(8)
      expect(bound.right).toBeLessThanOrEqual(width - 8)
      expect(bound.bottom).toBeLessThan(640)
    }
    for (let index = 1; index < bounds.length; index++) {
      const a = bounds[index - 1], b = bounds[index]
      expect(Math.hypot(a.left - b.left, a.top - b.top)).toBeGreaterThan(a.width)
    }
  })

  it('redistributes hidden entries symmetrically and focuses the first visible entry when current page is hidden', () => {
    harness.hidden = new Set(['/', '/dictation', '/study'])
    const tree = render()
    const positions = nodes(tree).map(node => ({ x: parseFloat(node.props.style['--x']), y: parseFloat(node.props.style['--y']) }))
    expect(positions).toHaveLength(4)
    for (let index = 0; index < positions.length; index++) {
      const opposite = positions[positions.length - 1 - index]
      expect(positions[index].x).toBe(-opposite.x)
      expect(positions[index].y).toBe(opposite.y)
    }
    const { targets } = mountTargets(tree)
    content(tree).props.onOpenAutoFocus({ preventDefault: vi.fn() })
    expect(targets.get('/public-vocabulary')?.focus).toHaveBeenCalledOnce()
  })

  it('coalesces movement into one frame and reads stable bounds once per gesture', () => {
    const { handlers, trigger, targets } = begin()
    const target = targets.get('/ai')!.getBoundingClientRect()
    reads = 0
    for (let index = 0; index < 20; index++) handlers.onPointerMove(pointer(trigger, target.left + 28, target.top + 28))
    expect(frames.size).toBe(1)
    flush()
    expect(reads).toBe(10)
    for (let index = 0; index < 20; index++) { handlers.onPointerMove(pointer(trigger, target.left + 28, target.top + 28)); flush() }
    expect(reads).toBe(10)
    handlers.onPointerUp(pointer(trigger, target.left + 28, target.top + 28))
    expect(harness.push).toHaveBeenCalledOnce()
    expect(harness.push).toHaveBeenCalledWith('/ai')
    expect(reads).toBe(10)
  })

  it('uses the final release coordinates even when the last frame has not run', () => {
    const { handlers, trigger, targets } = begin(320)
    const target = targets.get('/public-vocabulary')!.getBoundingClientRect()
    handlers.onPointerMove(pointer(trigger, 160, 300))
    handlers.onPointerUp(pointer(trigger, target.left + 24, target.top + 24))
    expect(frames.size).toBe(0)
    expect(harness.push).toHaveBeenCalledOnce()
    expect(harness.push).toHaveBeenCalledWith('/public-vocabulary')
  })

  it.each(['hub', 'outside', 'cancel', 'lost-capture'])('cancels at %s without selecting a page', reason => {
    const { handlers, trigger, hub, targets } = begin()
    const target = targets.get('/ai')!.getBoundingClientRect()
    handlers.onPointerMove(pointer(trigger, target.left + 28, target.top + 28)); flush()
    const event = reason === 'hub' ? pointer(trigger, hub.x, hub.y) : reason === 'outside' ? pointer(trigger, hub.x, 180) : pointer(trigger, target.left + 28, target.top + 28)
    if (reason === 'cancel') handlers.onPointerCancel(event)
    else if (reason === 'lost-capture') handlers.onLostPointerCapture(event)
    else handlers.onPointerUp(event)
    expect(harness.push).not.toHaveBeenCalled()
    expect(root(render()).props.open).toBe(false)
    expect(trigger.releasePointerCapture).toHaveBeenCalledOnce()
  })

  it('tap opens once, suppresses the compatibility click, and a second tap closes', () => {
    const { handlers, trigger, hub } = begin()
    handlers.onPointerUp(pointer(trigger, hub.x, hub.y))
    let tree = render()
    expect(root(tree).props.open).toBe(true)
    const click = { detail: 1, preventDefault: vi.fn() }
    launcher(tree).props.onClick(click)
    expect(click.preventDefault).toHaveBeenCalledOnce()
    launcher(tree).props.onPointerDown(pointer(trigger, hub.x, hub.y))
    tree = render()
    launcher(tree).props.onPointerUp(pointer(trigger, hub.x, hub.y))
    expect(root(render()).props.open).toBe(false)
  })

  it('preserves auth destinations and keeps danmaku separate from the seven page nodes', () => {
    const tree = render()
    const hrefs = visit(tree, item => item.type === 'a').map(item => item.props.href)
    expect(hrefs).toContain('/auth/signin?callbackUrl=%2Fdictation')
    expect(hrefs).toContain('/auth/signin?callbackUrl=%2Fleaderboard')
    expect(nodes(tree)).toHaveLength(7)
    harness.showDanmaku = false
    expect(visit(render(), item => item.type === 'button' && 'aria-pressed' in item.props)).toHaveLength(0)
  })

  it('bridges keyboard tab order to top utilities and lets Escape cancel a pending gesture', () => {
    const { tree, handlers, trigger, download, donation } = begin()
    const first = { focus: vi.fn() }, last = { focus: vi.fn() }
    const fan = content(tree)
    fan.props.ref.current = { querySelectorAll: () => [first, last] }
    fan.props.onKeyDown({ key: 'Tab', shiftKey: false, target: last, currentTarget: fan.props.ref.current, preventDefault: vi.fn() })
    expect(download.focus).toHaveBeenCalledOnce()
    fan.props.onKeyDown({ key: 'Tab', shiftKey: true, target: first, currentTarget: fan.props.ref.current, preventDefault: vi.fn() })
    expect(donation.focus).toHaveBeenCalledOnce()
    const utilities = visit(tree, item => item.type === 'div' && item.props['aria-hidden'] !== undefined)[1]
    utilities.props.onKeyDown({ key: 'Tab', shiftKey: false, target: donation, preventDefault: vi.fn() })
    expect(first.focus).toHaveBeenCalledOnce()
    utilities.props.onKeyDown({ key: 'Escape', preventDefault: vi.fn() })
    handlers.onPointerUp(pointer(trigger, 200, 450))
    expect(harness.push).not.toHaveBeenCalled()
    expect(root(render()).props.open).toBe(false)
  })

  it.each(['download', 'donation', 'danmaku'])('selects the %s action only inside its visible target', action => {
    const { handlers, trigger, download, donation, hub } = begin()
    const target = action === 'download' ? download.getBoundingClientRect() : action === 'donation' ? donation.getBoundingClientRect() : rect(hub.x - 58, hub.y - 74, 116, 44)
    handlers.onPointerUp(pointer(trigger, target.left + target.width / 2, target.top + target.height / 2))
    if (action === 'download') expect(harness.push).toHaveBeenCalledWith('/download')
    else if (action === 'donation') expect(donation.click).toHaveBeenCalledOnce()
    else expect(harness.toggle).toHaveBeenCalledOnce()
    expect(root(render()).props.open).toBe(false)
  })

  it('cancels pending selection on viewport resize and only installs that listener while open', () => {
    const addEventListener = vi.fn(), removeEventListener = vi.fn()
    vi.stubGlobal('window', { addEventListener, removeEventListener })
    render()
    harness.effects.find(({ deps }) => deps.length === 2 && deps[0] === false)!.effect()
    expect(addEventListener).not.toHaveBeenCalled()
    const { handlers, trigger, targets } = begin()
    const cleanup = harness.effects.find(({ deps }) => deps.length === 2 && deps[0] === true)!.effect()
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    const target = targets.get('/ai')!.getBoundingClientRect()
    handlers.onPointerMove(pointer(trigger, target.left + 28, target.top + 28))
    addEventListener.mock.calls[0][1]()
    handlers.onPointerUp(pointer(trigger, target.left + 28, target.top + 28))
    expect(frames.size).toBe(0)
    expect(harness.push).not.toHaveBeenCalled()
    expect(root(render()).props.open).toBe(false)
    cleanup?.()
    expect(removeEventListener).toHaveBeenCalledWith('resize', addEventListener.mock.calls[0][1])
  })

})
