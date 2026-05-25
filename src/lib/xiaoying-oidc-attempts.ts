import { logger } from '@/lib/logger'

interface OidcAttempt {
  state: string
  nonce: string
  codeVerifier: string
  redirectTo: string
  createdAt: number
}

const TTL_MS = 10 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 1000

const store = new Map<string, OidcAttempt>()

function cleanup(): void {
  const now = Date.now()
  let removed = 0
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(key)
      removed++
    }
  }
  if (removed > 0) {
    logger.debug(`[OidcAttempts] Cleanup: removed ${removed} expired attempts. Remaining: ${store.size}`)
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS)

export function createAttempt(
  state: string,
  nonce: string,
  codeVerifier: string,
  redirectTo: string,
): void {
  store.set(state, {
    state,
    nonce,
    codeVerifier,
    redirectTo,
    createdAt: Date.now(),
  })
}

export function consumeAttempt(state: string): OidcAttempt | null {
  const attempt = store.get(state)
  if (!attempt) return null
  store.delete(state)
  if (Date.now() - attempt.createdAt > TTL_MS) return null
  return attempt
}

export function getAttemptCount(): number {
  return store.size
}
