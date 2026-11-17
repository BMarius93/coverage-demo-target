import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1000;
  });

  const make = (maxEntries?: number, defaultTtlMs = 100) =>
    new TtlCache<string, number>({ defaultTtlMs, maxEntries, clock });

  describe('constructor', () => {
    it('throws RangeError when defaultTtlMs is zero or negative', () => {
      expect(() => new TtlCache({ defaultTtlMs: 0 })).toThrow(RangeError);
      expect(() => new TtlCache({ defaultTtlMs: -5 })).toThrow(RangeError);
    });

    it('throws RangeError when maxEntries is less than 1', () => {
      expect(() => new TtlCache({ defaultTtlMs: 10, maxEntries: 0 })).toThrow(RangeError);
    });

    it('uses Date.now when no clock is provided', () => {
      const cache = new TtlCache<string, number>({ defaultTtlMs: 60_000 });
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });
  });

  describe('set / get', () => {
    it('returns a stored value before its TTL expires and counts a hit', () => {
      const cache = make();
      cache.set('a', 1);
      now += 99;
      expect(cache.get('a')).toBe(1);
      expect(cache.stats().hits).toBe(1);
    });

    it('returns undefined for a missing key and counts a miss', () => {
      const cache = make();
      expect(cache.get('x')).toBeUndefined();
      expect(cache.stats().misses).toBe(1);
    });

    it('expires an entry exactly when the clock reaches expiresAt and removes it', () => {
      const cache = make();
      cache.set('a', 1);
      now += 100;
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('honours a per-call ttlMs override', () => {
      const cache = make();
      cache.set('a', 1, 10);
      now += 10;
      expect(cache.get('a')).toBeUndefined();
    });

    it('throws RangeError when set is called with a non-positive ttlMs', () => {
      const cache = make();
      expect(() => cache.set('a', 1, 0)).toThrow(RangeError);
      expect(() => cache.set('a', 1, -1)).toThrow(RangeError);
    });

    it('overwriting an existing key does not evict other entries when at capacity', () => {
      const cache = make(2);
      cache.set('a', 1);
      cache.set('b', 2);
      now += 50;
      cache.set('a', 10);
      expect(cache.size).toBe(2);
      expect(cache.get('b')).toBe(2);
      now += 60; // 'a' refreshed at +50 with ttl 100, still alive; 'b' expired
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
    });

    it('evicts the oldest inserted entry when maxEntries is reached', () => {
      const cache = make(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.size).toBe(2);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('re-setting a key moves it to newest so a different key is evicted next', () => {
      const cache = make(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('a', 11);
      cache.set('c', 3);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('a')).toBe(11);
      expect(cache.get('c')).toBe(3);
    });
  });

  describe('getOrLoad', () => {
    it('returns the cached value without calling the loader', async () => {
      const cache = make();
      cache.set('a', 1);
      const loader = jest.fn().mockResolvedValue(99);
      await expect(cache.getOrLoad('a', loader)).resolves.toBe(1);
      expect(loader).not.toHaveBeenCalled();
    });

    it('calls the loader on a miss, caches the result and uses the given ttl', async () => {
      const cache = make();
      const loader = jest.fn().mockResolvedValue(7);
      await expect(cache.getOrLoad('a', loader, 20)).resolves.toBe(7);
      expect(loader).toHaveBeenCalledTimes(1);
      now += 19;
      expect(cache.get('a')).toBe(7);
      now += 1;
      expect(cache.get('a')).toBeUndefined();
    });

    it('propagates loader rejection and caches nothing', async () => {
      const cache = make();
      const loader = jest.fn().mockRejectedValue(new Error('boom'));
      await expect(cache.getOrLoad('a', loader)).rejects.toThrow('boom');
      expect(cache.size).toBe(0);
    });
  });

  describe('delete', () => {
    it('returns true for an existing key and false otherwise', () => {
      const cache = make();
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('a')).toBe(false);
      expect(cache.size).toBe(0);
    });
  });

  describe('prune', () => {
    it('removes only expired entries and returns the count', () => {
      const cache = make();
      cache.set('short1', 1, 10);
      cache.set('short2', 2, 10);
      cache.set('long', 3, 1000);
      now += 10;
      expect(cache.prune()).toBe(2);
      expect(cache.size).toBe(1);
      expect(cache.get('long')).toBe(3);
    });

    it('returns 0 on an empty cache', () => {
      expect(make().prune()).toBe(0);
    });
  });

  describe('stats', () => {
    it('reports a hitRate of 0 when no lookups have happened', () => {
      expect(make().stats()).toEqual({ hits: 0, misses: 0, hitRate: 0 });
    });

    it('reports hits, misses and hitRate after mixed lookups', () => {
      const cache = make();
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // hit
      cache.get('missing'); // miss
      now += 100;
      cache.get('b'); // expired -> miss
      cache.get('a'); // expired -> miss
      expect(cache.stats()).toEqual({ hits: 1, misses: 3, hitRate: 0.25 });
    });
  });
});
