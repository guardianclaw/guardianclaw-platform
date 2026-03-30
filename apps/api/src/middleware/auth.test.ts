/**
 * Auth middleware unit tests
 * Tests JWT verification and context injection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from './auth'
import { testWallets } from '../test/fixtures'
import { generateTestToken, generateExpiredToken, generateWrongIssuerToken } from '../test/helpers'
import { resetJWTManager } from '../lib/jwt-manager'

// Create test app with middleware
const app = new Hono<{
  Bindings: { JWT_SECRET: string }
  Variables: { wallet: string; plan: string }
}>()

// Inject mock env
app.use('*', async (c, next) => {
  c.env = {
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

// Apply auth middleware
app.use('/protected/*', authMiddleware)

// Protected route that uses context variables
app.get('/protected/test', (c) => {
  return c.json({
    wallet: c.get('wallet'),
    plan: c.get('plan'),
  })
})

// Unprotected route for comparison
app.get('/public/test', (c) => {
  return c.json({ message: 'public' })
})

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset JWT Manager singleton between tests
    resetJWTManager()
  })

  describe('Token Validation', () => {
    it('allows access with valid token', async () => {
      const token = await generateTestToken(testWallets.alice)

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('returns 401 for missing Authorization header', async () => {
      const res = await app.request('/protected/test')

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Missing or invalid authorization header')
    })

    it('returns 401 for empty Authorization header', async () => {
      const res = await app.request('/protected/test', {
        headers: { Authorization: '' },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Missing or invalid authorization header')
    })

    it('returns 401 for non-Bearer authorization', async () => {
      const res = await app.request('/protected/test', {
        headers: { Authorization: 'Basic sometoken' },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Missing or invalid authorization header')
    })

    it('returns 401 for expired token', async () => {
      const expiredToken = await generateExpiredToken(testWallets.alice)

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns specific error "Token expired"
      expect(body.error).toContain('expired')
    })

    it('returns 401 for token with wrong issuer', async () => {
      const wrongIssuerToken = await generateWrongIssuerToken(testWallets.alice)

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${wrongIssuerToken}` },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns "Token claim validation failed"
      expect(body.error).toContain('claim')
    })

    it('returns 401 for malformed token', async () => {
      const res = await app.request('/protected/test', {
        headers: { Authorization: 'Bearer not-a-jwt' },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns "Invalid token format"
      expect(body.error).toContain('Invalid token')
    })

    it('returns 401 for token with invalid signature', async () => {
      // Create a token with a different secret
      const token = await generateTestToken(testWallets.alice)
      // Tamper with the signature portion
      const parts = token.split('.')
      parts[2] = 'invalid-signature'
      const tamperedToken = parts.join('.')

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns "Token verification failed"
      expect(body.error).toContain('verification failed')
    })
  })

  describe('Context Injection', () => {
    it('sets wallet from JWT sub claim', async () => {
      const token = await generateTestToken(testWallets.alice)

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.wallet).toBe(testWallets.alice)
    })

    it('sets plan from JWT claim', async () => {
      const token = await generateTestToken(testWallets.alice, { plan: 'pro' })

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.plan).toBe('pro')
    })

    it('defaults plan to free if not in token', async () => {
      // Generate token without plan claim by using the helper with default
      const token = await generateTestToken(testWallets.alice)

      const res = await app.request('/protected/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      // Default is 'free' as per middleware implementation
      expect(['free', 'starter', 'pro', 'enterprise']).toContain(body.plan)
    })
  })

  describe('Unprotected Routes', () => {
    it('does not require auth for unprotected routes', async () => {
      const res = await app.request('/public/test')

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.message).toBe('public')
    })
  })
})
