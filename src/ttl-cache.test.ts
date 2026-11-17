import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1000;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('throws RangeError when defaultTtlMs is zero or negative', () => {
      expect(() => new TtlCache({ defaultTtlMs: 0 })).toThrow(RangeError);
      expect(() => new TtlCache({ defaultTtlMs: -5 })).toThrow(RangeError);
    });

    it('throws RangeError when maxEntries is less than 1', () => {
      expect(() => new TtlCache({ defaultTtlMs: 10, maxEntries: 0 })).toThrow(RangeError);
    });

    it('uses Date.now as the default clock when none is provided', () => {
      const spy = jest.spyOn(Date, 'now').mockReturnValue(5000);
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100 });
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
      spy.mockReturnValue(5100);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('set and get', () => {
    it('returns a stored value before its TTL elapses', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1);
      now += 99;
      expect(cache.get('a')).toBe(1);
    });

    it('returns undefined for a missing key and counts a miss', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      expect(cache.get('missing')).toBeUndefined();
      expect(cache.stats().misses).toBe(1);
    });

    it('expires entries exactly when the TTL is reached and removes them', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1);
      now += 100;
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('honours a custom per-entry ttlMs over the default', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('short', 1, 10);
      cache.set('default', 2);
      now += 10;
      expect(cache.get('short')).toBeUndefined();
      expect(cache.get('default')).toBe(2);
    });

    it('throws RangeError when set is called with a non-positive ttlMs', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      expect(() => cache.set('a', 1, 0)).toThrow(RangeError);
      expect(() => cache.set('a', 1, -1)).toThrow(RangeError);
      expect(cache.size).toBe(0);
    });
  });

  describe('eviction', () => {
    it('overwriting an existing key replaces value, refreshes TTL and does not evict', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, maxEntries: 2, clock });
      cache.set('a', 1);
      cache.set('b', 2);
      now += 50;
      cache.set('a', 10);
      expect(cache.size).toBe(2);
      expect(cache.get('b')).toBe(2);
      now += 60; // 'b' expired (110 >= 100), 'a' refreshed (60 < 100)
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
    });

    it('evicts the oldest inserted entry when maxEntries is reached', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, maxEntries: 2, clock });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.size).toBe(2);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('re-setting a key moves it to newest so a different key is evicted next', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, maxEntries: 2, clock });
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('a', 11);
      cache.set('c', 3);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('a')).toBe(11);
      expect(cache.get('c')).toBe(3);
    });

    it('does not limit size when maxEntries is not configured', () => {
      const cache = new TtlCache<number, number>({ defaultTtlMs: 100, clock });
      for (let i = 0; i < 50; i++) {
        cache.set(i, i);
      }
      expect(cache.size).toBe(50);
    });
  });

  describe('getOrLoad', () => {
    it('returns the cached value without calling the loader', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1);
      const loader = jest.fn().mockResolvedValue(99);
      await expect(cache.getOrLoad('a', loader)).resolves.toBe(1);
      expect(loader).not.toHaveBeenCalled();
    });

    it('calls the loader on a miss and caches the result', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      const loader = jest.fn().mockResolvedValue(7);
      await expect(cache.getOrLoad('a', loader)).resolves.toBe(7);
      await expect(cache.getOrLoad('a', loader)).resolves.toBe(7);
      expect(loader).toHaveBeenCalledTimes(1);
      now += 100; // default TTL applied
      expect(cache.get('a')).toBeUndefined();
    });

    it('passes the given ttlMs through to the cache', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      await cache.getOrLoad('a', async () => 5, 20);
      now += 20;
      expect(cache.get('a')).toBeUndefined();
    });

    it('propagates loader rejection and caches nothing', async () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      const loader = jest.fn().mockRejectedValue(new Error('boom'));
      await expect(cache.getOrLoad('a', loader)).rejects.toThrow('boom');
      expect(cache.size).toBe(0);
    });
  });

  describe('delete', () => {
    it('removes an entry and reports whether it existed', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('a')).toBe(false);
      expect(cache.size).toBe(0);
    });
  });

  describe('prune', () => {
    it('removes only expired entries and returns the count', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1, 10);
      cache.set('b', 2, 10);
      cache.set('c', 3, 100);
      now += 10; // boundary for a and b
      expect(cache.prune()).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.get('c')).toBe(3);
    });

    it('returns 0 when nothing is expired', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1);
      now += 99;
      expect(cache.prune()).toBe(0);
      expect(cache.size).toBe(1);
    });
  });

  describe('stats', () => {
    it('reports zero hitRate before any lookups', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      expect(cache.stats()).toEqual({ hits: 0, misses: 0, hitRate: 0 });
    });

    it('tracks hits, misses and hitRate across lookups', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 100, clock });
      cache.set('a', 1);
      cache.get('a'); // hit
      cache.get('nope'); // miss
      now += 100;
      cache.get('a'); // expired -> miss
      cache.set('b', 2);
      cache.get('b'); // hit
      expect(cache.stats()).toEqual({ hits: 2, misses: 2, hitRate: 0.5 });
    });
  });
});
