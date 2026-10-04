import { readExperiencePreferences } from '@/lib/experiencePreferences'

export type HapticEvent = 'correct' | 'incorrect' | 'saved' | 'error'

export function triggerHapticFeedback(event: HapticEvent): void {
  if (typeof window === 'undefined') return
  const mode = readExperiencePreferences().haptics
  if (mode === 'off') return

  const bridge = (window as Window & {
    AndroidFeedback?: { getVersion?: () => number; pulse?: (eventName: string, intensity: string) => void }
  }).AndroidFeedback

  try {
    if (bridge?.getVersion?.() === 2 && bridge.pulse) {
      bridge.pulse(event, mode)
      return
    }
    if (typeof navigator.vibrate !== 'function') return
    const duration = mode === 'light' ? 10 : event === 'incorrect' ? 20 : 18
    navigator.vibrate(duration)
  } catch {
    // Haptics are optional; lack of device support must not block a task.
  }
}
