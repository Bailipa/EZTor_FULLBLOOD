'use client'

type SpeakOptions = {
  voice?: string
  speed?: number
}

let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null

let audioUnlocked = false

export function unlockAudio(): void {
  if (audioUnlocked || typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as Record<string, unknown>).webkitAudioContext as typeof AudioContext
    if (AudioCtx) {
      const ctx = new AudioCtx()
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
      ctx.resume()
      audioUnlocked = true
    }
  } catch {
    // silent surface-level short noise buffer is non-critical
  }
}

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl)
    currentUrl = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  const input = (text || '').trim()
  if (!input) return

  stopSpeech()

  // Unlock audio context so async play() works on mobile autoplay policy
  unlockAudio()

  // Create Audio element synchronously (user-gesture context) before async fetch
  const audio = new Audio()
  currentAudio = audio

  // Prefer server-side Edge TTS (consistent voices), fallback to browser TTS.
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        voice: opts.voice,
        speed: opts.speed,
        response_format: 'mp3',
      }),
    })

    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      currentUrl = url
      audio.src = url

      await audio.play()
      audio.addEventListener(
        'ended',
        () => {
          stopSpeech()
        },
        { once: true },
      )
      return
    }
  } catch {
    // Server TTS failed, stop and fallback to browser TTS
    stopSpeech()
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(input)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }
}
