interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  prev: string | null;
  next: string | null;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

const MAX_CACHE_ENTRIES = 10000;
const DEFAULT_TTL = 24 * 60 * 60 * 1000;
const CLEANUP_THRESHOLD = 0.8;
const MAX_ENTRY_SIZE = 100 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

class TranslationCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private head: string | null = null;
  private tail: string | null = null;
  private totalSize: number = 0;

  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.evictOldest(Math.floor(MAX_CACHE_ENTRIES * 0.2));
    }

    const now = Date.now();
    const entrySize = JSON.stringify(data).length;

    if (entrySize > MAX_ENTRY_SIZE) return;

    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.totalSize -= JSON.stringify(oldEntry.data).length;
      this.removeFromList(key);
    }

    const newEntry: CacheEntry<unknown> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      prev: null,
      next: null
    };

    this.cache.set(key, newEntry);
    this.addToHead(key);
    this.totalSize += entrySize;

    while (this.totalSize > MAX_TOTAL_SIZE) {
      this.evictOldest(1);
    }

    if (this.cache.size > MAX_CACHE_ENTRIES * CLEANUP_THRESHOLD) {
      this.cleanup();
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    this.removeFromList(key);
    this.addToHead(key);

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    if (!this.cache.has(key)) return false;

    const entry = this.cache.get(key)!;
    this.totalSize -= JSON.stringify(entry.data).length;
    this.removeFromList(key);
    this.cache.delete(key);

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.totalSize = 0;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      removed++;
    }

    return removed;
  }

  private evictOldest(count: number): void {
    let current = this.tail;
    let evicted = 0;

    while (current && evicted < count) {
      const nextTail = this.cache.get(current)?.prev;
      this.delete(current);
      current = nextTail ?? null;
      evicted++;
    }
  }

  private addToHead(key: string): void {
    const entry = this.cache.get(key)!;
    
    if (this.head) {
      const headEntry = this.cache.get(this.head)!;
      headEntry.prev = key;
      entry.next = this.head;
    }
    
    this.head = key;
    
    if (!this.tail) {
      this.tail = key;
    }
  }

  private removeFromList(key: string): void {
    const entry = this.cache.get(key)!;
    const { prev, next } = entry;

    if (prev) {
      const prevEntry = this.cache.get(prev)!;
      prevEntry.next = next;
    } else {
      this.head = next;
    }

    if (next) {
      const nextEntry = this.cache.get(next)!;
      nextEntry.prev = prev;
    } else {
      this.tail = prev;
    }

    entry.prev = null;
    entry.next = null;
  }

  getStats(): CacheStats {
    let oldest: number | null = null;
    let newest: number | null = null;

    if (this.tail) {
      oldest = this.cache.get(this.tail)?.timestamp || null;
    }

    if (this.head) {
      newest = this.cache.get(this.head)?.timestamp || null;
    }

    return {
      totalEntries: this.cache.size,
      totalSize: this.totalSize,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  pruneByAge(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let removed = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoff) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      removed++;
    }

    return removed;
  }
}

export const translationCache = new TranslationCache();

setInterval(() => {
  translationCache.cleanup();
}, 5 * 60 * 1000);

export function generateCacheKey(word: string, userId?: string): string {
  const normalizedWord = word.toLowerCase().trim();
  return userId ? `${userId}:${normalizedWord}` : `public:${normalizedWord}`;
}

export function getCachedTranslation<T>(key: string): T | null {
  return translationCache.get<T>(key);
}

export function setCachedTranslation<T>(key: string, data: T, ttl?: number): void {
  translationCache.set(key, data, ttl);
}

export function getCacheStats(): CacheStats {
  return translationCache.getStats();
}

export function cleanupCache(): number {
  return translationCache.cleanup();
}

export function clearCache(): void {
  translationCache.clear();
}

setInterval(() => {
  translationCache.cleanup();
}, 5 * 60 * 1000);
