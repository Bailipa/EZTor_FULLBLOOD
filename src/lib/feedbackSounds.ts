import { isSpeechPlaying } from '@/lib/ttsBrowser'
import { readExperiencePreferences } from '@/lib/experiencePreferences'

let feedbackAudioContext: AudioContext | null = null

export function playSavedFeedbackSound(enabled: boolean): void {
  if (typeof window === 'undefined' || !enabled || document.visibilityState === 'hidden' || isSpeechPlaying()) return
  const volume = readExperiencePreferences().sfxVolume / 100
  if (volume <= 0 || typeof window.AudioContext === 'undefined') return

  try {
    feedbackAudioContext ??= new AudioContext()
    const context = feedbackAudioContext
    if (context.state === 'suspended') void context.resume().catch(() => {})
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(740, now)
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.07)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.12 * volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.15)
  } catch {
    // Sound is optional; the visible saved state remains authoritative.
  }
}
