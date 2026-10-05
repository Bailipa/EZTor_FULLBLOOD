import { logger } from '@/lib/logger'
import { EdgeTTS } from 'node-edge-tts'
import { randomBytes } from 'crypto'

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
const pendingRequests = new Map<string, Promise<Buffer>>()

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
  return JSON.stringify([voice, EDGE_LANG, 'audio-24khz-96kbitrate-mono-mp3', input.trim()])
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

  // node-edge-tts 1.2.10's file API rejects on timeout without closing its
  // socket/write stream. Reuse its internal connection/config protocol and
  // preserve its SSML defaults; recheck this adapter when upgrading the library.
  // Collect MP3 in memory to avoid creating files that can outlive a timeout.
  return new Promise((resolve, reject) => {
    let socket: Awaited<ReturnType<EdgeTTS['_connectWebSocket']>> | undefined
    let settled = false
    const chunks: Buffer[] = []
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      socket?.terminate()
      if (error) reject(error)
      else resolve(Buffer.concat(chunks))
    }
    const timeout = setTimeout(() => finish(new Error('TTS timed out')), TTS_TIMEOUT_MS)
    void tts._connectWebSocket().then((connected) => {
      socket = connected
      if (settled) {
        socket.terminate()
        return
      }
      socket.on('error', (error) => finish(error))
      socket.on('close', () => finish(new Error('TTS connection closed before audio completed')))
      socket.on('message', (data, isBinary) => {
        if (settled) return
        if (isBinary) {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
          if (buffer.length < 2) {
            finish(new Error('Invalid TTS audio header'))
            return
          }
          const audioOffset = 2 + buffer.readUInt16BE(0)
          if (audioOffset > buffer.length) {
            finish(new Error('Invalid TTS audio header length'))
            return
          }
          const headers = buffer.subarray(2, audioOffset).toString()
          if (headers.split('\r\n').some((header) => header === 'Path:audio') && audioOffset < buffer.length) {
            chunks.push(buffer.subarray(audioOffset))
          }
        } else if (data.toString().includes('Path:turn.end')) {
          finish(chunks.length ? undefined : new Error('TTS returned empty audio'))
        }
      })
      const escapedInput = input.replace(/[<>&"']/g, (character) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
      })[character]!)
      const requestId = randomBytes(16).toString('hex')
      // Match node-edge-tts 1.2.10's SSML, including its prosody defaults.
      socket.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n
      ` + `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${EDGE_LANG}">
        <voice name="${voice}">
          <prosody rate="default" pitch="default" volume="default">
            ${escapedInput}
          </prosody>
        </voice>
      </speak>`, (error) => { if (error) finish(error) })
    }).catch((error: unknown) => finish(error instanceof Error ? error : new Error(String(error))))
  })
}

function waitForAudio(promise: Promise<Buffer>, signal?: AbortSignal): Promise<Buffer> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

export async function synthesizeSpeech(req: TtsRequest): Promise<Response> {
  const input = (req.input || '').trim()
  if (!input) throw new Error('input is required')
  if (input.length > MAX_INPUT_LENGTH)
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`)

  const voice = (req.voice || '').trim() || EDGE_VOICE
  const cacheKey = getCacheKey(input, voice)

  if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  let audioBuffer = getFromCache(cacheKey)
  if (!audioBuffer) {
    let pending = pendingRequests.get(cacheKey)
    if (!pending) {
      pending = synthesizeWithEdgeTTS(input, voice).then((buffer) => {
        setCache(cacheKey, buffer)
        return buffer
      }).catch((err: unknown) => {
        logger.error({ err }, '[TTS] Edge TTS failed')
        throw err instanceof Error ? err : new Error(String(err))
      }).finally(() => pendingRequests.delete(cacheKey))
      pendingRequests.set(cacheKey, pending)
    }
    // A disconnected caller stops waiting without cancelling other consumers.
    audioBuffer = await waitForAudio(pending, req.signal)
  }
  return new Response(new Uint8Array(audioBuffer), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBuffer.length),
    },
  })
}
