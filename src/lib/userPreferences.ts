'use client'

import { equalMinimalFeatures, type MinimalFeatures } from '@/lib/minimalFeatures'
import type { InterfaceStyle } from '@/lib/interfaceStyle'

export type UserPreferences = {
  dailyGoal: number
  reviewReminderEnabled: boolean
  reviewReminderTime: string | null
  autoSaveWords: boolean
  soundEffectsEnabled: boolean
  minimalFeatures: MinimalFeatures | null
  interfaceStyle: InterfaceStyle
  showImportExportActions: boolean
}

type Listener = { keys: (keyof UserPreferences)[]; apply: (data: UserPreferences) => void }
type Entry = {
  data?: UserPreferences
  expiresAt: number
  revision: number
  pending?: Promise<UserPreferences>
  listeners: Set<Listener>
}

const entries = new Map<string, Entry>()
const CACHE_MS = 60_000

function entryFor(userId: string): Entry {
  let entry = entries.get(userId)
  if (!entry) {
    // Retain active consumers; bound the cache for accounts no longer on screen.
    for (const [id, candidate] of entries) {
      if (!candidate.listeners.size && !candidate.pending && (candidate.expiresAt <= Date.now() || entries.size >= 5)) entries.delete(id)
    }
    entry = { expiresAt: 0, revision: 0, listeners: new Set() }
    entries.set(userId, entry)
  }
  return entry
}

export function readUserPreferences(userId: string, signal?: AbortSignal): Promise<UserPreferences> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  const entry = entryFor(userId)
  let request: Promise<UserPreferences>
  if (entry.data && entry.expiresAt > Date.now()) {
    request = Promise.resolve(entry.data)
  } else {
    if (!entry.pending) {
      const revision = entry.revision
      entry.pending = fetch('/api/preferences')
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok || !result.success || !result.data || result.accountId !== userId) throw new Error('Preferences read failed')
          // A committed save wins over a GET started before it.
          if (entry.revision !== revision && entry.data) return entry.data
          const data = result.data as UserPreferences
          if (entry.listeners.size) {
            entry.data = data
            entry.expiresAt = Date.now() + CACHE_MS
          }
          return data
        })
        .catch((error) => {
          if (entry.revision !== revision && entry.data) return entry.data
          throw error
        })
        .finally(() => { entry.pending = undefined })
    }
    request = entry.pending
  }
  if (!signal) return request
  // Cancel only this consumer, without aborting a request other consumers need.
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    request.then(
      (data) => { if (!signal.aborted) resolve(data) },
      (error) => { if (!signal.aborted) reject(error) },
    ).finally(() => signal.removeEventListener('abort', abort))
  })
}

export function subscribeUserPreferences(userId: string, keys: (keyof UserPreferences)[], apply: Listener['apply']): () => void {
  const entry = entryFor(userId)
  const listener = { keys, apply }
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
    // Wait for synchronous remounts; discard the account when its last consumer leaves.
    queueMicrotask(() => {
      if (!entry.listeners.size && entries.get(userId) === entry) entries.delete(userId)
    })
  }
}

/** Publish only the server response of a successful save, never an optimistic draft. */
export function commitUserPreferences(userId: string, data: UserPreferences): void {
  const entry = entryFor(userId)
  const previous = entry.data
  entry.data = data
  entry.expiresAt = Date.now() + CACHE_MS
  entry.revision += 1
  for (const listener of entry.listeners) {
    if (!previous || listener.keys.some((key) => key === 'minimalFeatures'
      ? previous[key] !== data[key] && !equalMinimalFeatures(previous[key], data[key]) : previous[key] !== data[key])) listener.apply(data)
  }
}
