import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExamSessionView } from '@/features/study/examTypes'

const hooks = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], stateIndex: 0, refIndex: 0,
  draft: { text: '', answers: {} as Record<string, number>, revision: 1 },
}))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++
    if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial
    return [hooks.states[index], (value: unknown) => { hooks.states[index] = typeof value === 'function' ? value(hooks.states[index]) : value }]
  },
  useRef: (initial: unknown) => hooks.refs[hooks.refIndex++] ?? (hooks.refs[hooks.refIndex - 1] = { current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}))
vi.mock('react/jsx-runtime', () => {
  const element = (type: unknown, props: Record<string, unknown>) => ({ type, props })
  return { Fragment: Symbol.for('react.fragment'), jsx: element, jsxs: element }
})
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/ui/button', () => ({ Button: 'button' }))
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'div', DialogTitle: 'h2', DialogDescription: 'p' }))
vi.mock('@/features/study/ExamClock', () => ({ ExamClock: 'section', ExamClockReadout: 'span' }))
vi.mock('@/hooks/useInputDraft', () => ({
  useInputDraft: () => [hooks.draft, (value: unknown) => { hooks.draft = typeof value === 'function' ? value(hooks.draft) : value }, 'account-draft'],
}))
vi.mock('@/features/study/client', () => ({ studyRequest: vi.fn(), StudyRequestError: class extends Error {} }))

import GoalEditor from '@/features/study/GoalEditor'
import StudyExam from '@/features/study/StudyExam'
import { studyRequest } from '@/features/study/client'

type Element = { type: unknown; props: Record<string, unknown> }
type Handler = (...args: unknown[]) => unknown
function find(node: unknown, type: string): Element {
  if (Array.isArray(node)) {
    for (const child of node) { try { return find(child, type) } catch { /* Search the next sibling. */ } }
  } else if (node && typeof node === 'object') {
    const element = node as Element
    if (element.type === type) return element
    if (element.props) return find(element.props.children, type)
  }
  throw new Error(`Missing ${type}`)
}
function render(component: () => unknown) { hooks.stateIndex = 0; hooks.refIndex = 0; return component() }
const now = '2026-10-07T00:00:00.000Z'
const session = {
  id: 'attempt-1', revision: 1, status: 'WRITING', serverNow: now, stageStartedAt: now,
  paper: { title: 'Writing paper' }, drafts: { WRITING: { text: '', answers: {} } },
  stageContent: { prompt: 'Write in English', audio: [], passages: [], questions: [] },
} as unknown as ExamSessionView
function exam() { return render(() => StudyExam({ accountId: 'account-1', level: 'CET4', mode: 'WRITING', initialSession: session, onClose: vi.fn() })) }
function textarea() { return find(exam(), 'textarea').props }
function change(text: string) { (textarea().onChange as Handler)({ currentTarget: { value: text } }); exam() }
function goalForm() { return find(render(() => GoalEditor({ accountId: 'account-1', goal: null, onClose: vi.fn(), onSaved: vi.fn() })), 'form').props }

beforeEach(() => {
  hooks.states = []; hooks.refs = []; hooks.draft = { text: '', answers: {}, revision: 1 }
  vi.mocked(studyRequest).mockReset()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() })
  vi.useFakeTimers()
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('CET native keyboard input', () => {
  it('blocks IME Enter and Safari keyCode 229 without blocking ordinary Enter', () => {
    const form = goalForm()
    for (const nativeEvent of [{ isComposing: true, keyCode: 13 }, { isComposing: false, keyCode: 229 }]) {
      const preventDefault = vi.fn()
      ;(form.onKeyDown as Handler)({ key: 'Enter', nativeEvent, preventDefault })
      expect(preventDefault).toHaveBeenCalledOnce()
    }
    const preventDefault = vi.fn()
    ;(form.onKeyDown as Handler)({ key: 'Enter', nativeEvent: { isComposing: false, keyCode: 13 }, preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('does not submit a goal during composition and saves after composition ends', async () => {
    const form = goalForm()
    ;(form.onCompositionStart as Handler)()
    await (form.onSubmit as Handler)({ preventDefault: vi.fn() })
    expect(studyRequest).not.toHaveBeenCalled()
    ;(form.onCompositionEnd as Handler)()
    vi.mocked(studyRequest).mockResolvedValue({})
    await (form.onSubmit as Handler)({ preventDefault: vi.fn() })
    expect(studyRequest).toHaveBeenCalledOnce()
  })

  it('preserves newer typing during a slow draft save and sends it using the acknowledged revision', async () => {
    let acknowledge!: (value: unknown) => void
    vi.mocked(studyRequest).mockImplementationOnce(() => new Promise(resolve => { acknowledge = resolve }))
    vi.mocked(studyRequest).mockImplementationOnce(() => new Promise(() => {}))
    change('First version')
    await vi.advanceTimersByTimeAsync(650)
    expect(textarea().readOnly).toBe(false)
    expect(textarea().disabled).toBeUndefined()
    change('First version with newer input')
    await vi.advanceTimersByTimeAsync(650)
    expect(studyRequest).toHaveBeenCalledOnce()
    acknowledge({ session: { ...session, revision: 2, drafts: { WRITING: { text: 'First version', answers: {} } } } })
    await vi.advanceTimersByTimeAsync(0)
    expect(textarea().value).toBe('First version with newer input')
    expect(hooks.draft.revision).toBe(2)
    await vi.advanceTimersByTimeAsync(650)
    const body = JSON.parse(vi.mocked(studyRequest).mock.calls[1][2]!.body as string)
    expect(body).toMatchObject({ type: 'DRAFT', revision: 2, text: 'First version with newer input' })
  })

  it('keeps IME text locally and waits for composition commit before autosaving', async () => {
    vi.mocked(studyRequest).mockImplementation(() => new Promise(() => {}))
    change('Initial text')
    ;(textarea().onCompositionStart as Handler)()
    change('zhong')
    await vi.advanceTimersByTimeAsync(2000)
    expect(studyRequest).not.toHaveBeenCalled()
    expect(hooks.draft.text).toBe('zhong')
    ;(textarea().onCompositionEnd as Handler)({ currentTarget: { value: '中' } })
    exam()
    await vi.advanceTimersByTimeAsync(650)
    expect(JSON.parse(vi.mocked(studyRequest).mock.calls[0][2]!.body as string).text).toBe('中')
  })

  it('retains a newer local draft after a failed save and waits for an explicit retry', async () => {
    let reject!: (failure: Error) => void
    vi.mocked(studyRequest).mockImplementationOnce(() => new Promise((_resolve, rejectSave) => { reject = rejectSave }))
    change('First version')
    await vi.advanceTimersByTimeAsync(650)
    change('Newer local text')
    reject(new Error('Network unavailable'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(studyRequest).toHaveBeenCalledOnce()
    expect(textarea().value).toBe('Newer local text')
    expect(textarea().readOnly).toBe(true)
  })
})
