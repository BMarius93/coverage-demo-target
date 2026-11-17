export type Clock = () => number;

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export interface TtlCacheOptions {
  defaultTtlMs: number;
  maxEntries?: number;
  clock?: Clock;
}

/**
 * In-memory cache with per-entry TTL and an optional size limit.
 * When the limit is reached the oldest inserted entry is evicted.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private readonly clock: Clock;
  private hits = 0;
  private misses = 0;

  constructor(private readonly options: TtlCacheOptions) {
    if (options.defaultTtlMs <= 0) {
      throw new RangeError('defaultTtlMs must be positive');
    }
    if (options.maxEntries !== undefined && options.maxEntries < 1) {
      throw new RangeError('maxEntries must be at least 1');
    }
    this.clock = options.clock ?? Date.now;
  }

  set(key: K, value: V, ttlMs: number = this.options.defaultTtlMs): void {
    if (ttlMs <= 0) {
      throw new RangeError('ttlMs must be positive');
    }
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.options.maxEntries !== undefined && this.entries.size >= this.options.maxEntries) {
      this.evictOldest();
    }
    this.entries.set(key, { value, expiresAt: this.clock() + ttlMs });
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= this.clock()) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  async getOrLoad(key: K, loader: () => Promise<V>, ttlMs?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  /** Removes all expired entries and returns how many were removed. */
  prune(): number {
    const now = this.clock();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.entries.size;
  }

  stats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, hitRate: total === 0 ? 0 : this.hits / total };
  }

  private evictOldest(): void {
    const oldest = this.entries.keys().next();
    if (!oldest.done) {
      this.entries.delete(oldest.value);
    }
  }
}
