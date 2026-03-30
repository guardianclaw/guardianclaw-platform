/**
 * Auth routes unit tests
 * Tests: GET /auth/nonce, POST /auth/verify, GET /auth/me
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { authRoutes } from './auth'
import { testWallets } from '../test/fixtures'
import { generateTestToken, generateExpiredToken, generateWrongIssuerToken } from '../test/helpers'
import { resetJWTManager } from '../lib/jwt-manager'

// Create a proper chainable mock that supports async terminal methods
function createSupabaseMock() {
  let upsertResult = { error: null }
  let insertResult = { error: null }
  let updateResult = { error: null }
  let deleteResult = { error: null }
  let selectResult: { data: unknown; error: unknown; count?: number } = { data: null, error: null }

  // Default profile for plan lookups
  const defaultProfile = { plan: 'free', plan_expires_at: null }

  const createChainable = (): Record<string, unknown> => {
    const chainable: Record<string, unknown> = {}

    chainable.from = vi.fn(() => chainable)
    chainable.select = vi.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact') {
        // Return count result
        return {
          ...chainable,
          eq: vi.fn(() => ({
            ...chainable,
            is: vi.fn(() => ({
              ...chainable,
              gt: vi.fn(() => ({
                ...chainable,
                not: vi.fn(() => Promise.resolve({ count: 0, error: null })),
                then: (resolve: (v: unknown) => unknown) => resolve({ count: 0, error: null }),
              })),
            })),
            not: vi.fn(() => ({
              ...chainable,
              gt: vi.fn(() => Promise.resolve({ count: 0, error: null })),
            })),
          })),
        }
      }
      return chainable
    })
    chainable.insert = vi.fn(() => Promise.resolve(insertResult))
    chainable.update = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve(updateResult)),
    }))
    chainable.delete = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve(deleteResult)),
    }))
    chainable.upsert = vi.fn(() => Promise.resolve(upsertResult))
    chainable.eq = vi.fn(() => chainable)
    chainable.is = vi.fn(() => chainable)
    chainable.gt = vi.fn(() => chainable)
    chainable.not = vi.fn(() => chainable)
    chainable.order = vi.fn(() => chainable)
    chainable.limit = vi.fn(() => chainable)
    chainable.single = vi.fn(() => {
      // If selectResult.data is null, return null (for expired nonce tests)
      if (selectResult.data === null) {
        return Promise.resolve(selectResult)
      }
      // For session lookups (has nonce property), return the session
      if (
        selectResult.data &&
        typeof selectResult.data === 'object' &&
        'nonce' in selectResult.data
      ) {
        return Promise.resolve(selectResult)
      }
      // For profile lookups
      return Promise.resolve({ data: defaultProfile, error: null })
    })

    return chainable
  }

  const chainable = createChainable()

  return {
    mock: chainable,
    setUpsertResult: (result: { error: unknown }) => {
      upsertResult = result
    },
    setInsertResult: (result: { error: unknown }) => {
      insertResult = result
    },
    setUpdateResult: (result: { error: unknown }) => {
      updateResult = result
    },
    setDeleteResult: (result: { error: unknown }) => {
      deleteResult = result
    },
    setSelectResult: (result: { data: unknown; error?: unknown }) => {
      selectResult = { data: result.data, error: result.error ?? null }
    },
    reset: () => {
      upsertResult = { error: null }
      insertResult = { error: null }
      updateResult = { error: null }
      deleteResult = { error: null }
      selectResult = { data: null, error: null }
      vi.clearAllMocks()
    },
  }
}

const supabaseMock = createSupabaseMock()

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => supabaseMock.mock),
}))

// Mock ed25519 verification - default to true
let ed25519VerifyResult = true
vi.mock('@noble/ed25519', () => ({
  verifyAsync: vi.fn(() => Promise.resolve(ed25519VerifyResult)),
}))

// Mock bs58
vi.mock('bs58', () => ({
  default: {
    decode: vi.fn(() => new Uint8Array(32).fill(1)),
  },
}))

// Create test app with mock environment
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    JWT_SECRET: string
  }
}>()

// Inject mock env
app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/auth', authRoutes)

describe('Auth Routes', () => {
  beforeEach(() => {
    supabaseMock.reset()
    ed25519VerifyResult = true
    // Reset JWT Manager singleton between tests
    resetJWTManager()
  })

  describe('GET /auth/nonce', () => {
    it('returns nonce for valid wallet', async () => {
      const res = await app.request(`/auth/nonce?wallet=${testWallets.alice}`)

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.nonce).toBeDefined()
      expect(body.message).toBeDefined()
      expect(body.expires_at).toBeDefined()
    })

    it('returns 400 for missing wallet', async () => {
      const res = await app.request('/auth/nonce')

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Invalid wallet address')
    })

    it('returns 400 for invalid wallet (too short)', async () => {
      const res = await app.request('/auth/nonce?wallet=short')

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Invalid wallet address')
    })

    it('message includes wallet and nonce', async () => {
      const res = await app.request(`/auth/nonce?wallet=${testWallets.alice}`)
      const body = await res.json()

      expect(body.message).toContain(testWallets.alice)
      expect(body.message).toContain(body.nonce)
      expect(body.message).toContain('guardianclaw.org')
    })

    it('returns 500 on profile creation error', async () => {
      supabaseMock.setUpsertResult({ error: { message: 'Database error' } })

      const res = await app.request(`/auth/nonce?wallet=${testWallets.alice}`)

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error).toBe('Failed to create profile')
    })

    it('returns 500 on session creation error', async () => {
      supabaseMock.setInsertResult({ error: { message: 'Session error' } })

      const res = await app.request(`/auth/nonce?wallet=${testWallets.alice}`)

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error).toBe('Failed to create session')
    })

    it('expires_at is in the future (5 minutes)', async () => {
      const beforeRequest = Date.now()
      const res = await app.request(`/auth/nonce?wallet=${testWallets.alice}`)
      const body = await res.json()

      const expiresAt = new Date(body.expires_at).getTime()
      const expectedMin = beforeRequest + 4 * 60 * 1000 // At least 4 minutes
      const expectedMax = beforeRequest + 6 * 60 * 1000 // At most 6 minutes

      expect(expiresAt).toBeGreaterThan(expectedMin)
      expect(expiresAt).toBeLessThan(expectedMax)
    })
  })

  describe('POST /auth/verify', () => {
    const validNonce = '123e4567-e89b-12d3-a456-426614174000'

    it('returns JWT for valid signature', async () => {
      supabaseMock.setSelectResult({
        data: { id: 'session-1', wallet_address: testWallets.alice, nonce: validNonce },
      })

      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: testWallets.alice,
          signature: 'valid-signature-base58',
          nonce: validNonce,
          message: `Test message with ${validNonce} and ${testWallets.alice}`,
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.token).toBeDefined()
      expect(body.wallet).toBe(testWallets.alice)
      expect(body.expires_at).toBeDefined()
    })

    it('returns 400 for invalid request body', async () => {
      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'body' }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Invalid request')
    })

    it('returns 401 for expired nonce', async () => {
      supabaseMock.setSelectResult({ data: null })

      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: testWallets.alice,
          signature: 'some-signature',
          nonce: validNonce,
          message: `Test message with ${validNonce} and ${testWallets.alice}`,
        }),
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Invalid or expired nonce')
    })

    it('returns 401 for message tampering (wrong nonce)', async () => {
      supabaseMock.setSelectResult({
        data: { id: 'session-1', wallet_address: testWallets.alice, nonce: validNonce },
      })

      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: testWallets.alice,
          signature: 'some-signature',
          nonce: validNonce,
          message: 'Message with wrong-nonce',
        }),
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Message does not match nonce or wallet')
    })

    it('returns 401 for message tampering (wrong wallet)', async () => {
      supabaseMock.setSelectResult({
        data: { id: 'session-1', wallet_address: testWallets.alice, nonce: validNonce },
      })

      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: testWallets.alice,
          signature: 'some-signature',
          nonce: validNonce,
          message: `Message with ${validNonce} but wrong wallet`,
        }),
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Message does not match nonce or wallet')
    })

    it('returns 401 for invalid signature', async () => {
      ed25519VerifyResult = false

      supabaseMock.setSelectResult({
        data: { id: 'session-1', wallet_address: testWallets.alice, nonce: validNonce },
      })

      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: testWallets.alice,
          signature: 'invalid-signature',
          nonce: validNonce,
          message: `Test message with ${validNonce} and ${testWallets.alice}`,
        }),
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Invalid signature')
    })
  })

  describe('GET /auth/me', () => {
    it('returns profile for valid token', async () => {
      const token = await generateTestToken(testWallets.alice)

      supabaseMock.setSelectResult({
        data: {
          wallet_address: testWallets.alice,
          plan: 'free',
          created_at: new Date().toISOString(),
        },
      })

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.wallet).toBe(testWallets.alice)
      expect(body.profile).toBeDefined()
    })

    it('returns 401 for missing Authorization header', async () => {
      const res = await app.request('/auth/me')

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Missing token')
    })

    it('returns 401 for non-Bearer authorization', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Basic some-token' },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body.error).toBe('Missing token')
    })

    it('returns 401 for expired token', async () => {
      const expiredToken = await generateExpiredToken(testWallets.alice)

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns specific error messages
      expect(body.error).toContain('expired')
    })

    it('returns 401 for token with wrong issuer', async () => {
      const wrongIssuerToken = await generateWrongIssuerToken(testWallets.alice)

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${wrongIssuerToken}` },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns specific error messages for claim validation
      expect(body.error).toContain('claim') // "Token claim validation failed"
    })

    it('returns 401 for malformed token', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Bearer not.a.valid.jwt.token' },
      })

      expect(res.status).toBe(401)

      const body = await res.json()
      // JWT Manager returns specific error for invalid format
      expect(body.error).toContain('Invalid token')
    })
  })
})
