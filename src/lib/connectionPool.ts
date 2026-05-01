import OpenAI from 'openai';

if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

interface PoolEntry {
  client: OpenAI;
  lastUsed: number;
}

class ConnectionPool {
  private pool: Map<string, PoolEntry> = new Map();
  private maxConnections = 10;

  getClient(apiKey: string, baseUrl: string): OpenAI {
    const key = `${apiKey}:${baseUrl}`;
    const now = Date.now();

    if (this.pool.has(key)) {
      const entry = this.pool.get(key)!;
      entry.lastUsed = now;
      this.pool.delete(key);
      this.pool.set(key, entry);
      return entry.client;
    }

    if (this.pool.size >= this.maxConnections) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, e] of this.pool.entries()) {
        if (e.lastUsed < oldestTime) {
          oldestTime = e.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.pool.delete(oldestKey);
      }
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.pool.set(key, { client, lastUsed: now });
    return client;
  }

  cleanupIdle() {
    const now = Date.now();
    for (const [key, entry] of this.pool.entries()) {
      if (now - entry.lastUsed > IDLE_TIMEOUT) {
        this.pool.delete(key);
      }
    }
  }

  clear() {
    this.pool.clear();
  }
}

export const connectionPool = new ConnectionPool();

setInterval(() => {
  connectionPool.cleanupIdle();
}, 5 * 60 * 1000); // cleanup every 5 minutes
