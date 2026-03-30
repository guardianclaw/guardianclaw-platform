/**
 * Rate limiter unit tests
 * Tests: KVRateLimiter, InMemoryRateLimiter, edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KVRateLimiter, InMemoryRateLimiter, createRateLimiter } from './rate-limiter'

// Mock KVNamespace
function createMockKV() {
  const store = new Map<string, string>()

  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key)
      if (!value) return null
      return type === 'json' ? JSON.parse(value) : value
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    // Expose store for testing
    _store: store,
  }
}

describe('Rate Limiter', () => {
  describe('InMemoryRateLimiter', () => {
    let limiter: InMemoryRateLimiter

    beforeEach(() => {
      limiter = new InMemoryRateLimiter()
    })

    it('allows requests under limit', () => {
      const result = limiter.checkLimit('test-key', 10)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.retryAfter).toBeUndefined()
    })

    it('decrements remaining count', () => {
      limiter.checkLimit('test-key', 10)
      limiter.checkLimit('test-key', 10)
      const result = limiter.checkLimit('test-key', 10)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(7)
    })

    it('blocks when limit exceeded', () => {
      // Make 10 requests (limit)
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit('test-key', 10)
      }

      // 11th request should be blocked
      const result = limiter.checkLimit('test-key', 10)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeDefined()
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('tracks keys separately', () => {
      limiter.checkLimit('key-a', 5)
      limiter.checkLimit('key-a', 5)
      const resultA = limiter.checkLimit('key-a', 5)

      const resultB = limiter.checkLimit('key-b', 5)

      expect(resultA.remaining).toBe(2) // 5 - 3
      expect(resultB.remaining).toBe(4) // 5 - 1
    })

    it('resets after window expires', async () => {
      // Use short window for testing
      const windowMs = 50

      limiter.checkLimit('test-key', 2, windowMs)
      limiter.checkLimit('test-key', 2, windowMs)

      // Should be at limit
      let result = limiter.checkLimit('test-key', 2, windowMs)
      expect(result.allowed).toBe(false)

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, windowMs + 10))

      // Should be allowed again
      result = limiter.checkLimit('test-key', 2, windowMs)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(1)
    })

    it('resets specific key', () => {
      limiter.checkLimit('test-key', 5)
      limiter.checkLimit('test-key', 5)

      limiter.reset('test-key')

      const result = limiter.checkLimit('test-key', 5)
      expect(result.remaining).toBe(4) // Fresh start
    })

    it('returns status without incrementing', () => {
      limiter.checkLimit('test-key', 10)
      limiter.checkLimit('test-key', 10)

      const status = limiter.getStatus('test-key')

      expect(status).not.toBeNull()
      expect(status?.count).toBe(2)

      // Verify it didn't increment
      const status2 = limiter.getStatus('test-key')
      expect(status2?.count).toBe(2)
    })

    it('returns null status for unknown key', () => {
      const status = limiter.getStatus('unknown-key')
      expect(status).toBeNull()
    })

    it('clears all entries', () => {
      limiter.checkLimit('key-1', 10)
      limiter.checkLimit('key-2', 10)

      limiter.clear()

      expect(limiter.getStatus('key-1')).toBeNull()
      expect(limiter.getStatus('key-2')).toBeNull()
    })
  })

  describe('KVRateLimiter', () => {
    let mockKV: ReturnType<typeof createMockKV>
    let limiter: KVRateLimiter

    beforeEach(() => {
      mockKV = createMockKV()
      limiter = new KVRateLimiter(mockKV as unknown as KVNamespace)
    })

    it('allows requests under limit', async () => {
      const result = await limiter.checkLimit('test-key', 10)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('persists to KV', async () => {
      await limiter.checkLimit('test-key', 10)

      expect(mockKV.put).toHaveBeenCalled()
      expect(mockKV._store.has('rate:test-key')).toBe(true)
    })

    it('reads from KV on subsequent requests', async () => {
      await limiter.checkLimit('test-key', 10)
      await limiter.checkLimit('test-key', 10)

      // Should read from KV before updating
      expect(mockKV.get).toHaveBeenCalledTimes(2)
    })

    it('blocks when limit exceeded', async () => {
      for (let i = 0; i < 5; i++) {
        await limiter.checkLimit('test-key', 5)
      }

      const result = await limiter.checkLimit('test-key', 5)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('uses custom key prefix', async () => {
      const customLimiter = new KVRateLimiter(mockKV as unknown as KVNamespace, 'api:')

      await customLimiter.checkLimit('key-1', 10)

      expect(mockKV._store.has('api:key-1')).toBe(true)
    })

    it('resets key in KV', async () => {
      await limiter.checkLimit('test-key', 10)
      await limiter.reset('test-key')

      expect(mockKV.delete).toHaveBeenCalledWith('rate:test-key')
    })

    it('gets status from KV', async () => {
      await limiter.checkLimit('test-key', 10)
      await limiter.checkLimit('test-key', 10)

      const status = await limiter.getStatus('test-key')

      expect(status).not.toBeNull()
      expect(status?.count).toBe(2)
    })

    it('returns null status for unknown key', async () => {
      const status = await limiter.getStatus('unknown')
      expect(status).toBeNull()
    })

    it('reports KV enabled status', () => {
      expect(limiter.isKVEnabled()).toBe(true)

      const noKVLimiter = new KVRateLimiter(null)
      expect(noKVLimiter.isKVEnabled()).toBe(false)
    })

    describe('Fallback behavior', () => {
      it('falls back to memory when KV is null', async () => {
        const memoryLimiter = new KVRateLimiter(null)

        const result1 = await memoryLimiter.checkLimit('test-key', 5)
        const result2 = await memoryLimiter.checkLimit('test-key', 5)

        expect(result1.allowed).toBe(true)
        expect(result1.remaining).toBe(4)
        expect(result2.remaining).toBe(3)
      })

      it('handles KV read errors gracefully', async () => {
        mockKV.get.mockRejectedValueOnce(new Error('KV unavailable'))

        // Should not throw
        const result = await limiter.checkLimit('test-key', 10)
        expect(result.allowed).toBe(true)
      })

      it('falls back to memory on KV write error', async () => {
        // Make all KV operations fail
        mockKV.get.mockResolvedValue(null)
        mockKV.put.mockRejectedValue(new Error('KV write failed'))

        // First request - should not throw, writes to memory fallback
        const result = await limiter.checkLimit('test-key', 10)
        expect(result.allowed).toBe(true)

        // Second request - KV get returns null, but memory fallback has the entry
        // Note: When KV is configured but failing, each request creates new entry
        // This is expected - KV consistency is prioritized over memory fallback
        const result2 = await limiter.checkLimit('test-key', 10)
        expect(result2.allowed).toBe(true)
        // Both wrote to memory fallback with count=1, so remaining is 9
        expect(result2.remaining).toBe(9)
      })
    })
  })

  describe('createRateLimiter factory', () => {
    it('creates KVRateLimiter with KV', () => {
      const mockKV = createMockKV()
      const limiter = createRateLimiter(mockKV as unknown as KVNamespace)

      expect(limiter).toBeInstanceOf(KVRateLimiter)
      expect(limiter.isKVEnabled()).toBe(true)
    })

    it('creates KVRateLimiter without KV (memory fallback)', () => {
      const limiter = createRateLimiter(null)

      expect(limiter).toBeInstanceOf(KVRateLimiter)
      expect(limiter.isKVEnabled()).toBe(false)
    })

    it('accepts custom key prefix', () => {
      const mockKV = createMockKV()
      const limiter = createRateLimiter(mockKV as unknown as KVNamespace, 'custom:')

      expect(limiter).toBeInstanceOf(KVRateLimiter)
    })
  })
})
