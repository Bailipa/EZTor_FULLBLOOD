import { logger } from '@/lib/logger'

const MIMO_API_KEY = process.env.MIMO_API_KEY || ''
const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const MIMO_MODEL = 'mimo-v2.5-tts'
const MIMO_VOICE = process.env.MIMO_VOICE || 'Chloe'

export type TtsResponseFormat = 'wav'

export type TtsRequest = {
  input: string
  voice?: string
  speed?: number
  response_format?: TtsResponseFormat
  signal?: AbortSignal
}

const MAX_INPUT_LENGTH = 500
const TTS_TIMEOUT_MS = 30000
const MAX_RETRIES = 1
const RETRY_DELAY_MS = 500

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

async function callMiMo(
  input: string,
  voice: string,
  signal?: AbortSignal,
): Promise<Response> {
  const body = {
    model: MIMO_MODEL,
    messages: [
      {
        role: 'user' as const,
        content: 'Read this word or phrase in natural English. Standard American accent, normal pace.',
      },
      {
        role: 'assistant' as const,
        content: input,
      },
    ],
    audio: {
      format: 'wav',
      voice,
    },
  }

  return fetch(MIMO_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': MIMO_API_KEY,
    },
    body: JSON.stringify(body),
    signal,
  })
}

export async function synthesizeSpeech(req: TtsRequest): Promise<Response> {
  const input = (req.input || '').trim()
  if (!input) throw new Error('input is required')
  if (input.length > MAX_INPUT_LENGTH)
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`)

  if (!MIMO_API_KEY) {
    throw new Error('MIMO_API_KEY is not configured')
  }

  const voice = (req.voice || '').trim() || MIMO_VOICE

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

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      logger.info({ attempt }, '[TTS] Retrying MiMo TTS')
      await sleep(RETRY_DELAY_MS, abortController.signal)
    }

    try {
      const response = await callMiMo(input, voice, abortController.signal)

      if (response.ok) {
        clearTimeout(timeoutId)
        const data = await response.json()
        const audioData = data?.choices?.[0]?.message?.audio?.data
        if (!audioData) {
          throw new Error('MiMo TTS returned no audio data')
        }

        const audioBuffer = Buffer.from(audioData, 'base64')

        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': String(audioBuffer.length),
          },
        })
      }

      const errBody = await response.json().catch(() => ({ error: response.statusText }))
      lastError = new Error(
        `MiMo TTS error: ${errBody.error?.message || errBody.error || response.statusText}`,
      )

      if (response.status >= 400 && response.status < 500) {
        break
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        clearTimeout(timeoutId)
        throw err
      }
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  clearTimeout(timeoutId)
  throw lastError || new Error('MiMo TTS failed after retries')
}
