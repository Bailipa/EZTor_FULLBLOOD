import { beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: number }[], index: 0, refIndex: 0, effects: [] as (() => void | (() => void))[], userId: 'alice', track: vi.fn() }))
vi.mock('react', () => {
  const createElement = (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children })
  return {
    default: { createElement }, createContext: () => ({ Provider: 'provider' }), useContext: vi.fn(),
    useState: (initial: unknown) => { const i = h.index++; if (!(i in h.states)) h.states[i] = initial; return [h.states[i], (value: unknown) => { h.states[i] = typeof value === 'function' ? value(h.states[i]) : value }] },
    useRef: (initial: number) => h.refs[h.refIndex++] ?? (h.refs[h.refIndex - 1] = { current: initial }),
    useCallback: (fn: unknown) => fn, useEffect: (fn: () => void) => h.effects.push(fn),
  }
})
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: h.userId } }, status: 'authenticated' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/analytics', () => ({ useAnalytics: () => ({ track: h.track }) }))
vi.mock('@/components/ui/dialog', () => ({ Dialog: 'dialog', DialogContent: 'content', DialogDescription: 'description', DialogTitle: 'title' }))
vi.mock('@/components/ui/button', () => ({ Button: 'button' }))
vi.mock('lucide-react', () => ({ BookOpen: 'icon', Highlighter: 'icon', RotateCcw: 'icon', Compass: 'icon' }))
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider'
function render() {
  h.index = 0; h.refIndex = 0; h.effects = []
  return OnboardingProvider({ children: null }).props.value
}
beforeEach(() => {
  h.states = []; h.refs = []; h.userId = 'alice'; h.track.mockReset()
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, needsOnboarding: true }) }))
})
describe('new onboarding recovery and completion', () => {
  it('restores only this account’s new tour and never the old cross-page tour', async () => {
    localStorage.setItem('onboarding_step', '6')
    localStorage.setItem('onboarding:v2:bob', '13')
    render(); h.effects[0]()
    await vi.waitFor(() => expect(render().currentStep).toBe(11))
    expect(fetch).toHaveBeenCalledWith('/api/onboarding/status')
    expect(localStorage.getItem('onboarding:v2:bob')).toBe('13')
  })
  it('resumes the saved step after refresh without requiring a flashcard action', async () => {
    localStorage.setItem('onboarding:v2:alice', '13')
    render(); h.effects[0]()
    await vi.waitFor(() => expect(render().currentStep).toBe(13))
    expect(fetch).toHaveBeenCalledWith('/api/onboarding/status?resume=1')
  })
  it('keeps the tour and saved progress when completion fails', async () => {
    render().startOnboarding(); render(); h.effects[1]()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    await expect(render().completeOnboarding()).rejects.toThrow('保存未成功')
    expect(render().isActive).toBe(true)
    expect(localStorage.getItem('onboarding:v2:alice')).toBe('11')
    expect(h.track).not.toHaveBeenCalled()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
    await render().completeOnboarding()
    expect(render().isActive).toBe(false)
    expect(localStorage.getItem('onboarding:v2:alice')).toBeNull()
  })
  it('does not let a delayed status reply close a manually restarted guide', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockReturnValueOnce(new Promise((done) => { resolve = done }) as Promise<Response>)
    render(); h.effects[0](); render().startOnboarding()
    resolve({ ok: true, json: async () => ({ success: true, needsOnboarding: false }) } as Response)
    await new Promise((done) => setTimeout(done, 0))
    expect(render().isActive).toBe(true)
    expect(render().currentStep).toBe(11)
  })
})
