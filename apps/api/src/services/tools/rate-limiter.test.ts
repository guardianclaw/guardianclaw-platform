/**
 * Rate Limiter Tests
 *
 * Tests for the rate limiting abstraction.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryStore,
  RateLimiter,
  createInMemoryRateLimiter,
  getDefaultRateLimiter,
  setDefaultRateLimiter,
  resetDefaultRateLimiter,
} from './rate-limiter'

describe('rate-limiter', () => {
  // ============================================
  // IN-MEMORY STORE
  // ============================================

  describe('InMemoryStore', () => {
    let store: InMemoryStore

    beforeEach(() => {
      store = new InMemoryStore()
    })

    it('returns null for non-existent key', async () => {
      const result = await store.get('nonexistent')
      expect(result).toBeNull()
    })

    it('stores and retrieves values', async () => {
      await store.set('test-key', 5, 1000000, 60000)
      const result = await store.get('test-key')

      expect(result).not.toBeNull()
      expect(result?.count).toBe(5)
      expect(result?.windowStart).toBe(1000000)
    })

    it('increments count', async () => {
      await store.set('test-key', 1, Date.now(), 60000)

      const newCount = await store.increment('test-key')
      expect(newCount).toBe(2)

      const newCount2 = await store.increment('test-key')
      expect(newCount2).toBe(3)
    })

    it('returns 0 for increment on non-existent key', async () => {
      const result = await store.increment('nonexistent')
      expect(result).toBe(0)
    })

    it('deletes keys', async () => {
      await store.set('test-key', 1, Date.now(), 60000)
      await store.delete('test-key')

      const result = await store.get('test-key')
      expect(result).toBeNull()
    })

    it('expires entries based on TTL', async () => {
      // Set with very short TTL (1ms)
      await store.set('test-key', 1, Date.now(), 1)

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10))

      const result = await store.get('test-key')
      expect(result).toBeNull()
    })

    it('clears all entries', async () => {
      await store.set('key1', 1, Date.now(), 60000)
      await store.set('key2', 2, Date.now(), 60000)

      expect(store.size()).toBe(2)

      store.clear()

      expect(store.size()).toBe(0)
    })
  })

  // ============================================
  // RATE LIMITER
  // ============================================

  describe('RateLimiter', () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = createInMemoryRateLimiter('test:')
    })

    describe('check', () => {
      it('allows first request', async () => {
        const result = await limiter.check('user:123', 10, 60000)

        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(9)
        expect(result.count).toBe(1)
      })

      it('tracks request count', async () => {
        await limiter.check('user:123', 10, 60000)
        await limiter.check('user:123', 10, 60000)
        const result = await limiter.check('user:123', 10, 60000)

        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(7)
        expect(result.count).toBe(3)
      })

      it('blocks when limit exceeded', async () => {
        // Make 5 requests (limit is 5)
        for (let i = 0; i < 5; i++) {
          await limiter.check('user:123', 5, 60000)
        }

        // 6th request should be blocked
        const result = await limiter.check('user:123', 5, 60000)

        expect(result.allowed).toBe(false)
        expect(result.remaining).toBe(0)
        expect(result.count).toBe(5)
      })

      it('isolates different keys', async () => {
        await limiter.check('user:123', 10, 60000)
        await limiter.check('user:123', 10, 60000)

        const result = await limiter.check('user:456', 10, 60000)

        expect(result.allowed).toBe(true)
        expect(result.count).toBe(1) // First request for this user
      })

      it('provides reset time', async () => {
        const before = Date.now()
        const result = await limiter.check('user:123', 10, 60000)
        const after = Date.now()

        // Reset should be approximately 60 seconds from now
        expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000)
        expect(result.resetAt).toBeLessThanOrEqual(after + 60000)
      })
    })

    describe('reset', () => {
      it('resets rate limit for a key', async () => {
        // Use up some quota
        await limiter.check('user:123', 5, 60000)
        await limiter.check('user:123', 5, 60000)
        await limiter.check('user:123', 5, 60000)

        // Reset
        await limiter.reset('user:123')

        // Should have full quota again
        const result = await limiter.check('user:123', 5, 60000)
        expect(result.remaining).toBe(4) // 5 - 1 = 4
      })
    })

    describe('status', () => {
      it('returns status without incrementing', async () => {
        await limiter.check('user:123', 10, 60000)

        const status = await limiter.status('user:123', 10, 60000)

        expect(status.count).toBe(1)
        expect(status.remaining).toBe(9)

        // Check again - should still be 1
        const status2 = await limiter.status('user:123', 10, 60000)
        expect(status2.count).toBe(1)
      })

      it('returns full quota for new key', async () => {
        const status = await limiter.status('new:key', 10, 60000)

        expect(status.allowed).toBe(true)
        expect(status.remaining).toBe(10)
        expect(status.count).toBe(0)
      })
    })
  })

  // ============================================
  // DEFAULT LIMITER
  // ============================================

  describe('default limiter', () => {
    beforeEach(() => {
      resetDefaultRateLimiter()
    })

    it('creates default in-memory limiter', () => {
      const limiter = getDefaultRateLimiter()
      expect(limiter).toBeInstanceOf(RateLimiter)
    })

    it('returns same instance on multiple calls', () => {
      const limiter1 = getDefaultRateLimiter()
      const limiter2 = getDefaultRateLimiter()
      expect(limiter1).toBe(limiter2)
    })

    it('allows setting custom limiter', async () => {
      const customLimiter = createInMemoryRateLimiter('custom:')
      setDefaultRateLimiter(customLimiter)

      const limiter = getDefaultRateLimiter()
      expect(limiter).toBe(customLimiter)
    })

    it('resets to new instance after reset', () => {
      const limiter1 = getDefaultRateLimiter()
      resetDefaultRateLimiter()
      const limiter2 = getDefaultRateLimiter()

      expect(limiter1).not.toBe(limiter2)
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('edge cases', () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = createInMemoryRateLimiter()
    })

    it('handles zero max requests', async () => {
      const result = await limiter.check('user:123', 0, 60000)
      expect(result.allowed).toBe(false)
    })

    it('handles very short window', async () => {
      await limiter.check('user:123', 10, 1) // 1ms window

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should start new window
      const result = await limiter.check('user:123', 10, 1)
      expect(result.allowed).toBe(true)
      expect(result.count).toBe(1)
    })

    it('handles sequential requests exceeding limit', async () => {
      // Make sequential requests
      const results: Array<{ allowed: boolean }> = []
      for (let i = 0; i < 15; i++) {
        const result = await limiter.check('user:123', 10, 60000)
        results.push(result)
      }

      // First 10 should be allowed
      const allowed = results.filter((r) => r.allowed).length
      expect(allowed).toBe(10)

      // Last 5 should be blocked
      const blocked = results.filter((r) => !r.allowed).length
      expect(blocked).toBe(5)
    })
  })
})
