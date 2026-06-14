'use client'

import { toast } from 'sonner'

type SpeakOptions = {
  voice?: string
  speed?: number
}

let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null

let audioUnlocked = false

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
  })
}

async function getFromCache(key: string): Promise<{ blob: Blob; timestamp: number } | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function saveToCache(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    // Evict oldest entries if at capacity
    await evictIfNeeded(db)
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ key, blob, timestamp: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // cache write failure is non-critical
  }
}

async function evictIfNeeded(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const countReq = store.count()
    countReq.onsuccess = () => {
      if (countReq.result < CACHE_MAX) {
        resolve()
        return
      }
      // Delete oldest entries (by timestamp index) to make room
      const idx = store.index('timestamp')
      let deleted = 0
      const toDelete = countReq.result - CACHE_MAX + 1
      const cursorReq = idx.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor && deleted < toDelete) {
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          resolve()
        }
      }
      cursorReq.onerror = () => resolve() // non-critical
    }
    countReq.onerror = () => resolve() // non-critical
  })
}

function makeCacheKey(input: string, voice?: string): string {
  return `${voice || 'default'}:${input.toLowerCase().trim()}`
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

function playAudio(audio: HTMLAudioElement, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  currentUrl = url
  audio.src = url
  audio.play().then(() => {
    audio.addEventListener('ended', () => stopSpeech(), { once: true })
  }).catch((playErr) => {
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

  // Unlock audio context so async play() works on mobile autoplay policy
  unlockAudio()

  // Create Audio element synchronously (user-gesture context) before async ops
  const audio = new Audio()
  currentAudio = audio

  const cacheKey = makeCacheKey(input, opts.voice)

  // 1. Try IndexedDB cache first
  try {
    const cached = await getFromCache(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      playAudio(audio, cached.blob)
      return
    }
  } catch {
    // cache read failure — continue to server fetch
  }

  // 2. Fetch from server
  let serverOk = false
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        voice: opts.voice,
        speed: opts.speed,
        response_format: 'wav',
      }),
    })

    if (res.ok) {
      serverOk = true
      const blob = await res.blob()

      // Save to IndexedDB (fire-and-forget)
      saveToCache(cacheKey, blob)

      playAudio(audio, blob)
      return
    }
  } catch {
    // server TTS network error — silently fallback
  }

  // 3. Fallback: browser speechSynthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(input)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  } else if (!serverOk) {
    toast.error('当前环境不支持语音播放')
  }
}
