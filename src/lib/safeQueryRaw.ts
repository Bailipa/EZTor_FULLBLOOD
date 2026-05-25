import { logger } from '@/lib/logger'

export async function safeQueryRaw<T>(label: string, queryFn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await queryFn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error({ err: error, step: label, details: message }, `Query $queryRaw ${label} failed`)
    return fallback
  }
}
