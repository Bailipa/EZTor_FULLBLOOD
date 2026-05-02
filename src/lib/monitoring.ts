const MAX_ERROR_ENTRIES_PER_PROVIDER = 50
const TRUNCATED_ERROR_LENGTH = 200
const METRICS_CLEANUP_INTERVAL = 5 * 60 * 1000

function truncateError(error: string): string {
  if (error.length <= TRUNCATED_ERROR_LENGTH) return error
  return error.slice(0, TRUNCATED_ERROR_LENGTH) + '…'
}

interface ProviderMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalDuration: number
  lastRequestAt: Date
  errors: Map<string, number>
}

class MonitoringService {
  private metrics: Map<string, ProviderMetrics> = new Map()

  recordRequest(providerId: string, duration: number, success: boolean, error?: string) {
    const key = `provider:${providerId}`
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        lastRequestAt: new Date(),
        errors: new Map<string, number>(),
      })
    }

    const metric = this.metrics.get(key)!
    metric.totalRequests++
    if (success) {
      metric.successfulRequests++
    } else {
      metric.failedRequests++
      if (error) {
        const truncated = truncateError(error)
        const errorCount = metric.errors.get(truncated) || 0
        metric.errors.set(truncated, errorCount + 1)

        if (metric.errors.size > MAX_ERROR_ENTRIES_PER_PROVIDER) {
          const oldestKey = metric.errors.keys().next().value
          if (oldestKey) metric.errors.delete(oldestKey)
        }
      }
    }
    metric.totalDuration += duration
    metric.lastRequestAt = new Date()
  }

  getMetrics() {
    return Object.fromEntries(this.metrics)
  }

  getProviderStats(providerId: string) {
    const key = `provider:${providerId}`
    return this.metrics.get(key)
  }

  clear() {
    this.metrics.clear()
  }
}

export const monitoringService = new MonitoringService()

let cleanupTimer: ReturnType<typeof setInterval> | null = null
function ensureCleanupTimer() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    monitoringService.clear()
  }, METRICS_CLEANUP_INTERVAL)
}

ensureCleanupTimer()
