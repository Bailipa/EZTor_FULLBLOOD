'use client'

type SpeakOptions = {
  voice?: string
  speed?: number
}

let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null

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
      const audio = new Audio(url)
      currentAudio = audio
      currentUrl = url

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
    // ignore and fallback
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(input)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }
}
