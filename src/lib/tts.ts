const TTS_PROXY_URL = process.env.TTS_PROXY_URL || 'http://localhost:5050/v1/audio/speech'
const TTS_PROXY_API_KEY = process.env.TTS_PROXY_API_KEY || ''

export type TtsResponseFormat = 'mp3'

export type TtsRequest = {
  input: string
  voice?: string
  speed?: number // 0.5 ~ 2.0
  response_format?: TtsResponseFormat
  signal?: AbortSignal
}

const MAX_INPUT_LENGTH = 500
const TTS_TIMEOUT_MS = 30000

const DEFAULT_VOICE = 'en-US-GuyNeural'

function clampSpeed(speed: number | undefined): number {
  if (!Number.isFinite(speed)) return 1
  return Math.min(2, Math.max(0.5, speed!))
}

function normalizeVoice(voice: string | undefined): string {
  const v = (voice || '').trim()
  return v || DEFAULT_VOICE
}

export async function synthesizeSpeech(req: TtsRequest): Promise<Response> {
  const input = (req.input || '').trim()
  if (!input) throw new Error('input is required')
  if (input.length > MAX_INPUT_LENGTH)
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`)

  const voice = normalizeVoice(req.voice)
  const speed = clampSpeed(req.speed)

  const abortController = new AbortController()
  const timeoutId = setTimeout(
    () => abortController.abort(new DOMException('TTS request timed out', 'TimeoutError')),
    TTS_TIMEOUT_MS,
  )

  const signal = req.signal
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId)
      abortController.abort(signal.reason)
    } else {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeoutId)
          abortController.abort(signal.reason)
        },
        { once: true },
      )
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (TTS_PROXY_API_KEY) headers['Authorization'] = `Bearer ${TTS_PROXY_API_KEY}`

  const response = await fetch(TTS_PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input, voice, speed, response_format: 'mp3' }),
    signal: abortController.signal,
  })

  clearTimeout(timeoutId)

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(`TTS proxy error: ${body.error || response.statusText}`)
  }

  return response
}
