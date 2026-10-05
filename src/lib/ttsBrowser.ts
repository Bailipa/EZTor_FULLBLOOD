'use client'

import { toast } from 'sonner'
import { readExperiencePreferences } from '@/lib/experiencePreferences'

type SpeakOptions = {
  voice?: string
  speed?: number
  volume?: number
}

let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null

let audioUnlocked = false
let playbackGeneration = 0
let playbackController: AbortController | null = null
const FETCH_TIMEOUT_MS = 20000
const pendingAudio = new Map<string, {
  promise: Promise<Blob>
  controller: AbortController
  consumers: number
}>()

export function isSpeechPlaying(): boolean {
  return Boolean(currentAudio && !currentAudio.paused) || Boolean(
    typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking,
  )
}

// --- IndexedDB TTS Cache ---
const DB_NAME = 'tts-cache'
const DB_VERSION = 1
const STORE_NAME = 'audio'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
const CACHE_MAX = 500

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

async function getFromCache(key: string): Promise<{ blob: Blob; timestamp: number } | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch {
    return null
  }
}

async function saveToCache(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ key, blob, timestamp: Date.now() })
      const countReq = store.count()
      countReq.onsuccess = () => {
        let remaining = countReq.result - CACHE_MAX
        if (remaining <= 0) return
        const cursorReq = store.index('timestamp').openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (cursor && remaining-- > 0) {
            cursor.delete()
            cursor.continue()
          }
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch {
    // cache write failure is non-critical
  }
}

function makeCacheKey(input: string, voice?: string): string {
  return JSON.stringify(['mp3-v2', voice?.trim() || 'default', input.trim()])
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function loadAudio(input: string, opts: SpeakOptions, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted) return Promise.reject(abortError())
  const key = makeCacheKey(input, opts.voice)
  let pending = pendingAudio.get(key)
  if (!pending) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const promise = (async () => {
      const cached = await getFromCache(key)
      if (controller.signal.aborted) throw abortError()
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.blob
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, voice: opts.voice, response_format: 'mp3' }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`)
      const blob = await res.blob()
      if (controller.signal.aborted) throw abortError()
      if (!blob.size) throw new Error('TTS returned empty audio')
      void saveToCache(key, blob)
      return blob
    })().finally(() => {
      clearTimeout(timeout)
      if (pendingAudio.get(key)?.controller === controller) pendingAudio.delete(key)
    })
    pending = { promise, controller, consumers: 0 }
    pendingAudio.set(key, pending)
  }
  const request = pending
  request.consumers++
  return new Promise((resolve, reject) => {
    let released = false
    const release = () => {
      if (released) return
      released = true
      signal.removeEventListener('abort', onAbort)
      request.controller.signal.removeEventListener('abort', onAbort)
      if (--request.consumers === 0) {
        if (pendingAudio.get(key) === request) pendingAudio.delete(key)
        request.controller.abort()
      }
    }
    const onAbort = () => { release(); reject(abortError()) }
    signal.addEventListener('abort', onAbort, { once: true })
    request.controller.signal.addEventListener('abort', onAbort, { once: true })
    request.promise.then((blob) => {
      if (signal.aborted) reject(abortError())
      else resolve(blob)
      release()
    }, (error: unknown) => { reject(error); release() })
  })
}

export async function preloadSpeech(text: string, signal: AbortSignal): Promise<void> {
  const input = (text || '').trim()
  if (!input || signal.aborted) return
  try {
    await loadAudio(input, {}, signal)
  } catch {
    // Preloading is optional; playback retries or falls back when needed.
  }
}

// --- Audio unlock & controls ---

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
  playbackGeneration++
  playbackController?.abort()
  playbackController = null
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

function playAudio(audio: HTMLAudioElement, blob: Blob, volume: number, generation: number): void {
  if (generation !== playbackGeneration || currentAudio !== audio) return
  const url = URL.createObjectURL(blob)
  currentUrl = url
  audio.src = url
  audio.volume = volume
  audio.addEventListener('ended', () => {
    if (generation === playbackGeneration && currentAudio === audio) stopSpeech()
  }, { once: true })
  audio.play().catch((playErr) => {
    if (generation !== playbackGeneration || currentAudio !== audio) return
    const msg = playErr instanceof Error ? playErr.name : String(playErr)
    stopSpeech()
    if (msg === 'NotAllowedError' || msg.includes('NotAllowed')) {
      toast.error('播放被浏览器拦截，请再次点击发音按钮')
    } else if (msg === 'NotSupportedError' || msg.includes('NotSupported')) {
      toast.error('浏览器不支持此音频格式')
    }
  })
}

export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  const input = (text || '').trim()
  if (!input) return
  stopSpeech()
  const generation = playbackGeneration
  const controller = new AbortController()
  playbackController = controller

  // Keep audio creation and unlock in the initiating user gesture.
  unlockAudio()
  const audio = new Audio()
  currentAudio = audio
  const savedVolume = readExperiencePreferences().speechVolume / 100
  const volume = Math.max(0, Math.min(1, opts.volume ?? savedVolume))
  try {
    const blob = await loadAudio(input, opts, controller.signal)
    playAudio(audio, blob, volume, generation)
    return
  } catch {
    if (controller.signal.aborted || generation !== playbackGeneration) return
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(input)
    utterance.lang = 'en-US'
    utterance.volume = volume
    window.speechSynthesis.speak(utterance)
  } else {
    toast.error('当前环境不支持语音播放')
  }
}
