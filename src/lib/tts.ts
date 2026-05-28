import { logger } from '@/lib/logger'

const MIMO_API_KEY = process.env.MIMO_API_KEY || ''
const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const MIMO_MODEL = 'mimo-v2-tts'
const MIMO_VOICE = process.env.MIMO_VOICE || 'default_en'

export type TtsResponseFormat = 'wav'

export type TtsRequest = {
  input: string
  voice?: string
  speed?: number
  response_format?: TtsResponseFormat
  signal?: AbortSignal
}

const MAX_INPUT_LENGTH = 500
const TTS_TIMEOUT_MS = 15000
const MAX_RETRIES = 1
const RETRY_DELAY_MS = 500

// LRU 缓存
const CACHE_MAX = parseInt(process.env.TTS_CACHE_MAX || '200', 10)
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

interface CacheEntry {
  buffer: Buffer
  ts: number
}

const ttsCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, Promise<Response>>()

// 每 5 分钟清理过期条目
const cleanupInterval = setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of ttsCache) {
      if (now - entry.ts > CACHE_TTL) ttsCache.delete(key)
    }
  },
  5 * 60 * 1000,
)

// 防止 Node.js 进程因定时器无法退出
if (cleanupInterval.unref) cleanupInterval.unref()

function getCacheKey(input: string, voice: string): string {
  return `${voice}:${input.toLowerCase().trim()}`
}

function getFromCache(key: string): Buffer | null {
  const entry = ttsCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    ttsCache.delete(key)
    return null
  }
  // LRU: 移到末尾
  ttsCache.delete(key)
  ttsCache.set(key, entry)
  return entry.buffer
}

function setCache(key: string, buffer: Buffer): void {
  if (ttsCache.size >= CACHE_MAX) {
    const firstKey = ttsCache.keys().next().value
    if (firstKey) ttsCache.delete(firstKey)
  }
  ttsCache.set(key, { buffer, ts: Date.now() })
}

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

async function doSynthesize(
  input: string,
  voice: string,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<Response> {
  const abortController = new AbortController()
  const timeoutId = setTimeout(
    () => abortController.abort(new DOMException('TTS request timed out', 'TimeoutError')),
    TTS_TIMEOUT_MS,
  )

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
        setCache(cacheKey, audioBuffer)

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

export async function synthesizeSpeech(req: TtsRequest): Promise<Response> {
  const input = (req.input || '').trim()
  if (!input) throw new Error('input is required')
  if (input.length > MAX_INPUT_LENGTH)
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`)

  if (!MIMO_API_KEY) {
    throw new Error('MIMO_API_KEY is not configured')
  }

  const voice = (req.voice || '').trim() || MIMO_VOICE
  const cacheKey = getCacheKey(input, voice)

  // 1. 缓存命中
  const cached = getFromCache(cacheKey)
  if (cached) {
    return new Response(new Uint8Array(cached), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(cached.length),
      },
    })
  }

  // 2. 并发去重
  const pending = pendingRequests.get(cacheKey)
  if (pending) return pending

  // 3. 新请求
  const promise = doSynthesize(input, voice, cacheKey, req.signal)
  pendingRequests.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    pendingRequests.delete(cacheKey)
  }
}
