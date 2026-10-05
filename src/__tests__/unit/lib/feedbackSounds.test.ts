import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const preferences = vi.hoisted(() => ({ volume: 30, speech: false }))
vi.mock('@/lib/experiencePreferences', () => ({ readExperiencePreferences: () => ({ sfxVolume: preferences.volume }) }))
vi.mock('@/lib/ttsBrowser', () => ({ isSpeechPlaying: () => preferences.speech }))

const parameter = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
const oscillatorNode = () => ({ frequency: parameter(), type: '', connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null })
const gainNode = () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() })
class AudioStub {
  static instances: AudioStub[] = []
  state = 'running'
  currentTime = 0
  destination = {}
  oscillators: ReturnType<typeof oscillatorNode>[] = []
  gains: ReturnType<typeof gainNode>[] = []
  constructor() { AudioStub.instances.push(this) }
  resume = vi.fn(async () => { this.state = 'running' })
  createOscillator() {
    const node = oscillatorNode()
    this.oscillators.push(node)
    return node
  }
  createGain() {
    const node = gainNode()
    this.gains.push(node)
    return node
  }
}

let clock: number
let visibility: string
beforeEach(() => {
  vi.resetModules()
  AudioStub.instances = []
  preferences.volume = 30
  preferences.speech = false
  clock = 0
  visibility = 'visible'
  vi.stubGlobal('window', { AudioContext: AudioStub })
  vi.stubGlobal('document', { get visibilityState() { return visibility } })
  vi.stubGlobal('performance', { now: () => clock })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('global feedback sound safeguards', () => {
  it('does not allocate audio when disabled or volume is zero', async () => {
    const sound = await import('@/lib/feedbackSounds')
    sound.playFeedbackSound('tap')
    sound.unlockFeedbackAudio()
    sound.setFeedbackSoundEnabled(true)
    preferences.volume = 0
    sound.playFeedbackSound('navigate')
    expect(AudioStub.instances).toHaveLength(0)
  })
  it('reuses one context, honors volume, and cleans previous and completed nodes', async () => {
    const sound = await import('@/lib/feedbackSounds')
    sound.setFeedbackSoundEnabled(true)
    sound.playFeedbackSound('tap')
    const context = AudioStub.instances[0]
    expect(context.gains[0].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(0.07 * 0.3)
    clock = 100
    sound.playFeedbackSound('navigate')
    expect(AudioStub.instances).toHaveLength(1)
    expect(context.oscillators[0].disconnect).toHaveBeenCalled()
    expect(context.gains[0].disconnect).toHaveBeenCalled()
    context.oscillators[1].onended?.()
    expect(context.oscillators[1].disconnect).toHaveBeenCalled()
    expect(context.gains[1].disconnect).toHaveBeenCalled()
  })
  it('merges rapid clicks and saved/success cues, while preserving an error outcome', async () => {
    const sound = await import('@/lib/feedbackSounds')
    sound.setFeedbackSoundEnabled(true)
    sound.playFeedbackSound('tap')
    clock = 20
    sound.playFeedbackSound('navigate')
    expect(AudioStub.instances[0].oscillators).toHaveLength(1)
    clock = 100
    sound.playSavedFeedbackSound(true)
    clock = 110
    sound.playFeedbackSound('success')
    expect(AudioStub.instances[0].oscillators).toHaveLength(2)
    sound.playFeedbackSound('error')
    expect(AudioStub.instances[0].oscillators).toHaveLength(3)
  })
  it('silences speech/background cues and stops a cue when the setting is disabled', async () => {
    const sound = await import('@/lib/feedbackSounds')
    sound.setFeedbackSoundEnabled(true)
    preferences.speech = true
    sound.playFeedbackSound('tap')
    preferences.speech = false
    visibility = 'hidden'
    sound.playFeedbackSound('tap')
    expect(AudioStub.instances).toHaveLength(0)
    visibility = 'visible'
    sound.playFeedbackSound('tap')
    const node = AudioStub.instances[0].oscillators[0]
    sound.setFeedbackSoundEnabled(false)
    expect(node.disconnect).toHaveBeenCalled()
    expect(AudioStub.instances[0].gains[0].disconnect).toHaveBeenCalled()
  })
  it('plays only the latest gesture after a suspended mobile audio context resumes', async () => {
    let resume: () => void = () => {}
    const pending = new Promise<void>((resolve) => { resume = resolve })
    class SuspendedAudioStub extends AudioStub {
      state = 'suspended'
      resume = vi.fn(async () => { await pending; this.state = 'running' })
    }
    vi.stubGlobal('window', { AudioContext: SuspendedAudioStub })
    const sound = await import('@/lib/feedbackSounds')
    sound.setFeedbackSoundEnabled(true)
    sound.playFeedbackSound('tap')
    clock = 10
    sound.playFeedbackSound('navigate')
    expect(AudioStub.instances[0].oscillators).toHaveLength(0)
    resume()
    await vi.waitFor(() => expect(AudioStub.instances[0].oscillators).toHaveLength(1), { timeout: 100, interval: 1 })
    expect(AudioStub.instances[0].oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(520, 0)
  })
})
