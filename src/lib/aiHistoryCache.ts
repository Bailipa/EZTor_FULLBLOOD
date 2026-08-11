'use client'

// AI 对话历史缓存：localStorage 按用户隔离存储（stateless 架构下客户端历史自存）
// key 以固定前缀开头，便于 me 页按前缀统计所有用户的 AI 缓存占用。

export const AI_HISTORY_PREFIX = 'eztor_ai_history_'
export const AI_HISTORY_MAX_ITEMS = 100

export function aiHistoryKey(userId: string): string {
  return `${AI_HISTORY_PREFIX}${userId}`
}

/** 返回所有 AI 历史缓存 key 及其字节数 */
export function getAiHistoryEntries(): { key: string; bytes: number }[] {
  const entries: { key: string; bytes: number }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(AI_HISTORY_PREFIX)) {
        const raw = localStorage.getItem(key) ?? ''
        entries.push({ key, bytes: raw.length * 2 }) // JS 字符串按 UTF-16 计 2 字节/字符
      }
    }
  } catch {
    // ignore
  }
  return entries
}

export function getAiHistoryBytes(): number {
  return getAiHistoryEntries().reduce((sum, e) => sum + e.bytes, 0)
}

export function clearAiHistory(userId?: string): { removed: number; keys: string[] } {
  const targets = userId ? [{ key: aiHistoryKey(userId) }] : getAiHistoryEntries()
  let removed = 0
  const keys: string[] = []
  try {
    for (const t of targets) {
      const raw = localStorage.getItem(t.key)
      if (raw) {
        removed += raw.length * 2
        localStorage.removeItem(t.key)
        keys.push(t.key)
      }
    }
  } catch {
    // ignore
  }
  return { removed, keys }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
