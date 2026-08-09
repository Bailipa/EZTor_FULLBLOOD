import { logger } from './logger'

const WINDOW_MS = 5 * 60 * 1000
const BLACKLIST_TTL_MS = 30 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 1000

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAME || 'lhy').split(',').map((s) => s.trim())
const ONLINE_LIMIT = parseInt(process.env.ONLINE_USER_LIMIT || '30', 10)

export type ClientPlatform = 'web' | 'android' | 'desktop'

export interface ActivityEntry {
  lastActive: number
  platform: ClientPlatform
  userId?: string | null
  username?: string | null
}

// IP → last activity timestamp
const activityMap = new Map<string, ActivityEntry>()

// kicked userId → kick timestamp
const blacklist = new Map<string, number>()

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/** 从 UA 识别客户端平台：安卓 App / 桌面 App / 网页 */
export function detectPlatform(ua: string | null | undefined): ClientPlatform {
  const u = (ua || '').toLowerCase()
  if (u.includes('eztorandroid')) return 'android'
  if (u.includes('eztordesktop')) return 'desktop'
  return 'web'
}

export function isAdmin(username: string | undefined | null): boolean {
  return !!username && ADMIN_USERNAMES.includes(username)
}

export function wasRecentlyActive(ip: string): boolean {
  const entry = activityMap.get(ip)
  if (!entry) return false
  return Date.now() - entry.lastActive < WINDOW_MS
}

export function recordActivity(
  ip: string,
  info?: { platform?: ClientPlatform; userId?: string | null; username?: string | null },
): void {
  const prev = activityMap.get(ip)
  activityMap.set(ip, {
    lastActive: Date.now(),
    platform: info?.platform || prev?.platform || 'web',
    userId: info?.userId !== undefined ? info.userId : prev?.userId,
    username: info?.username !== undefined ? info.username : prev?.username,
  })
}

export function getOnlineCount(): number {
  const now = Date.now()
  let count = 0
  for (const entry of activityMap.values()) {
    if (now - entry.lastActive < WINDOW_MS) count++
  }
  return count
}

export function isOverLimit(): boolean {
  return getOnlineCount() >= ONLINE_LIMIT
}

export function getOnlineLimit(): number {
  return ONLINE_LIMIT
}

export interface OnlineUser {
  ip: string
  platform: ClientPlatform
  userId: string | null
  username: string | null
  lastActiveAt: string
}

export interface OnlineByPlatform {
  total: number
  platforms: Record<
    ClientPlatform,
    { count: number; users: OnlineUser[] }
  >
}

/** 按平台分组返回当前在线用户（5 分钟窗口） */
export function getOnlineByPlatform(): OnlineByPlatform {
  const now = Date.now()
  const platforms: Record<ClientPlatform, { count: number; users: OnlineUser[] }> = {
    web: { count: 0, users: [] },
    android: { count: 0, users: [] },
    desktop: { count: 0, users: [] },
  }
  let total = 0
  for (const [ip, entry] of activityMap.entries()) {
    if (now - entry.lastActive >= WINDOW_MS) continue
    total++
    const group = platforms[entry.platform] || platforms.web
    group.count++
    group.users.push({
      ip,
      platform: entry.platform,
      userId: entry.userId ?? null,
      username: entry.username ?? null,
      lastActiveAt: new Date(entry.lastActive).toISOString(),
    })
  }
  for (const key of Object.keys(platforms) as ClientPlatform[]) {
    platforms[key].users.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
  }
  return { total, platforms }
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
  for (const [ip, entry] of activityMap.entries()) {
    if (now - entry.lastActive > WINDOW_MS) {
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
