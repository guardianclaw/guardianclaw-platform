/**
 * Webhook Endpoint Route Handler Tests
 *
 * Tests for the actual route handlers with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'

// Mock state for Supabase responses
const mockState = {
  agent: null as unknown,
  agentError: null as { message: string } | null,
  endpoint: null as unknown,
  endpointError: null as { message: string } | null,
  endpoints: [] as unknown[],
  endpointsCount: 0,
  insertResult: null as unknown,
  insertError: null as { message: string } | null,
  updateResult: null as unknown,
  updateError: null as { message: string } | null,
  deleteError: null as { message: string } | null,
  deliveries: [] as unknown[],
  deliveriesCount: 0,
  deliveriesError: null as { message: string } | null,
}

// Mock Supabase client - must be before importing routes
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'agents') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: mockState.agent,
                  error: mockState.agentError,
                })),
              })),
            })),
          })),
        }
      }
      if (table === 'webhook_endpoints') {
        return {
          select: vi.fn((_cols?: string, _opts?: { count?: string; head?: boolean }) => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: mockState.endpoint,
                  error: mockState.endpointError,
                })),
                order: vi.fn(async () => ({
                  data: mockState.endpoints,
                  error: mockState.endpointError,
                })),
              })),
              single: vi.fn(async () => ({
                data: mockState.endpoint,
                error: mockState.endpointError,
              })),
              // For GET list: .select().eq(agent_id).order()
              order: vi.fn(async () => ({
                data: mockState.endpoints,
                error: mockState.endpointError,
              })),
            })),
            then: (resolve: (v: unknown) => void) =>
              resolve({
                count: mockState.endpointsCount,
              }),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: mockState.insertResult,
                error: mockState.insertError,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: mockState.updateResult,
                    error: mockState.updateError,
                  })),
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                error: mockState.deleteError,
              })),
            })),
          })),
        }
      }
      if (table === 'webhook_deliveries') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(async () => ({
                  data: mockState.deliveries,
                  error: mockState.deliveriesError,
                  count: mockState.deliveriesCount,
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
    c.set('plan', 'pro')
    return next()
  }),
}))

// Mock rate limit middleware
vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: Context, next: () => Promise<void>) => next()),
}))

// Mock webhook signature
vi.mock('../lib/webhook-signature', () => ({
  generateWebhookSecret: vi.fn(() => 'whsec_' + '0'.repeat(64)),
}))

// Mock webhook crypto
vi.mock('../lib/webhook-crypto', () => ({
  encryptNewWebhookSecret: vi.fn(async (secret: string) => ({
    encrypted: 'mock-encrypted',
    iv: 'mock-iv',
    prefix: secret.slice(0, 14),
  })),
  decryptWebhookSecret: vi.fn(async () => 'whsec_' + '0'.repeat(64)),
}))

// Mock webhook delivery service
vi.mock('../services/webhook-delivery', () => ({
  DELIVERY_EVENT_TYPES: [
    'agent.response',
    'agent.blocked',
    'agent.error',
    'execution.started',
    'execution.completed',
  ],
  deliverImmediately: vi.fn(async () => ({
    success: true,
    status: 200,
    responseTimeMs: 150,
    deliveryId: 'test-delivery-id',
  })),
}))

// Import after mocks
import { webhookEndpointRoutes } from './webhook-endpoints'

// Create test app
function createTestApp() {
  const app = new Hono<{
    Bindings: { SUPABASE_URL: string; SUPABASE_SERVICE_KEY: string; JWT_SECRET: string }
  }>()
  app.use('*', async (c, next) => {
    c.env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key',
      JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
    }
    return next()
  })
  app.route('/', webhookEndpointRoutes)
  return app
}

// Reset mock state
function resetMocks() {
  mockState.agent = null
  mockState.agentError = null
  mockState.endpoint = null
  mockState.endpointError = null
  mockState.endpoints = []
  mockState.endpointsCount = 0
  mockState.insertResult = null
  mockState.insertError = null
  mockState.updateResult = null
  mockState.updateError = null
  mockState.deleteError = null
  mockState.deliveries = []
  mockState.deliveriesCount = 0
  mockState.deliveriesError = null
  vi.clearAllMocks()
}

describe('Webhook Endpoint Routes', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  describe('POST /agents/:agentId/endpoints', () => {
    it('creates endpoint successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpointsCount = 0
      mockState.insertResult = {
        id: 'endpoint-1',
        name: 'Test Endpoint',
        url: 'https://example.com/webhook',
        secret_prefix: 'whsec_0000000',
        headers: {},
        is_active: true,
        retry_count: 3,
        timeout_ms: 30000,
        event_types: [],
        created_at: new Date().toISOString(),
      }

      const res = await app.request('/agents/agent-1/endpoints', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Endpoint',
          url: 'https://example.com/webhook',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.endpoint.name).toBe('Test Endpoint')
      expect(data.endpoint.secret).toBeDefined()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agent = null
      mockState.agentError = { message: 'Not found' }

      const res = await app.request('/agents/non-existent/endpoints', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid URL', async () => {
      mockState.agent = { id: 'agent-1' }

      const res = await app.request('/agents/agent-1/endpoints', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'not-a-valid-url',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid headers', async () => {
      mockState.agent = { id: 'agent-1' }

      const res = await app.request('/agents/agent-1/endpoints', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          headers: { Host: 'evil.com' },
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /agents/:agentId/endpoints', () => {
    it('lists endpoints successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpoints = [
        { id: 'endpoint-1', name: 'Endpoint 1', url: 'https://example.com/1' },
        { id: 'endpoint-2', name: 'Endpoint 2', url: 'https://example.com/2' },
      ]

      const res = await app.request('/agents/agent-1/endpoints', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.endpoints).toHaveLength(2)
      expect(data.count).toBe(2)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agent = null
      mockState.agentError = { message: 'Not found' }

      const res = await app.request('/agents/non-existent/endpoints', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })

    it('returns empty list when no endpoints exist', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpoints = []

      const res = await app.request('/agents/agent-1/endpoints', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.endpoints).toHaveLength(0)
      expect(data.count).toBe(0)
    })
  })

  describe('GET /agents/:agentId/endpoints/:id', () => {
    it('returns endpoint details', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpoint = {
        id: 'endpoint-1',
        name: 'Test Endpoint',
        url: 'https://example.com/webhook',
        is_active: true,
      }

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.endpoint.id).toBe('endpoint-1')
    })

    it('returns 404 for non-existent endpoint', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpoint = null
      mockState.endpointError = { message: 'Not found' }

      const res = await app.request('/agents/agent-1/endpoints/non-existent', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /agents/:agentId/endpoints/:id', () => {
    it('updates endpoint successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.updateResult = {
        id: 'endpoint-1',
        name: 'Updated Name',
        url: 'https://example.com/webhook',
        is_active: true,
      }

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.endpoint.name).toBe('Updated Name')
    })

    it('returns 400 for invalid retry count', async () => {
      mockState.agent = { id: 'agent-1' }

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ retry_count: 100 }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid timeout', async () => {
      mockState.agent = { id: 'agent-1' }

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timeout_ms: 500 }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /agents/:agentId/endpoints/:id', () => {
    it('deletes endpoint successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.deleteError = null

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Endpoint deleted')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agent = null
      mockState.agentError = { message: 'Not found' }

      const res = await app.request('/agents/non-existent/endpoints/endpoint-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /agents/:agentId/endpoints/:id/test', () => {
    it('tests endpoint delivery successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpoint = { id: 'endpoint-1' }

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1/test', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.delivery_id).toBe('test-delivery-id')
    })

    it('returns 404 for non-existent endpoint', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.endpoint = null
      mockState.endpointError = { message: 'Not found' }

      const res = await app.request('/agents/agent-1/endpoints/non-existent/test', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /agents/:agentId/endpoints/:id/regenerate', () => {
    it('regenerates secret successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.updateResult = {
        id: 'endpoint-1',
        name: 'Test Endpoint',
        secret_prefix: 'whsec_0000000',
      }

      const res = await app.request('/agents/agent-1/endpoints/endpoint-1/regenerate', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.endpoint.secret).toBeDefined()
      expect(data.message).toContain('regenerated')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agent = null
      mockState.agentError = { message: 'Not found' }

      const res = await app.request('/agents/non-existent/endpoints/endpoint-1/regenerate', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /agents/:agentId/deliveries', () => {
    it('lists deliveries successfully', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.deliveries = [
        {
          id: 'delivery-1',
          status: 'delivered',
          event_type: 'agent.response',
          webhook_endpoints: { name: 'Test', url: 'https://example.com' },
        },
      ]
      mockState.deliveriesCount = 1

      const res = await app.request('/agents/agent-1/deliveries', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.deliveries).toHaveLength(1)
      expect(data.total).toBe(1)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agent = null
      mockState.agentError = { message: 'Not found' }

      const res = await app.request('/agents/non-existent/deliveries', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(404)
    })

    it('supports pagination parameters', async () => {
      mockState.agent = { id: 'agent-1' }
      mockState.deliveries = []
      mockState.deliveriesCount = 0

      const res = await app.request('/agents/agent-1/deliveries?limit=10&offset=20', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.limit).toBe(10)
      expect(data.offset).toBe(20)
    })
  })
})
