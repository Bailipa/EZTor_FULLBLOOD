import OpenAI from 'openai'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { connectionPool } from './connectionPool'
import { monitoringService } from './monitoring'
import { logger } from '@/lib/logger'

export const API_QUOTA_EXHAUSTED_MESSAGE = 'API额度用尽！请联系管理员填充。'

export type LlmProviderRow = {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
  priority: number
  isActive: number // sqlite boolean
  quotaRemaining: number | null
  quotaUsed: number
  lastUsedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  createdAt: string
  updatedAt: string
}

function normalizeBaseUrl(url?: string): string {
  const raw = (url || '').trim()
  if (!raw) return 'https://api.openai.com/v1'
  const trimmed = raw.replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.replace(/\/chat\/completions$/, '')
  }
  return trimmed
}

export function isQuotaError(err: unknown): boolean {
  const e = err as { status?: unknown; message?: unknown; response?: { status?: unknown } }
  const status = e?.status ?? e?.response?.status
  const message = String(e?.message || '')
  return (
    status === 402 ||
    status === 429 ||
    /insufficient[_ ]quota/i.test(message) ||
    /quota/i.test(message) ||
    /配额不足|额度|配额|资源不足/.test(message)
  )
}

export function isRateLimitError(err: unknown): boolean {
  const e = err as { status?: unknown; message?: unknown; response?: { status?: unknown } }
  const status = e?.status ?? e?.response?.status
  const message = String(e?.message || '')
  return (
    status === 429 || /rate[_ ]limit/i.test(message) || /too[_ ]many[_ ]requests/i.test(message)
  )
}

export function isConnectionError(err: unknown): boolean {
  const e = err as { message?: unknown; code?: unknown }
  const message = String(e?.message || '')
  const code = String(e?.code || '')
  return (
    /connection/i.test(message) ||
    /timeout/i.test(message) ||
    /network/i.test(message) ||
    /SELF_SIGNED_CERT/i.test(message) ||
    /certificate/i.test(message) ||
    /SSL/i.test(message) ||
    /ECONNREFUSED/i.test(message) ||
    /ENOTFOUND/i.test(message) ||
    /fetch failed/i.test(message) ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
  )
}

export async function markProviderError(providerId: string, reason: string): Promise<void> {
  await ensureProviderTable()
  const now = new Date()
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "LlmApiProvider"
      SET
        "lastError" = ${reason},
        "lastErrorAt" = ${now},
        "updatedAt" = ${now}
      WHERE id = ${providerId}
    `,
  )
}

export async function checkQuotaThresholds(): Promise<void> {
  const providers = await getActiveLlmProviders()
  for (const provider of providers) {
    if (provider.quotaRemaining !== null && provider.quotaRemaining < 100) {
      // Send quota warning notification
      await sendQuotaWarning(provider.id, provider.name, provider.quotaRemaining)
    }
  }
}

async function sendQuotaWarning(
  providerId: string,
  providerName: string,
  remaining: number,
): Promise<void> {
  // Implement quota warning logic here
  logger.warn({ providerName, remaining }, 'Quota warning')
}

let didSeedDefaultProvider = false

async function ensureProviderTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LlmApiProvider" (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
       "apiKey" TEXT NOT NULL,
       "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
       model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
       priority INTEGER NOT NULL DEFAULT 0,
       "isActive" BOOLEAN NOT NULL DEFAULT true,
       "quotaRemaining" INTEGER,
       "quotaUsed" INTEGER NOT NULL DEFAULT 0,
       "lastUsedAt" DATETIME,
       "lastError" TEXT,
       "lastErrorAt" DATETIME,
       "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LlmApiProvider_isActive_priority_idx"
    ON "LlmApiProvider" ("isActive", priority);
  `)
}

async function seedDefaultProviderFromLegacyConfigIfEmpty(): Promise<void> {
  if (didSeedDefaultProvider) return
  didSeedDefaultProvider = true

  await ensureProviderTable()

  try {
    const rows = await prisma.$queryRaw<Array<{ c: number }>>(
      Prisma.sql`SELECT COUNT(1) as c FROM "LlmApiProvider"`,
    )
    const count = Number(rows?.[0]?.c || 0)
    if (count > 0) return
  } catch {
    return
  }

  const legacyDb = await prisma.apiConfig
    .findUnique({ where: { id: 'global' }, select: { apiKey: true, baseUrl: true, model: true } })
    .catch(() => null)

  const apiKey = String(legacyDb?.apiKey || process.env.LLM_API_KEY || '').trim()
  const baseUrl = String(legacyDb?.baseUrl || process.env.LLM_API_URL || '').trim()
  const model = String(legacyDb?.model || process.env.LLM_MODEL || '').trim()

  if (!apiKey || !baseUrl) return

  const name = baseUrl.includes('volces.com') ? '火山方舟（默认）' : '默认 API'

  const now = new Date()
  const id = crypto.randomUUID()

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LlmApiProvider" (id,name,"apiKey","baseUrl",model,priority,"isActive","quotaRemaining","quotaUsed","createdAt","updatedAt")
       VALUES (?,?,?,?,?,0,1,NULL,0,?,?)`,
      id,
      name,
      apiKey,
      baseUrl,
      model || 'gpt-4o-mini',
      now,
      now,
    )
  } catch {
    // Ignore races/duplicates.
  }
}

export async function listLlmProviders(): Promise<LlmProviderRow[]> {
  await ensureProviderTable()
  await seedDefaultProviderFromLegacyConfigIfEmpty()
  return prisma.$queryRaw<LlmProviderRow[]>(
    Prisma.sql`
      SELECT
        id, name, "apiKey", "baseUrl", model, priority, "isActive",
        "quotaRemaining", "quotaUsed", "lastUsedAt", "lastError", "lastErrorAt",
        "createdAt", "updatedAt"
      FROM "LlmApiProvider"
      ORDER BY priority ASC, "createdAt" ASC
    `,
  )
}

export async function getActiveLlmProviders(): Promise<LlmProviderRow[]> {
  await ensureProviderTable()
  await seedDefaultProviderFromLegacyConfigIfEmpty()
  return prisma.$queryRaw<LlmProviderRow[]>(
    Prisma.sql`
      SELECT
        id, name, "apiKey", "baseUrl", model, priority, "isActive",
        "quotaRemaining", "quotaUsed", "lastUsedAt", "lastError", "lastErrorAt",
        "createdAt", "updatedAt"
      FROM "LlmApiProvider"
      WHERE "isActive" = true
      ORDER BY priority ASC, "createdAt" ASC
    `,
  )
}

export async function markProviderQuotaExhausted(
  providerId: string,
  reason: string,
): Promise<void> {
  await ensureProviderTable()
  const now = new Date()
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "LlmApiProvider"
      SET
        "quotaRemaining" = 0,
        "lastError" = ${reason},
        "lastErrorAt" = ${now},
        "updatedAt" = ${now}
      WHERE id = ${providerId}
    `,
  )
}

export async function noteProviderUsed(
  providerId: string,
  decrementQuotaBy: number,
): Promise<void> {
  await ensureProviderTable()
  const now = new Date()

  // quotaRemaining NULL means unlimited.
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "LlmApiProvider"
      SET
        "quotaUsed" = "quotaUsed" + ${decrementQuotaBy}::integer,
        "quotaRemaining" = CASE
          WHEN "quotaRemaining" IS NULL THEN NULL
          ELSE GREATEST("quotaRemaining" - ${decrementQuotaBy}::integer, 0)
        END,
        "lastUsedAt" = ${now},
        "updatedAt" = ${now}
      WHERE id = ${providerId}
    `,
  )
}

export type ProviderSelection =
  | { kind: 'db'; provider: LlmProviderRow }
  | {
      kind: 'legacy'
      provider: {
        id: 'legacy'
        name: 'Legacy'
        apiKey: string
        baseUrl: string
        model: string
      }
    }

export async function getProviderCandidates(fallback?: {
  apiKey?: string
  baseUrl?: string
  model?: string
}): Promise<ProviderSelection[]> {
  const providers = await getActiveLlmProviders()
  const usable = providers.filter((p) => p.quotaRemaining === null || p.quotaRemaining > 0)

  if (usable.length > 0) return usable.map((provider) => ({ kind: 'db', provider }))

  const apiKey = (fallback?.apiKey || '').trim()
  if (apiKey) {
    return [
      {
        kind: 'legacy',
        provider: {
          id: 'legacy',
          name: 'Legacy',
          apiKey,
          baseUrl: normalizeBaseUrl(fallback?.baseUrl),
          model: (fallback?.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini',
        },
      },
    ]
  }

  // No usable providers and no fallback configured.
  return []
}

export async function createOpenAiClient(
  sel: ProviderSelection,
): Promise<{ client: OpenAI; model: string }> {
  const provider = sel.provider
  const baseURL = normalizeBaseUrl(provider.baseUrl)
  const apiKey = provider.apiKey
  const model = provider.model
  const client = connectionPool.getClient(apiKey, baseURL)
  return { client, model }
}

export async function withLlmFailover<T>(
  candidates: ProviderSelection[],
  fn: (client: OpenAI, model: string, sel: ProviderSelection) => Promise<T>,
  quotaCost: number,
): Promise<T> {
  if (candidates.length === 0) {
    throw new Error(API_QUOTA_EXHAUSTED_MESSAGE)
  }

  let lastErr: unknown = null
  for (const sel of candidates) {
    if (sel.kind === 'db') {
      if (!(sel.provider.quotaRemaining === null || sel.provider.quotaRemaining > 0)) continue
    }

    const startTime = Date.now()
    try {
      const { client, model } = await createOpenAiClient(sel)
      const result = await fn(client, model, sel)
      const duration = Date.now() - startTime

      // Record monitoring data
      monitoringService.recordRequest(
        sel.kind === 'db' ? sel.provider.id : 'legacy',
        duration,
        true,
      )

      if (sel.kind === 'db') {
        await noteProviderUsed(sel.provider.id, quotaCost)
      }
      return result
    } catch (err: unknown) {
      const duration = Date.now() - startTime
      lastErr = err
      const errMessage = err instanceof Error ? err.message : String(err)

      // Record monitoring data
      monitoringService.recordRequest(
        sel.kind === 'db' ? sel.provider.id : 'legacy',
        duration,
        false,
        errMessage,
      )

      if (sel.kind === 'db') {
        if (isQuotaError(err)) {
          await markProviderQuotaExhausted(sel.provider.id, String(errMessage || 'quota exhausted'))
        } else if (isRateLimitError(err)) {
          await markProviderError(sel.provider.id, String(errMessage || 'rate limit exceeded'))
        } else if (isConnectionError(err)) {
          await markProviderError(sel.provider.id, String(errMessage || 'connection error'))
        } else {
          await markProviderError(sel.provider.id, String(errMessage || 'error'))
        }
      }
      continue
    }
  }

  if (lastErr && isQuotaError(lastErr)) {
    throw new Error(API_QUOTA_EXHAUSTED_MESSAGE)
  }

  throw lastErr || new Error('LLM request failed')
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) return '****'
  return apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
}
