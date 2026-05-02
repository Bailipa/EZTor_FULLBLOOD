import { loadFromStorage, saveToStorage } from '@/lib/storage'

export interface HistoryEntry {
  id: string
  input: string
  output: string
  optimized: boolean
  timestamp: number
}

const STORAGE_KEY = 'vocab_translate_history'
const MAX_ENTRIES = 50

let idCounter = 0

function generateId(): string {
  idCounter++
  return `${Date.now()}_${idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

export function loadHistory(): HistoryEntry[] {
  return loadFromStorage<HistoryEntry[]>(STORAGE_KEY, [])
}

export function addHistoryEntry(
  input: string,
  output: string,
  optimized: boolean,
  existingHistory?: HistoryEntry[],
): HistoryEntry[] {
  const history = existingHistory ?? loadHistory()
  const entry: HistoryEntry = {
    id: generateId(),
    input,
    output,
    optimized,
    timestamp: Date.now(),
  }
  history.unshift(entry)
  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES
  }
  saveToStorage(STORAGE_KEY, history)
  return history
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const history = loadHistory().filter((e) => e.id !== id)
  saveToStorage(STORAGE_KEY, history)
  return history
}

export function clearHistory(): void {
  saveToStorage<HistoryEntry[]>(STORAGE_KEY, [])
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

export function formatTime(t: number): string {
  return formatRelativeTime(t)
}
