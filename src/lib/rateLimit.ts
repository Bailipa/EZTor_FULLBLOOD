interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, entry: RateLimitEntry): Promise<void>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  async get(key: string): Promise<RateLimitEntry | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private redis: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
    del(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
  };
  private keyPrefix: string;

  constructor(redisClient: unknown, keyPrefix = 'ratelimit:') {
    this.redis = redisClient as {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
      del(key: string): Promise<number>;
      keys(pattern: string): Promise<string[]>;
    };
    this.keyPrefix = keyPrefix;
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const data = await this.redis.get(`${this.keyPrefix}${key}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    const ttl = Math.max(0, entry.resetTime - Date.now());
    await this.redis.set(
      `${this.keyPrefix}${key}`,
      JSON.stringify(entry),
      'PX',
      ttl
    );
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`${this.keyPrefix}${key}`);
  }

  async cleanup(): Promise<void> {
    // Redis automatically handles TTL-based expiration
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();
let isRedisEnabled = false;

export function initializeRedisStore(redisClient: unknown, keyPrefix?: string): void {
  store = new RedisRateLimitStore(redisClient, keyPrefix);
  isRedisEnabled = true;
  console.log('Rate limiting: Redis store initialized');
}

export function useMemoryStore(): void {
  store = new MemoryRateLimitStore();
  isRedisEnabled = false;
  console.log('Rate limiting: Memory store initialized');
}

export function isRedisStoreEnabled(): boolean {
  return isRedisEnabled;
}

export async function rateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = await store.get(key);

  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
    await store.set(key, newEntry);
    return {
      success: true,
      remaining: MAX_REQUESTS - 1,
      resetTime: now + WINDOW_MS,
    };
  }

  if (entry.count >= MAX_REQUESTS) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  await store.set(key, entry);
  return {
    success: true,
    remaining: MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime,
  };
}

export function getClientKey(req: Request, sessionId?: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (sessionId) {
    return `${ip}:${sessionId}`;
  }
  return ip;
}

export async function cleanupExpiredEntries(): Promise<void> {
  await store.cleanup();
}

setInterval(() => {
  cleanupExpiredEntries().catch(console.error);
}, 60 * 1000);

export type { RateLimitStore, RateLimitEntry, RateLimitResult };
