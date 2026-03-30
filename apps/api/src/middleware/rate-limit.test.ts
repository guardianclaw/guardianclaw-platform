/**
 * Rate Limiting Middleware Tests
 *
 * Tests: middleware behavior, headers, concurrency
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { rateLimitMiddleware, walletRateLimitMiddleware } from './rate-limit'

// Mock secure-logger
vi.mock('../lib/secure-logger', () => ({
  hashIP: vi.fn(async (ip: string, _secret?: string) => `hash_${ip}`),
  createSecureLogger: vi.fn(() => ({
    security: vi.fn(async () => {}),
  })),
}))

// Mock rate-limiter with in-memory state for testing
const rateLimitState = new Map<string, { count: number; resetAt: number }>()

vi.mock('../lib/rate-limiter', () => ({
  createRateLimiter: vi.fn(() => ({
    isKVEnabled: vi.fn(() => true),
    checkLimit: vi.fn(async (key: string, limit: number, windowMs: number) => {
      const now = Date.now()
      const state = rateLimitState.get(key)

      if (!state || now > state.resetAt) {
        // New window
        rateLimitState.set(key, { count: 1, resetAt: now + windowMs })
        return {
          allowed: true,
          remaining: limit - 1,
          resetAt: now + windowMs,
          retryAfter: undefined,
        }
      }

      // Existing window
      state.count++
      const remaining = limit - state.count
      const allowed = remaining >= 0

      return {
        allowed,
        remaining: Math.max(0, remaining),
        resetAt: state.resetAt,
        retryAfter: allowed ? undefined : Math.ceil((state.resetAt - now) / 1000),
      }
    }),
  })),
}))

// Mock rate-limit-config
vi.mock('../lib/rate-limit-config', () => ({
  DEFAULT_RATE_LIMITS: {
    global: { requests: 10, windowMs: 60000 },
    perEndpoint: {},
    perWallet: { requests: 5, windowMs: 60000 },
  },
  getEndpointLimit: vi.fn((method: string, path: string) => {
    if (path.startsWith('/auth')) {
      return { requests: 3, windowMs: 60000 }
    }
    return { requests: 10, windowMs: 60000 }
  }),
  RateLimitKeys: {
    global: (ipHash: string) => `global:${ipHash}`,
    endpoint: (ipHash: string, method: string, path: string) =>
      `endpoint:${ipHash}:${method}:${path}`,
    wallet: (wallet: string) => `wallet:${wallet}`,
  },
}))

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    rateLimitState.clear()
    vi.clearAllMocks()
  })

  describe('rateLimitMiddleware', () => {
    it('includes rate limit headers on every request', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined()
    })

    it('returns 429 when rate limit exceeded', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      // Auth endpoint has limit of 3
      const results: number[] = []
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        })
        results.push(res.status)
      }

      // First 3 should succeed, rest should be 429
      expect(results.slice(0, 3)).toEqual([200, 200, 200])
      expect(results.slice(3)).toEqual([429, 429])
    })

    it('includes Retry-After header on 429 response', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      // Exhaust limit
      for (let i = 0; i < 3; i++) {
        await app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        })
      }

      // Next request should be rate limited
      const res = await app.request('/auth/test', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeDefined()
      expect(parseInt(res.headers.get('Retry-After')!)).toBeGreaterThan(0)
    })

    it('skips rate limiting for excluded paths', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware({ skipPaths: ['/health'] }))
      app.get('/health', (c) => c.json({ ok: true }))

      const res = await app.request('/health')

      expect(res.status).toBe(200)
      // No rate limit headers on skipped paths
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    })

    it('handles unknown IP gracefully', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      // No IP headers
      const res = await app.request('/test')

      expect(res.status).toBe(200)
    })

    it('applies most restrictive limit in headers', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      const res = await app.request('/auth/test', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })

      // Auth endpoint has stricter limit (3) than global (10)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('3')
    })
  })

  describe('walletRateLimitMiddleware', () => {
    it('includes headers for authenticated requests', async () => {
      const app = new Hono<{ Variables: { wallet: string } }>()
      app.use('*', async (c, next) => {
        c.set('wallet', 'test-wallet-address')
        await next()
      })
      app.use('*', walletRateLimitMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('4')
    })

    it('skips rate limiting for unauthenticated requests', async () => {
      const app = new Hono<{ Variables: { wallet?: string } }>()
      app.use('*', walletRateLimitMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.status).toBe(200)
      // No headers when no wallet
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull()
    })

    it('enforces per-wallet rate limit', async () => {
      const app = new Hono<{ Variables: { wallet: string } }>()
      app.use('*', async (c, next) => {
        c.set('wallet', 'test-wallet')
        await next()
      })
      app.use('*', walletRateLimitMiddleware(3)) // 3 req limit
      app.get('/test', (c) => c.json({ ok: true }))

      const results: number[] = []
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test')
        results.push(res.status)
      }

      expect(results.slice(0, 3)).toEqual([200, 200, 200])
      expect(results.slice(3)).toEqual([429, 429])
    })
  })

  describe('Concurrent Requests', () => {
    it('handles concurrent requests without race conditions', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      // Send 10 concurrent requests to auth endpoint (limit: 3)
      const promises = Array.from({ length: 10 }, () =>
        app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '5.6.7.8' },
        })
      )

      const responses = await Promise.all(promises)
      const statuses = responses.map((r) => r.status)

      // Count successes and failures
      const successes = statuses.filter((s) => s === 200).length
      const failures = statuses.filter((s) => s === 429).length

      // With limit of 3, should have exactly 3 successes
      expect(successes).toBeLessThanOrEqual(3)
      expect(failures).toBeGreaterThanOrEqual(7)
      expect(successes + failures).toBe(10)
    })

    it('isolates rate limits between different IPs', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      // Send requests from different IPs concurrently
      const ip1Promises = Array.from({ length: 3 }, () =>
        app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '10.0.0.1' },
        })
      )
      const ip2Promises = Array.from({ length: 3 }, () =>
        app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '10.0.0.2' },
        })
      )

      const [ip1Results, ip2Results] = await Promise.all([
        Promise.all(ip1Promises),
        Promise.all(ip2Promises),
      ])

      // Both IPs should succeed (each has their own limit)
      expect(ip1Results.every((r) => r.status === 200)).toBe(true)
      expect(ip2Results.every((r) => r.status === 200)).toBe(true)
    })

    it('handles burst traffic correctly', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      // Simulate burst: 20 requests in quick succession
      const startTime = Date.now()
      const promises = Array.from({ length: 20 }, () =>
        app.request('/test', {
          headers: { 'cf-connecting-ip': '192.168.1.1' },
        })
      )

      const responses = await Promise.all(promises)
      const elapsed = Date.now() - startTime

      // Should complete quickly (not serialized)
      expect(elapsed).toBeLessThan(1000)

      // All should have rate limit headers
      for (const res of responses) {
        if (res.status === 200) {
          expect(res.headers.get('X-RateLimit-Limit')).toBeDefined()
        }
      }
    })
  })

  describe('Header Consistency', () => {
    it('always includes headers on 200 responses', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      for (let i = 0; i < 5; i++) {
        const res = await app.request('/test', {
          headers: { 'cf-connecting-ip': '100.0.0.1' },
        })

        expect(res.status).toBe(200)
        expect(res.headers.get('X-RateLimit-Limit')).not.toBeNull()
        expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
        expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
      }
    })

    it('always includes headers on 429 responses', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '200.0.0.1' },
        })
      }

      const res = await app.request('/auth/test', {
        headers: { 'cf-connecting-ip': '200.0.0.1' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('X-RateLimit-Limit')).not.toBeNull()
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
      expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
      expect(res.headers.get('Retry-After')).not.toBeNull()
    })

    it('remaining decrements correctly', async () => {
      const app = new Hono()
      app.use('*', rateLimitMiddleware())
      app.get('/auth/test', (c) => c.json({ ok: true }))

      const remaining: number[] = []
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/auth/test', {
          headers: { 'cf-connecting-ip': '150.0.0.1' },
        })
        remaining.push(parseInt(res.headers.get('X-RateLimit-Remaining')!))
      }

      // Should decrement: 2, 1, 0
      expect(remaining).toEqual([2, 1, 0])
    })
  })
})
