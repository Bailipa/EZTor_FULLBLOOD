import { triggerHapticFeedback } from '@/lib/hapticFeedback'
import { playSavedFeedbackSound } from '@/lib/feedbackSounds'

let timer: ReturnType<typeof setTimeout> | null = null
let pendingSoundEnabled = false
let lastFeedbackAt = 0

export function scheduleSavedFeedback(soundEnabled: boolean): void {
  pendingSoundEnabled ||= soundEnabled
  if (timer) return

  const delay = Math.max(160, 900 - (Date.now() - lastFeedbackAt))
  timer = setTimeout(() => {
    timer = null
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pendingSoundEnabled = false
      return
    }
    triggerHapticFeedback('saved')
    if (pendingSoundEnabled) playSavedFeedbackSound(true)
    pendingSoundEnabled = false
    lastFeedbackAt = Date.now()
  }, delay)
}
