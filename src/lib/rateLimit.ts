import { createHash } from 'node:crypto'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getClientIp } from '@/lib/onlineTracker'

interface RateLimitEntry {
  count: number
  resetTime: number
}
interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}
interface RateLimitStore {
  consume(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>
  cleanup(): Promise<void>
}
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 30

class DatabaseRateLimitStore implements RateLimitStore {
  async consume(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    // One statement locks the conflicting row. DB time keeps all app workers on the same clock.
    const [entry] = await prisma.$queryRaw<{ count: number; resetTime: bigint }[]>`
      WITH clock AS (SELECT FLOOR(EXTRACT(EPOCH FROM statement_timestamp()) * 1000)::bigint AS now)
      INSERT INTO "RateLimitWindow" (key, count, "resetTime")
      SELECT ${key}, 1, now + ${windowMs}::bigint FROM clock
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN "RateLimitWindow"."resetTime" <= (SELECT now FROM clock)
          THEN 1 ELSE LEAST("RateLimitWindow".count, ${maxRequests}::integer) + 1 END,
        "resetTime" = CASE WHEN "RateLimitWindow"."resetTime" <= (SELECT now FROM clock)
          THEN (SELECT now FROM clock) + ${windowMs}::bigint ELSE "RateLimitWindow"."resetTime" END
      RETURNING count, "resetTime"`
    return { success: entry.count <= maxRequests, remaining: Math.max(0, maxRequests - entry.count), resetTime: Number(entry.resetTime) }
  }
  async cleanup(): Promise<void> {
    await prisma.$executeRaw`DELETE FROM "RateLimitWindow" WHERE "resetTime" <= FLOOR(EXTRACT(EPOCH FROM statement_timestamp()) * 1000)::bigint`
  }
}

class MemoryRateLimitStore implements RateLimitStore {
  private entries = new Map<string, RateLimitEntry>()
  async consume(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    let entry = this.entries.get(key)
    // No await between inspection and mutation: concurrent callers cannot all create a fresh window.
    if (!entry || entry.resetTime <= now) {
      if (!entry && this.entries.size >= 5000) {
        for (const [storedKey, value] of this.entries) if (value.resetTime <= now) this.entries.delete(storedKey)
        if (this.entries.size >= 5000) return { success: false, remaining: 0, resetTime: now + windowMs }
      }
      entry = { count: 0, resetTime: now + windowMs }
      this.entries.set(key, entry)
    }
    const success = entry.count < maxRequests
    if (success) entry.count++
    return { success, remaining: Math.max(0, maxRequests - entry.count), resetTime: entry.resetTime }
  }
  async cleanup(): Promise<void> {
    for (const [key, value] of this.entries) if (value.resetTime <= Date.now()) this.entries.delete(key)
  }
}

// ioredis-compatible EVAL; the complete decision runs in Redis, never GET then SET.
const CONSUME_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local values = redis.call('HMGET', KEYS[1], 'count', 'resetTime')
local count = tonumber(values[1]) or 0
local resetTime = tonumber(values[2]) or 0
if resetTime <= now then count = 0; resetTime = now + tonumber(ARGV[2]) end
local allowed = 0
if count < tonumber(ARGV[1]) then count = count + 1; allowed = 1 end
redis.call('HSET', KEYS[1], 'count', count, 'resetTime', resetTime)
redis.call('PEXPIRE', KEYS[1], math.max(1, resetTime - now))
return {allowed, count, resetTime}
`
class RedisRateLimitStore implements RateLimitStore {
  private redis: { eval(script: string, keys: number, ...args: (string | number)[]): Promise<unknown> }
  constructor(redisClient: unknown, private prefix = 'ratelimit:atomic:') {
    if (!redisClient || typeof (redisClient as { eval?: unknown }).eval !== 'function') throw new Error('Redis限流需要支持原子EVAL的客户端')
    this.redis = redisClient as typeof this.redis
  }
  async consume(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const result = await this.redis.eval(CONSUME_SCRIPT, 1, this.prefix + key, maxRequests, windowMs)
    if (!Array.isArray(result) || result.length !== 3 || result.some(value => !Number.isFinite(Number(value)))) throw new Error('Redis限流响应无效')
    return { success: Number(result[0]) === 1, remaining: Math.max(0, maxRequests - Number(result[1])), resetTime: Number(result[2]) }
  }
  async cleanup(): Promise<void> { /* Redis expires windows atomically with consumption. */ }
}

// Shared database is the default; do not silently downgrade to per-process memory on failure.
let store: RateLimitStore = new DatabaseRateLimitStore()
let isRedisEnabled = false
export function initializeRedisStore(redisClient: unknown, keyPrefix?: string): void {
  store = new RedisRateLimitStore(redisClient, keyPrefix)
  isRedisEnabled = true
}
/** Explicitly process-local; kept for isolated tooling. Production uses the shared DB by default. */
export function useMemoryStore(): void {
  store = new MemoryRateLimitStore()
  isRedisEnabled = false
}
export function isRedisStoreEnabled(): boolean { return isRedisEnabled }
export interface RateLimitOptions { maxRequests?: number; windowMs?: number }
export async function rateLimit(key: string, options: RateLimitOptions = {}): Promise<RateLimitResult> {
  const maxRequests = options.maxRequests ?? MAX_REQUESTS
  const windowMs = options.windowMs ?? WINDOW_MS
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests >= 2147483647 || !Number.isSafeInteger(windowMs) || windowMs < 1 || windowMs > 86400000) throw new Error('限流配置无效')
  // Fixed size keys keep caller-controlled IPs out of the backing store and its index.
  const digest = createHash('sha256').update(key).digest('hex')
  try { return await store.consume(digest, maxRequests, windowMs) }
  catch {
    logger.error('Rate limit storage unavailable; request denied')
    return { success: false, remaining: 0, resetTime: Date.now() + windowMs }
  }
}
export function getClientKey(req: Request, sessionId?: string): string {
  return sessionId ? `user:${sessionId}` : getClientIp(req)
}
export async function cleanupExpiredEntries(): Promise<void> { await store.cleanup() }
const cleanupTimer = setInterval(() => {
  cleanupExpiredEntries().catch(() => logger.error('Rate limit cleanup failed'))
}, 60 * 1000)
cleanupTimer.unref()
export type { RateLimitStore, RateLimitEntry, RateLimitResult }
