import { isSpeechPlaying } from '@/lib/ttsBrowser'
import { readExperiencePreferences } from '@/lib/experiencePreferences'

export type FeedbackSound = 'tap' | 'navigate' | 'select' | 'submit' | 'success' | 'error' | 'saved' | 'swipe' | 'menu-open' | 'menu-close'

const cues: Record<FeedbackSound, { frequencies: number[]; duration: number; gain: number }> = {
  tap: { frequencies: [560, 640], duration: 0.055, gain: 0.07 },
  navigate: { frequencies: [520, 780], duration: 0.09, gain: 0.09 },
  select: { frequencies: [680, 820], duration: 0.065, gain: 0.08 },
  submit: { frequencies: [440, 660], duration: 0.11, gain: 0.09 },
  success: { frequencies: [660, 880, 1040], duration: 0.18, gain: 0.11 },
  error: { frequencies: [340, 260], duration: 0.16, gain: 0.09 },
  saved: { frequencies: [740, 880], duration: 0.14, gain: 0.12 },
  swipe: { frequencies: [460, 720], duration: 0.085, gain: 0.08 },
  'menu-open': { frequencies: [420, 630], duration: 0.1, gain: 0.08 },
  'menu-close': { frequencies: [630, 420], duration: 0.09, gain: 0.07 },
}

let feedbackAudioContext: AudioContext | null = null
let activeSound: { oscillator: OscillatorNode; gain: GainNode } | null = null
let activeCharge: { oscillator: OscillatorNode; gain: GainNode } | null = null
let chargeRevision = 0
let soundEnabled = false
let soundRevision = 0
let lastPlayedAt = -Infinity
let lastResultAt = -Infinity
let lastResult: 'success' | 'error' | null = null

export function setFeedbackSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
  if (!enabled) { stopActiveSound(); stopRadialChargeSound() }
}

export function getFeedbackSoundRevision(): number {
  return soundRevision
}

function stopActiveSound(): void {
  if (!activeSound) return
  try {
    activeSound.oscillator.stop()
  } catch {
    // The cue may already have ended.
  }
  activeSound.oscillator.disconnect()
  activeSound.gain.disconnect()
  activeSound = null
}

export function stopRadialChargeSound(): void {
  chargeRevision += 1
  const charge = activeCharge
  activeCharge = null
  if (!charge) return
  try { charge.gain.gain.cancelScheduledValues(0); charge.gain.gain.setTargetAtTime(0.0001, charge.oscillator.context.currentTime, 0.015); charge.oscillator.stop(charge.oscillator.context.currentTime + 0.06) } catch { /* cue may already have ended */ }
}

export function startRadialChargeSound(): void {
  stopRadialChargeSound()
  if (typeof window === 'undefined' || !soundEnabled || document.visibilityState === 'hidden' || isSpeechPlaying() || readExperiencePreferences().sfxVolume <= 0) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce') return
  try {
    const unlocking = unlockFeedbackAudio()
    const context = feedbackAudioContext
    if (!context) return
    const revision = chargeRevision
    const begin = () => {
      if (revision !== chargeRevision || !soundEnabled || context.state !== 'running') return
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const charge = { oscillator, gain }
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(118, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.035 * (readExperiencePreferences().sfxVolume / 100), now + 0.04)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); if (activeCharge === charge) activeCharge = null }
      activeCharge = charge
      oscillator.start(now)
    }
    if (context.state === 'running') begin()
    else void unlocking?.then(begin)
  } catch { /* Sound is optional. */ }
}

// Called during a real user gesture so Safari and native WebViews can unlock audio.
export function unlockFeedbackAudio(): Promise<void> | undefined {
  if (typeof window === 'undefined' || !soundEnabled || feedbackAudioContext?.state === 'running' || readExperiencePreferences().sfxVolume <= 0) return
  try {
    if (typeof window.AudioContext === 'undefined') return
    feedbackAudioContext ??= new window.AudioContext()
    if (feedbackAudioContext.state === 'suspended') return feedbackAudioContext.resume().catch(() => {})
  } catch {
    // Feedback must never interrupt the operation.
  }
}

export function playFeedbackSound(event: FeedbackSound): void {
  soundRevision += 1
  if (typeof window === 'undefined' || !soundEnabled || document.visibilityState === 'hidden' || isSpeechPlaying()) return
  const volume = readExperiencePreferences().sfxVolume / 100
  if (volume <= 0) return
  const nowMs = performance.now()
  const isResult = event === 'success' || event === 'error' || event === 'saved'
  const result = event === 'error' ? 'error' : 'success'
  if (isResult ? nowMs - lastResultAt < 450 && (result === lastResult || lastResult === 'error') : nowMs - lastPlayedAt < 80) return

  try {
    const unlocking = unlockFeedbackAudio()
    const context = feedbackAudioContext
    if (!context) return
    if (context.state !== 'running') {
      const revision = soundRevision
      void unlocking?.then(() => {
        if (context.state === 'running' && revision === soundRevision && performance.now() - nowMs < 200) playFeedbackSound(event)
      })
      return
    }
    stopActiveSound()
    const cue = cues[event]
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const sound = { oscillator, gain }
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(cue.frequencies[0], now)
    cue.frequencies.slice(1).forEach((frequency, index) => {
      oscillator.frequency.exponentialRampToValueAtTime(frequency, now + cue.duration * (index + 1) / (cue.frequencies.length - 1))
    })
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(cue.gain * volume, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
      if (activeSound === sound) activeSound = null
    }
    activeSound = sound
    oscillator.start(now)
    oscillator.stop(now + cue.duration + 0.01)
    lastPlayedAt = nowMs
    if (isResult) {
      lastResultAt = nowMs
      lastResult = result
    }
  } catch {
    // Sound is optional; the visible operation state remains authoritative.
  }
}

export function playSavedFeedbackSound(enabled: boolean): void {
  if (enabled) playFeedbackSound('saved')
}
