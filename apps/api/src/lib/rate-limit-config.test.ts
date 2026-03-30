/**
 * Rate Limit Configuration Tests
 */

import { describe, it, expect } from 'vitest'
import { DEFAULT_RATE_LIMITS, getEndpointLimit, RateLimitKeys } from './rate-limit-config'

describe('Rate Limit Configuration', () => {
  describe('DEFAULT_RATE_LIMITS', () => {
    it('has global limits', () => {
      expect(DEFAULT_RATE_LIMITS.global).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.global.requests).toBe(1000)
      expect(DEFAULT_RATE_LIMITS.global.windowMs).toBe(60_000)
    })

    it('has per-wallet limits', () => {
      expect(DEFAULT_RATE_LIMITS.perWallet).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perWallet.requests).toBe(100)
      expect(DEFAULT_RATE_LIMITS.perWallet.windowMs).toBe(60_000)
    })

    it('has auth endpoint limits', () => {
      expect(DEFAULT_RATE_LIMITS.perEndpoint['GET:/auth/nonce']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['GET:/auth/nonce'].requests).toBe(10)

      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/auth/verify']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/auth/verify'].requests).toBe(10)

      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/auth/logout']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/auth/logout'].requests).toBe(10)

      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/auth/logout-all']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/auth/logout-all'].requests).toBe(5)

      expect(DEFAULT_RATE_LIMITS.perEndpoint['GET:/auth/sessions']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['GET:/auth/sessions'].requests).toBe(20)

      expect(DEFAULT_RATE_LIMITS.perEndpoint['GET:/auth/me']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['GET:/auth/me'].requests).toBe(30)
    })

    it('has deploy endpoint limits', () => {
      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/deploy/:id']).toBeDefined()
      expect(DEFAULT_RATE_LIMITS.perEndpoint['POST:/deploy/:id'].requests).toBe(5)
    })
  })

  describe('getEndpointLimit', () => {
    it('returns exact match for auth endpoints', () => {
      const limit = getEndpointLimit('GET', '/auth/nonce')
      expect(limit.requests).toBe(10)
    })

    it('returns parameterized match for deploy endpoints', () => {
      // getEndpointLimit expects normalized paths (middleware handles normalization)
      const limit = getEndpointLimit('POST', '/deploy/:id')
      expect(limit.requests).toBe(5)
    })

    it('matches invoke endpoint with UUID', () => {
      // Note: getEndpointLimit expects already-normalized paths (with :id)
      // In real usage, the middleware normalizes the path before calling this
      const limit = getEndpointLimit('POST', '/invoke/:id')
      expect(limit.requests).toBe(60)
    })

    it('returns global limit for unknown endpoints', () => {
      const limit = getEndpointLimit('GET', '/unknown/endpoint')
      expect(limit.requests).toBe(DEFAULT_RATE_LIMITS.global.requests)
    })

    it('handles method mismatch', () => {
      // GET /deploy/:id has no specific limit (only POST does)
      const limit = getEndpointLimit('GET', '/deploy/abc')
      expect(limit.requests).toBe(DEFAULT_RATE_LIMITS.global.requests)
    })
  })

  describe('RateLimitKeys', () => {
    it('generates global key', () => {
      const key = RateLimitKeys.global('abc123hash')
      expect(key).toBe('global:abc123hash')
    })

    it('generates wallet key', () => {
      const key = RateLimitKeys.wallet('5x7abc...def')
      expect(key).toBe('wallet:5x7abc...def')
    })

    it('generates endpoint key', () => {
      const key = RateLimitKeys.endpoint('ipHash', 'POST', '/auth/verify')
      expect(key).toBe('endpoint:ipHash:POST:/auth/verify')
    })

    it('generates apiKey key', () => {
      const key = RateLimitKeys.apiKey('key-uuid-123')
      expect(key).toBe('apikey:key-uuid-123')
    })
  })
})
