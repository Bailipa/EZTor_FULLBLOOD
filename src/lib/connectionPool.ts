import OpenAI from 'openai';

class ConnectionPool {
  private pool: Map<string, OpenAI> = new Map();
  private maxConnections = 10;

  getClient(apiKey: string, baseUrl: string): OpenAI {
    const key = `${apiKey}:${baseUrl}`;
    if (this.pool.has(key)) {
      return this.pool.get(key)!;
    }

    if (this.pool.size >= this.maxConnections) {
      // Remove the oldest connection
      const oldestKey = this.pool.keys().next().value;
      if (oldestKey) {
        this.pool.delete(oldestKey);
      }
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.pool.set(key, client);
    return client;
  }

  clear() {
    this.pool.clear();
  }
}

export const connectionPool = new ConnectionPool();
