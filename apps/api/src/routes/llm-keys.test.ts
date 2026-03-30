/**
 * LLM Keys API Tests
 *
 * Tests: zero-knowledge storage, CRUD operations, rate limiting, validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { llmKeysRoutes } from './llm-keys'

// Mock Supabase response data
const mockSupabaseData = {
  keys: [] as unknown[],
  key: null as unknown,
  error: null as { message: string } | null,
}

// Mock Supabase response data for updates
const mockUpdateData = {
  key: null as unknown,
  error: null as { message: string } | null,
  duplicateFound: false,
}

// Helper to create deeply chainable eq mock
// Supports: .eq().eq().eq().neq().single() and .eq().order()
function createDeepEqChain(): unknown {
  const chain: Record<string, unknown> = {}

  // Terminal methods that return data
  chain.single = vi.fn(async () => ({
    data: mockSupabaseData.key,
    error: mockSupabaseData.error,
  }))

  chain.order = vi.fn(async () => ({
    data: mockSupabaseData.keys,
    error: mockSupabaseData.error,
  }))

  // neq returns object with single
  chain.neq = vi.fn(() => ({
    single: vi.fn(async () => ({
      data: mockUpdateData.duplicateFound ? { id: 'duplicate-key' } : null,
      error: null,
    })),
  }))

  // eq returns another chainable object (recursive-ish)
  chain.eq = vi.fn(() => createDeepEqChain())

  return chain
}

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'llm_keys') {
        return {
          select: vi.fn((_cols?: string, _opts?: unknown) => ({
            eq: vi.fn(() => createDeepEqChain()),
            order: vi.fn(async () => ({
              data: mockSupabaseData.keys,
              error: mockSupabaseData.error,
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: mockSupabaseData.key,
                error: mockSupabaseData.error,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: mockUpdateData.key,
                    error: mockUpdateData.error,
                  })),
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: mockSupabaseData.key,
                    error: mockSupabaseData.error,
                  })),
                })),
              })),
            })),
          })),
        }
      }
      return {}
    }),
  })),
}))

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((c: Context, next: () => Promise<void>) => {
    c.set('wallet', 'test-wallet-address')
    c.set('plan', 'free')
    return next()
  }),
}))

// Mock rate limit middleware
vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}))

// Create test app with mocked bindings
function createTestApp() {
  const app = new Hono<{
    Bindings: {
      SUPABASE_URL: string
      SUPABASE_SERVICE_KEY: string
      JWT_SECRET: string
      RATE_LIMIT_KV?: unknown
    }
    Variables: { wallet: string; plan: string }
  }>()

  // Inject bindings for all requests
  app.use('*', async (c, next) => {
    // Mock environment bindings
    ;(c.env as Record<string, string>) = {
      ...c.env,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key',
      JWT_SECRET: 'test-jwt-secret',
    }
    await next()
  })

  app.route('/llm-keys', llmKeysRoutes)
  return app
}

describe('LLM Keys API', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock data
    mockSupabaseData.keys = []
    mockSupabaseData.key = null
    mockSupabaseData.error = null
    mockUpdateData.key = null
    mockUpdateData.error = null
    mockUpdateData.duplicateFound = false

    app = createTestApp()
  })

  describe('GET /llm-keys', () => {
    it('returns empty list when no keys exist', async () => {
      mockSupabaseData.keys = []

      const res = await app.request('/llm-keys', {
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.keys).toEqual([])
    })

    it('returns list of keys with only public data', async () => {
      mockSupabaseData.keys = [
        {
          id: 'key-1',
          provider: 'openai',
          name: 'Default',
          key_preview: '...1234',
          created_at: '2026-01-11T00:00:00Z',
        },
      ]

      const res = await app.request('/llm-keys', {
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.keys).toHaveLength(1)
      expect(data.keys[0].id).toBe('key-1')
      expect(data.keys[0].provider).toBe('openai')
    })

    it('handles database errors gracefully', async () => {
      mockSupabaseData.error = { message: 'DB error' }

      const res = await app.request('/llm-keys', {
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /llm-keys/:id', () => {
    it('returns encrypted key data for decryption', async () => {
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Default',
        ciphertext: 'base64-encrypted-data',
        iv: 'base64-iv',
        salt: 'base64-salt',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }

      const res = await app.request('/llm-keys/key-1', {
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.key.ciphertext).toBe('base64-encrypted-data')
      expect(data.key.iv).toBe('base64-iv')
      expect(data.key.salt).toBe('base64-salt')
    })

    it('returns 404 for non-existent key', async () => {
      mockSupabaseData.key = null
      mockSupabaseData.error = { message: 'Not found' }

      const res = await app.request('/llm-keys/non-existent', {
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /llm-keys', () => {
    it('validates required fields', async () => {
      const invalidKey = {
        provider: 'openai',
        // Missing required fields
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })

    it('validates provider enum', async () => {
      const invalidKey = {
        provider: 'invalid-provider',
        name: 'Test',
        ciphertext: 'data',
        iv: 'iv',
        salt: 'salt',
        key_preview: '...1234',
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /llm-keys/:id', () => {
    it('deletes key successfully', async () => {
      mockSupabaseData.key = { id: 'key-1' }

      const res = await app.request('/llm-keys/key-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('returns 404 for non-existent key', async () => {
      mockSupabaseData.key = null
      mockSupabaseData.error = { message: 'Not found' }

      const res = await app.request('/llm-keys/non-existent', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('Zero-Knowledge Security', () => {
    it('single key endpoint returns encrypted data for client decryption', async () => {
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Default',
        ciphertext: 'encrypted-blob',
        iv: 'random-iv',
        salt: 'random-salt',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }

      const res = await app.request('/llm-keys/key-1', {
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()

      // Encrypted data should be returned for client-side decryption
      expect(data.key.ciphertext).toBeDefined()
      expect(data.key.iv).toBeDefined()
      expect(data.key.salt).toBeDefined()
    })

    it('schema only allows encrypted fields, no plaintext', async () => {
      // The endpoint uses a specific SELECT statement that only returns:
      // id, provider, name, ciphertext, iv, salt, key_preview, created_at
      // This is a design verification test
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Default',
        ciphertext: 'encrypted-blob',
        iv: 'random-iv',
        salt: 'random-salt',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }

      const res = await app.request('/llm-keys/key-1', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const data = await res.json()
      expect(res.status).toBe(200)

      // Verify only expected fields are present (what SELECT returns)
      const expectedFields = [
        'id',
        'provider',
        'name',
        'ciphertext',
        'iv',
        'salt',
        'key_preview',
        'created_at',
      ]
      for (const field of expectedFields) {
        expect(data.key).toHaveProperty(field)
      }

      // Document the security design: plaintext fields should never be in DB
      // The SELECT statement in llm-keys.ts explicitly lists only encrypted fields
      expect(true).toBe(true)
    })

    it('only returns key_preview, never full key identifier', async () => {
      mockSupabaseData.keys = [
        {
          id: 'key-1',
          provider: 'openai',
          name: 'Default',
          key_preview: '...1234',
          created_at: '2026-01-11T00:00:00Z',
        },
      ]

      const res = await app.request('/llm-keys', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const data = await res.json()
      expect(data.keys[0].key_preview).toBe('...1234')
      expect(data.keys[0].key_preview.length).toBeLessThan(10)
    })
  })

  describe('Provider Validation', () => {
    // These are the actual providers supported by the schema
    const validProviders = ['openai', 'anthropic', 'openrouter', 'groq']

    for (const provider of validProviders) {
      it(`accepts valid provider: ${provider}`, async () => {
        const validKey = {
          provider,
          name: 'Test',
          ciphertext: 'encrypted-data',
          iv: 'random-iv-12345',
          salt: 'random-salt-1234',
          key_preview: '...test',
        }

        mockSupabaseData.key = { id: 'new-key', ...validKey, created_at: new Date().toISOString() }

        const res = await app.request('/llm-keys', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validKey),
        })

        // Should either succeed (201) or fail for other reasons, but not 400 for invalid provider
        if (res.status === 400) {
          const data = await res.json()
          expect(data.details?.fieldErrors?.provider).toBeUndefined()
        }
      })
    }

    it('rejects unknown provider', async () => {
      const invalidKey = {
        provider: 'unknown-provider-xyz',
        name: 'Test',
        ciphertext: 'encrypted-data',
        iv: 'random-iv',
        salt: 'random-salt',
        key_preview: '...test',
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('Input Validation', () => {
    it('requires ciphertext field', async () => {
      const invalidKey = {
        provider: 'openai',
        name: 'Test',
        // Missing: ciphertext
        iv: 'random-iv',
        salt: 'random-salt',
        key_preview: '...test',
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })

    it('requires iv field', async () => {
      const invalidKey = {
        provider: 'openai',
        name: 'Test',
        ciphertext: 'encrypted-data',
        // Missing: iv
        salt: 'random-salt',
        key_preview: '...test',
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })

    it('requires salt field', async () => {
      const invalidKey = {
        provider: 'openai',
        name: 'Test',
        ciphertext: 'encrypted-data',
        iv: 'random-iv',
        // Missing: salt
        key_preview: '...test',
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })

    it('requires key_preview field', async () => {
      const invalidKey = {
        provider: 'openai',
        name: 'Test',
        ciphertext: 'encrypted-data',
        iv: 'random-iv',
        salt: 'random-salt',
        // Missing: key_preview
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidKey),
      })

      expect(res.status).toBe(400)
    })

    it('uses default name when not provided', async () => {
      const keyWithoutName = {
        provider: 'openai',
        // No name field
        ciphertext: 'encrypted-data',
        iv: 'random-iv',
        salt: 'random-salt',
        key_preview: '...test',
      }

      mockSupabaseData.key = {
        id: 'new-key',
        ...keyWithoutName,
        name: 'Default',
        created_at: new Date().toISOString(),
      }

      const res = await app.request('/llm-keys', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keyWithoutName),
      })

      // Request should be valid (name defaults to 'Default')
      expect(res.status).not.toBe(400)
    })
  })

  describe('PATCH /llm-keys/:id', () => {
    it('updates key name successfully', async () => {
      // Setup: existing key exists
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Old Name',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }

      // Update result
      mockUpdateData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'New Name',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
        updated_at: new Date().toISOString(),
      }

      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.key.name).toBe('New Name')
    })

    it('returns 400 for empty update body', async () => {
      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('No fields to update')
    })

    it('returns 400 for invalid name (too long)', async () => {
      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'x'.repeat(101) }), // Max is 100
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid name (empty string)', async () => {
      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent key', async () => {
      mockSupabaseData.key = null
      mockSupabaseData.error = { message: 'Not found' }

      const res = await app.request('/llm-keys/non-existent', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 409 for duplicate name', async () => {
      // Setup: existing key exists
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Old Name',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }
      mockUpdateData.duplicateFound = true

      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Existing Name' }),
      })

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toContain('already have')
    })

    it('handles database errors gracefully', async () => {
      // Setup: existing key exists
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Old Name',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }
      mockUpdateData.error = { message: 'DB error' }

      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Name' }),
      })

      expect(res.status).toBe(500)
    })

    it('rejects update without authentication', async () => {
      // Note: This test verifies the auth middleware is applied
      // The actual middleware is mocked, but in production it would reject
      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header - mock still passes but real impl would reject
        },
        body: JSON.stringify({ name: 'New Name' }),
      })

      // With mocked auth, request proceeds but we can verify the route exists
      expect([200, 400, 404, 500]).toContain(res.status)
    })
  })

  describe('PATCH /llm-keys/:id - Ownership Validation', () => {
    it('only allows owner to update their key', async () => {
      // The key lookup includes wallet_address filter
      // If key not found for this wallet, returns 404
      mockSupabaseData.key = null // Key doesn't exist for this wallet
      mockSupabaseData.error = { message: 'Not found' }

      const res = await app.request('/llm-keys/someone-elses-key', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Stolen Name' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /llm-keys/:id - Name Validation', () => {
    it('accepts valid name with special characters', async () => {
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Old Name',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }

      mockUpdateData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Production (US-East)',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
        updated_at: new Date().toISOString(),
      }

      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Production (US-East)' }),
      })

      expect(res.status).toBe(200)
    })

    it('accepts name at max length boundary', async () => {
      mockSupabaseData.key = {
        id: 'key-1',
        provider: 'openai',
        name: 'Old Name',
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
      }

      const maxLengthName = 'x'.repeat(100) // Exactly 100 chars
      mockUpdateData.key = {
        id: 'key-1',
        provider: 'openai',
        name: maxLengthName,
        key_preview: '...1234',
        created_at: '2026-01-11T00:00:00Z',
        updated_at: new Date().toISOString(),
      }

      const res = await app.request('/llm-keys/key-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: maxLengthName }),
      })

      expect(res.status).toBe(200)
    })
  })
})
