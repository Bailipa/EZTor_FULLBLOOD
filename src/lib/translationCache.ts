interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
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

class TranslationCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private accessOrder: string[] = [];

  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      this.evictOldest(Math.floor(MAX_CACHE_ENTRIES * 0.2));
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });

    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);

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

    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);

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
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        removed++;
      }
    }

    return removed;
  }

  private evictOldest(count: number): void {
    const toEvict = this.accessOrder.slice(0, count);
    for (const key of toEvict) {
      this.cache.delete(key);
    }
    this.accessOrder = this.accessOrder.slice(count);
  }

  getStats(): CacheStats {
    let oldest: number | null = null;
    let newest: number | null = null;
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) oldest = entry.timestamp;
      if (newest === null || entry.timestamp > newest) newest = entry.timestamp;
      totalSize += JSON.stringify(entry.data).length;
    }

    return {
      totalEntries: this.cache.size,
      totalSize,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  pruneByAge(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoff) {
        this.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

export const translationCache = new TranslationCache();

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
