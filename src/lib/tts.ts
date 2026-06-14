import { logger } from '@/lib/logger'
import { EdgeTTS } from 'node-edge-tts'
import { readFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const EDGE_VOICE = process.env.EDGE_TTS_VOICE || 'en-US-AriaNeural'
const EDGE_LANG = process.env.EDGE_TTS_LANG || 'en-US'

export type TtsResponseFormat = 'mp3'

export type TtsRequest = {
  input: string
  voice?: string
  speed?: number
  response_format?: TtsResponseFormat
  signal?: AbortSignal
}

const MAX_INPUT_LENGTH = 500
const TTS_TIMEOUT_MS = 15000

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

async function synthesizeWithEdgeTTS(
  input: string,
  voice: string,
): Promise<Buffer> {
  const tts = new EdgeTTS({
    voice,
    lang: EDGE_LANG,
    outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    timeout: TTS_TIMEOUT_MS,
  })

  const tempDir = mkdtempSync(join(tmpdir(), 'tts-'))
  const tempFile = join(tempDir, 'audio.mp3')

  try {
    await tts.ttsPromise(input, tempFile)
    return readFileSync(tempFile)
  } finally {
    try {
      unlinkSync(tempFile)
      unlinkSync(tempDir)
    } catch {
      // cleanup errors are non-critical
    }
  }
}

export async function synthesizeSpeech(req: TtsRequest): Promise<Response> {
  const input = (req.input || '').trim()
  if (!input) throw new Error('input is required')
  if (input.length > MAX_INPUT_LENGTH)
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`)

  const voice = (req.voice || '').trim() || EDGE_VOICE
  const cacheKey = getCacheKey(input, voice)

  // 1. 缓存命中
  const cached = getFromCache(cacheKey)
  if (cached) {
    return new Response(new Uint8Array(cached), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(cached.length),
      },
    })
  }

  // 2. 并发去重
  const pending = pendingRequests.get(cacheKey)
  if (pending) return pending

  // 3. 新请求
  const promise = (async () => {
    try {
      const audioBuffer = await synthesizeWithEdgeTTS(input, voice)
      setCache(cacheKey, audioBuffer)

      return new Response(new Uint8Array(audioBuffer), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.length),
        },
      })
    } catch (err: unknown) {
      logger.error({ err }, '[TTS] Edge TTS failed')
      throw err instanceof Error ? err : new Error(String(err))
    }
  })()

  pendingRequests.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    pendingRequests.delete(cacheKey)
  }
}
