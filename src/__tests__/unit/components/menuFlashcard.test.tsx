import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ states: [] as unknown[], stateIndex: 0, effects: [] as (() => void | (() => void))[] }))
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(harness.states[index]) : value
    }]
  },
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect),
}))
vi.mock('react/jsx-runtime', () => {
  const element = (type: unknown, props: Record<string, unknown>) => ({ type, props })
  return { Fragment: Symbol.for('react.fragment'), jsx: element, jsxs: element }
})
vi.mock('lucide-react', () => ({ Volume2: () => null }))
vi.mock('@/lib/ttsBrowser', () => ({ speakText: vi.fn() }))

import MenuFlashcard from '@/components/layout/MenuFlashcard'

const fetchMock = vi.fn()
let cleanups: (() => void)[] = []
function render(runEffects = false) {
  harness.stateIndex = 0
  harness.effects = []
  const tree = MenuFlashcard()
  if (runEffects) cleanups = harness.effects.map(effect => effect()).filter((cleanup): cleanup is () => void => !!cleanup)
  return tree
}
function visit(node: unknown, predicate: (value: { type: unknown; props: Record<string, unknown> }) => boolean): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(child => visit(child, predicate))
  if (!node || typeof node !== 'object') return []
  const element = node as { type: unknown; props: Record<string, unknown> }
  const children = element.props.children
  return [...(predicate(element) ? [element] : []), ...visit(children, predicate)]
}
function buttons(tree: unknown) { return visit(tree, element => element.type === 'button') }
function button(tree: unknown, text: string) {
  const found = buttons(tree).find(item => item.props.children === text)
  if (!found) throw new Error(`Button not found: ${text}`)
  return found
}
function response(body: unknown, ok = true) { return { ok, json: async () => body } }
async function settle() { await new Promise(resolve => setTimeout(resolve, 0)) }
const word = { word: 'abundant', translation: '丰富的；充足的', phonetic: '/əˈbʌndənt/' }

beforeEach(() => {
  harness.states = []
  harness.stateIndex = 0
  harness.effects = []
  cleanups = []
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(response({ success: true, data: [word] }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanups.forEach(cleanup => cleanup())
  cleanups = []
  vi.unstubAllGlobals()
})

describe('menu flashcard', () => {
  it('shows the loaded word and reveals its meaning', async () => {
    render(true)
    await settle()
    const loaded = render()
    expect(visit(loaded, item => item.type === 'span').some(item => item.props.children === word.word)).toBe(true)
    expect(visit(loaded, item => item.type === 'span').some(item =>
      Array.isArray(item.props.children) && item.props.children.join('') === `[${word.phonetic}]`
    )).toBe(true)
    expect(visit(loaded, item => item.type === 'button' && item.props['aria-label'] === '朗读单词')).toHaveLength(1)
    ;(button(loaded, '点击查看释义').props.onClick as () => void)()
    const revealed = render()
    expect(button(revealed, word.translation)).toBeDefined()
    expect(buttons(revealed).some(item => item.props.children === '认识')).toBe(true)
    expect(buttons(revealed).some(item => item.props.children === '不认识')).toBe(true)
  })

  it.each([
    ['认识', 'known', true],
    ['不认识', 'unknown', false],
  ] as const)('sends the %s classification payload and disables choices while saving', async (label, category, isCorrect) => {
    render(true)
    await settle()
    const initial = render()
    ;(button(initial, '点击查看释义').props.onClick as () => void)()
    const revealed = render()
    ;(button(revealed, label).props.onClick as () => void)()

    const [url, options] = fetchMock.mock.calls.find(([requestUrl]) => requestUrl === '/api/flashcard/save-and-categorize') ?? []
    expect(url).toBe('/api/flashcard/save-and-categorize')
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({ word: word.word, category, isCorrect })
    const saving = render()
    expect(button(saving, '认识').props.disabled).toBe(true)
    expect(button(saving, '不认识').props.disabled).toBe(true)
    expect(fetchMock.mock.calls.filter(([requestUrl]) => requestUrl === '/api/flashcard/save-and-categorize')).toHaveLength(1)
  })

  it('keeps the original word visible and reports a failed save', async () => {
    fetchMock.mockImplementation((url: string) => url === '/api/flashcard/public?limit=1'
      ? Promise.resolve(response({ success: true, data: [word] }))
      : Promise.resolve(response({ success: false, error: '保存失败' }, false)))
    render(true)
    await settle()
    const initial = render()
    ;(button(initial, '点击查看释义').props.onClick as () => void)()
    const revealed = render()
    ;(button(revealed, '认识').props.onClick as () => void)()
    await settle()
    const failed = render()
    expect(visit(failed, item => item.type === 'span').some(item => item.props.children === word.word)).toBe(true)
    expect(button(failed, word.translation)).toBeDefined()
    expect(visit(failed, item => item.props.role === 'alert').some(item => item.props.children === '保存失败')).toBe(true)
  })

  it('aborts the word request when the menu unmounts', () => {
    let resolveRead!: (value: unknown) => void
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveRead = resolve }))
    render(true)
    const readOptions = fetchMock.mock.calls[0][1] as RequestInit
    const signal = readOptions.signal as AbortSignal
    cleanups.forEach(cleanup => cleanup())
    expect(signal.aborted).toBe(true)
    const beforeLateResponse = structuredClone(harness.states)
    resolveRead(response({ success: true, data: [word] }))
    return settle().then(() => expect(harness.states).toEqual(beforeLateResponse))
  })
})
