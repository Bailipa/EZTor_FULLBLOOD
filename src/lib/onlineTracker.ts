import { logger } from './logger'

const WINDOW_MS = 5 * 60 * 1000
const BLACKLIST_TTL_MS = 30 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 1000

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAME || 'lhy').split(',').map((s) => s.trim())
const ONLINE_LIMIT = parseInt(process.env.ONLINE_USER_LIMIT || '30', 10)

// IP → last activity timestamp
const activityMap = new Map<string, number>()

// kicked userId → kick timestamp
const blacklist = new Map<string, number>()

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function isAdmin(username: string | undefined | null): boolean {
  return !!username && ADMIN_USERNAMES.includes(username)
}

export function wasRecentlyActive(ip: string): boolean {
  const ts = activityMap.get(ip)
  if (!ts) return false
  return Date.now() - ts < WINDOW_MS
}

export function recordActivity(ip: string): void {
  activityMap.set(ip, Date.now())
}

export function getOnlineCount(): number {
  const now = Date.now()
  let count = 0
  for (const ts of activityMap.values()) {
    if (now - ts < WINDOW_MS) count++
  }
  return count
}

export function isOverLimit(): boolean {
  return getOnlineCount() >= ONLINE_LIMIT
}

export function getOnlineLimit(): number {
  return ONLINE_LIMIT
}

export function kickUser(userId: string): void {
  blacklist.set(userId, Date.now())
}

export function isKicked(userId: string): boolean {
  const kickTime = blacklist.get(userId)
  if (!kickTime) return false
  if (Date.now() - kickTime > BLACKLIST_TTL_MS) {
    blacklist.delete(userId)
    return false
  }
  return true
}

export function removeKick(userId: string): void {
  blacklist.delete(userId)
}

function cleanup(): void {
  const now = Date.now()
  let removedIps = 0
  for (const [ip, ts] of activityMap.entries()) {
    if (now - ts > WINDOW_MS) {
      activityMap.delete(ip)
      removedIps++
    }
  }
  let removedBlacklist = 0
  for (const [userId, ts] of blacklist.entries()) {
    if (now - ts > BLACKLIST_TTL_MS) {
      blacklist.delete(userId)
      removedBlacklist++
    }
  }
  if (removedIps > 0 || removedBlacklist > 0) {
    logger.debug(
      `[OnlineTracker] Cleanup: removed ${removedIps} IPs, ${removedBlacklist} blacklist entries. Active: ${activityMap.size}, Blacklisted: ${blacklist.size}`,
    )
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS)
