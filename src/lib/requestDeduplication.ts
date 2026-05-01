type PendingRequest = {
  promise: Promise<any>;
  timestamp: number;
  subscribers: number;
};

type CompletedRequest = {
  timestamp: number;
  result: any;
};

const pendingRequests = new Map<string, PendingRequest>();
const completedRequests = new Map<string, CompletedRequest>();

const REQUEST_TIMEOUT = 60000;
const COMPLETED_CACHE_TTL = 10000;
const MAX_PENDING_REQUESTS = 1000;
const MAX_COMPLETED_ENTRIES = 5000;
const CLEANUP_INTERVAL = 5000;

function cleanupStaleRequests() {
  const now = Date.now();
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > REQUEST_TIMEOUT) {
      pendingRequests.delete(key);
    }
  }
  for (const [key, request] of completedRequests.entries()) {
    if (now - request.timestamp > COMPLETED_CACHE_TTL) {
      completedRequests.delete(key);
    }
  }
}

setInterval(cleanupStaleRequests, CLEANUP_INTERVAL);

export function getPendingRequest<T>(key: string): Promise<T> | null {
  const request = pendingRequests.get(key);
  if (request) {
    request.subscribers++;
    return request.promise as Promise<T>;
  }
  return null;
}

export function getCompletedRequest<T>(key: string): T | null {
  const completed = completedRequests.get(key);
  if (completed && Date.now() - completed.timestamp <= COMPLETED_CACHE_TTL) {
    return completed.result as T;
  }
  if (completed) {
    completedRequests.delete(key);
  }
  return null;
}

export function setPendingRequest<T>(key: string, promise: Promise<T>): boolean {
  if (pendingRequests.size >= MAX_PENDING_REQUESTS) {
    console.warn(`[RequestDeduplication] Max pending requests reached: ${MAX_PENDING_REQUESTS}`);
    return false;
  }
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
    subscribers: 1
  });
  return true;
}

export function isAtCapacity(): boolean {
  return pendingRequests.size >= MAX_PENDING_REQUESTS;
}

export function resolvePendingRequest(key: string, result?: any): void {
  if (result !== undefined) {
    if (completedRequests.size >= MAX_COMPLETED_ENTRIES) {
      const oldestKey = completedRequests.keys().next().value;
      if (oldestKey) completedRequests.delete(oldestKey);
    }
    completedRequests.set(key, {
      timestamp: Date.now(),
      result
    });
  }
  pendingRequests.delete(key);
}

export function getPendingRequestCount(): number {
  return pendingRequests.size;
}

export function getPendingWords(): string[] {
  return Array.from(pendingRequests.keys());
}

export function createDeduplicatedRequest<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const completed = getCompletedRequest<T>(key);
  if (completed) {
    return Promise.resolve(completed);
  }

  const existing = getPendingRequest<T>(key);
  if (existing) {
    return existing;
  }

  const promise = fetcher().then(result => {
    resolvePendingRequest(key, result);
    return result;
  });

  setPendingRequest(key, promise);
  return promise;
}
