class MonitoringService {
  private metrics: Map<string, any> = new Map();

  recordRequest(providerId: string, duration: number, success: boolean, error?: string) {
    const key = `provider:${providerId}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        lastRequestAt: new Date(),
        errors: new Map<string, number>(),
      });
    }

    const metric = this.metrics.get(key);
    metric.totalRequests++;
    if (success) {
      metric.successfulRequests++;
    } else {
      metric.failedRequests++;
      if (error) {
        const errorCount = metric.errors.get(error) || 0;
        metric.errors.set(error, errorCount + 1);
      }
    }
    metric.totalDuration += duration;
    metric.lastRequestAt = new Date();
  }

  getMetrics() {
    return Object.fromEntries(this.metrics);
  }

  getProviderStats(providerId: string) {
    const key = `provider:${providerId}`;
    return this.metrics.get(key);
  }
}

export const monitoringService = new MonitoringService();
