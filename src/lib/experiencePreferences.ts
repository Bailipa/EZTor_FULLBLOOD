export type HapticMode = 'off' | 'light' | 'standard'
export type MotionMode = 'system' | 'reduce' | 'full'
export type GlowMode = 'rich' | 'subdued'

export interface ExperiencePreferences {
  sfxVolume: number
  speechVolume: number
  autoSpeak: boolean
  haptics: HapticMode
  motion: MotionMode
  glow: GlowMode
  showPhonetic: boolean
  showPos: boolean
  showExample: boolean
}

const STORAGE_KEY = 'eztor-experience-preferences-v1'

export const defaultExperiencePreferences: ExperiencePreferences = {
  sfxVolume: 30,
  speechVolume: 100,
  autoSpeak: false,
  haptics: 'off',
  motion: 'system',
  glow: 'rich',
  showPhonetic: true,
  showPos: true,
  showExample: true,
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback
}

export function readExperiencePreferences(): ExperiencePreferences {
  if (typeof window === 'undefined') return defaultExperiencePreferences
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) as Partial<ExperiencePreferences> : {}
    const oldHaptics = localStorage.getItem('eztor-haptics') === 'true' ? 'light' : 'off'
    return {
      sfxVolume: clampVolume(stored.sfxVolume, defaultExperiencePreferences.sfxVolume),
      speechVolume: clampVolume(stored.speechVolume, defaultExperiencePreferences.speechVolume),
      autoSpeak: typeof stored.autoSpeak === 'boolean' ? stored.autoSpeak : defaultExperiencePreferences.autoSpeak,
      haptics: stored.haptics === 'light' || stored.haptics === 'standard' || stored.haptics === 'off'
        ? stored.haptics
        : oldHaptics,
      motion: stored.motion === 'reduce' || stored.motion === 'full' || stored.motion === 'system'
        ? stored.motion
        : defaultExperiencePreferences.motion,
      glow: stored.glow === 'subdued' || stored.glow === 'rich' ? stored.glow : defaultExperiencePreferences.glow,
      showPhonetic: typeof stored.showPhonetic === 'boolean' ? stored.showPhonetic : defaultExperiencePreferences.showPhonetic,
      showPos: typeof stored.showPos === 'boolean' ? stored.showPos : defaultExperiencePreferences.showPos,
      showExample: typeof stored.showExample === 'boolean' ? stored.showExample : defaultExperiencePreferences.showExample,
    }
  } catch {
    return defaultExperiencePreferences
  }
}

export function saveExperiencePreferences(patch: Partial<ExperiencePreferences>): ExperiencePreferences {
  const next = { ...readExperiencePreferences(), ...patch }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      localStorage.setItem('eztor-haptics', String(next.haptics !== 'off'))
      localStorage.setItem('eztor-motion', next.motion)
    } catch {
      // Device preferences remain usable for the current view if storage is unavailable.
    }
    if (next.motion === 'system') document.documentElement.removeAttribute('data-motion')
    else document.documentElement.setAttribute('data-motion', next.motion)
    if (next.glow === 'rich') document.documentElement.removeAttribute('data-glow')
    else document.documentElement.setAttribute('data-glow', next.glow)
  }
  return next
}

export function isHapticFeedbackAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const bridge = (window as Window & { AndroidFeedback?: { getVersion?: () => number } }).AndroidFeedback
  return Boolean((bridge?.getVersion?.() ?? 0) >= 2 || typeof navigator.vibrate === 'function')
}
