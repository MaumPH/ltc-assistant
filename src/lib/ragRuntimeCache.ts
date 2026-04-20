type CacheNamespace = 'normalization' | 'hyde' | 'retrieval' | 'fallback' | 'answer';

interface RuntimeCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class RuntimeRagCache {
  private readonly store = new Map<string, RuntimeCacheEntry<unknown>>();

  get<T>(namespace: CacheNamespace, cacheKey: string): T | null {
    const entry = this.store.get(`${namespace}:${cacheKey}`);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(`${namespace}:${cacheKey}`);
      return null;
    }
    return entry.value as T;
  }

  set<T>(namespace: CacheNamespace, cacheKey: string, value: T, ttlMs: number): void {
    this.store.set(`${namespace}:${cacheKey}`, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
