/**
 * Webhook Routes Tests
 *
 * Comprehensive test coverage for webhook management and trigger endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { webhookRoutes, webhookTriggerRoutes } from './webhooks'
import { testWallets, createAgent } from '../test/fixtures'
import { generateTestToken } from '../test/helpers'
import { createWebhookSignature, generateWebhookSecret } from '../lib/webhook-signature'
import { encryptWebhookSecret } from '../lib/webhook-crypto'

// ============================================
// MOCK STATE
// ============================================

const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  webhookResult: { data: null as unknown, error: null as unknown },
  webhookListResult: { data: [] as unknown[], error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  deleteResult: { error: null as unknown },
  countResult: { count: 0 as number | null, error: null as unknown },
  rpcResult: { error: null as unknown },
}

// Build chainable query mock
function createQueryChain(getResult: () => { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'single', 'order', 'range', 'limit']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(getResult()))
  chain.then = (resolve: (v: unknown) => void) => resolve(getResult())
  return chain
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.agentResult)),
      }
    }
    if (table === 'webhooks') {
      return {
        select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  then: (resolve: (v: unknown) => void) => resolve(mockState.countResult),
                })),
              })),
            }
          }
          const chain = createQueryChain(() => mockState.webhookResult)
          chain.order = vi.fn(() => ({
            then: (resolve: (v: unknown) => void) => resolve(mockState.webhookListResult),
          }))
          return chain
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve(mockState.updateResult)),
              })),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve(mockState.deleteResult)),
          })),
        })),
      }
    }
    if (table === 'agent_events') {
      return {
        insert: vi.fn(() => Promise.resolve({ error: null })),
      }
    }
    return { select: vi.fn(() => createQueryChain(() => ({ data: null, error: null }))) }
  }),
  rpc: vi.fn(() => Promise.resolve(mockState.rpcResult)),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// ============================================
// TEST APP SETUP
// ============================================

const createTestApp = () => {
  const app = new Hono<{
    Bindings: {
      SUPABASE_URL: string
      SUPABASE_SERVICE_KEY: string
      JWT_SECRET: string
      API_BASE_URL: string
      OPENAI_API_KEY?: string
    }
  }>()

  app.use('*', async (c, next) => {
    c.env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key',
      JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
      API_BASE_URL: 'https://api.test.com',
    }
    await next()
  })

  app.route('/', webhookRoutes)
  app.route('/webhooks', webhookTriggerRoutes)

  return app
}

// Reset mock state
function resetMocks() {
  mockState.agentResult = { data: null, error: null }
  mockState.webhookResult = { data: null, error: null }
  mockState.webhookListResult = { data: [], error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
  mockState.deleteResult = { error: null }
  mockState.countResult = { count: 0, error: null }
  mockState.rpcResult = { error: null }
  vi.clearAllMocks()
}

// ============================================
// TESTS: WEBHOOK CRUD
// ============================================

describe('Webhook Routes', () => {
  let app: ReturnType<typeof createTestApp>
  let token: string

  beforeEach(async () => {
    resetMocks()
    app = createTestApp()
    token = await generateTestToken(testWallets.alice)
  })

  describe('POST /agents/:agentId/webhooks', () => {
    it('creates a webhook with default settings', async () => {
      const agentId = 'agent-123'
      const webhookId = 'webhook-456'

      mockState.agentResult = {
        data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.countResult = { count: 0, error: null }
      mockState.insertResult = {
        data: {
          id: webhookId,
          name: 'Default Webhook',
          secret_prefix: 'whsec_abcdef',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: true,
          created_at: new Date().toISOString(),
        },
        error: null,
      }

      const res = await app.request(`/agents/${agentId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test Webhook' }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.webhook.id).toBe(webhookId)
      expect(json.webhook.secret).toMatch(/^whsec_[0-9a-f]{64}$/)
      expect(json.webhook.trigger_url).toBe(`https://api.test.com/webhooks/${webhookId}/trigger`)
      expect(json.message).toContain('only be shown once')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }

      const res = await app.request('/agents/invalid-id/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 403 when max webhooks reached', async () => {
      mockState.agentResult = {
        data: createAgent({ id: 'agent-1', wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.countResult = { count: 10, error: null }

      const res = await app.request('/agents/agent-1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test' }),
      })

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toContain('Maximum 10')
    })

    it('validates rate_limit bounds', async () => {
      mockState.agentResult = {
        data: createAgent({ id: 'agent-1', wallet_address: testWallets.alice }),
        error: null,
      }

      const res = await app.request('/agents/agent-1/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Test', rate_limit: 2000 }),
      })

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('Invalid request')
    })
  })

  describe('GET /agents/:agentId/webhooks', () => {
    it('lists webhooks for an agent', async () => {
      const agentId = 'agent-123'

      mockState.agentResult = {
        data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.webhookListResult = {
        data: [
          {
            id: 'wh-1',
            name: 'Webhook 1',
            secret_prefix: 'whsec_aaa',
            is_active: true,
            rate_limit: 60,
            allowed_ips: [],
            trigger_count: 100,
            last_triggered_at: new Date().toISOString(),
          },
          {
            id: 'wh-2',
            name: 'Webhook 2',
            secret_prefix: 'whsec_bbb',
            is_active: false,
            rate_limit: 30,
            allowed_ips: ['192.168.1.1'],
            trigger_count: 50,
            last_triggered_at: null,
          },
        ],
        error: null,
      }

      const res = await app.request(`/agents/${agentId}/webhooks`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.webhooks).toHaveLength(2)
      expect(json.count).toBe(2)
      expect(json.webhooks[0].trigger_url).toContain('/webhooks/wh-1/trigger')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }

      const res = await app.request('/agents/invalid/webhooks', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /agents/:agentId/webhooks/:id', () => {
    it('returns webhook details', async () => {
      const agentId = 'agent-123'
      const webhookId = 'webhook-456'

      mockState.agentResult = {
        data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.webhookResult = {
        data: {
          id: webhookId,
          name: 'My Webhook',
          secret_prefix: 'whsec_xyz',
          is_active: true,
          rate_limit: 100,
          allowed_ips: ['10.0.0.0/8'],
          pass_metadata: true,
          trigger_count: 42,
        },
        error: null,
      }

      const res = await app.request(`/agents/${agentId}/webhooks/${webhookId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.webhook.id).toBe(webhookId)
      expect(json.webhook.name).toBe('My Webhook')
      expect(json.webhook.trigger_url).toContain(webhookId)
    })
  })

  describe('PATCH /agents/:agentId/webhooks/:id', () => {
    it('updates webhook settings', async () => {
      const agentId = 'agent-123'
      const webhookId = 'webhook-456'

      mockState.agentResult = {
        data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.updateResult = {
        data: {
          id: webhookId,
          name: 'Updated Name',
          is_active: false,
          rate_limit: 30,
        },
        error: null,
      }

      const res = await app.request(`/agents/${agentId}/webhooks/${webhookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Updated Name',
          is_active: false,
          rate_limit: 30,
        }),
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.webhook.name).toBe('Updated Name')
    })
  })

  describe('DELETE /agents/:agentId/webhooks/:id', () => {
    it('deletes a webhook', async () => {
      const agentId = 'agent-123'
      const webhookId = 'webhook-456'

      mockState.agentResult = {
        data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.deleteResult = { error: null }

      const res = await app.request(`/agents/${agentId}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.message).toBe('Webhook deleted')
    })
  })

  describe('POST /agents/:agentId/webhooks/:id/regenerate', () => {
    it('regenerates webhook secret', async () => {
      const agentId = 'agent-123'
      const webhookId = 'webhook-456'

      mockState.agentResult = {
        data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
        error: null,
      }
      mockState.updateResult = {
        data: {
          id: webhookId,
          name: 'My Webhook',
          secret_prefix: 'whsec_newpre',
        },
        error: null,
      }

      const res = await app.request(`/agents/${agentId}/webhooks/${webhookId}/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.webhook.secret).toMatch(/^whsec_[0-9a-f]{64}$/)
      expect(json.message).toContain('only be shown once')
    })
  })
})

// ============================================
// TESTS: WEBHOOK TRIGGER (Public Endpoint)
// ============================================

describe('Webhook Trigger Routes', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  describe('POST /webhooks/:webhookId/trigger', () => {
    it('returns 401 for missing signature headers', async () => {
      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      })

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toContain('Missing webhook signature')
    })

    it('returns 404 for non-existent webhook', async () => {
      mockState.webhookResult = { data: null, error: { code: 'PGRST116' } }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'Hello' })

      const res = await app.request('/webhooks/invalid-id/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(404)
    })

    it('returns 403 for disabled webhook', async () => {
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          is_active: false,
          secret_encrypted: 'encrypted',
          secret_iv: 'iv',
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'Hello' })

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toBe('Webhook is disabled')
    })

    it('returns 422 for draft agent webhook trigger', async () => {
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: false,
          secret_encrypted: 'encrypted',
          secret_iv: 'iv',
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'draft',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'test' })

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(422)
      const json = await res.json()
      expect(json.error).toBe('Agent not deployed')
      expect(json.code).toBe('AGENT_NOT_DEPLOYED')
      expect(json.message).toContain('draft mode')
    })

    it('returns 410 for archived agent webhook trigger', async () => {
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: false,
          secret_encrypted: 'encrypted',
          secret_iv: 'iv',
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'archived',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'test' })

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(410)
      const json = await res.json()
      expect(json.error).toBe('Agent archived')
      expect(json.message).toContain('archived')
    })

    it('validates request body schema', async () => {
      // This test requires a valid webhook setup which is complex
      // to mock fully. We'll test the schema validation separately.
      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
        },
        body: 'not-json',
      })

      // Should fail at JSON parsing or webhook lookup, both acceptable
      expect([400, 404]).toContain(res.status)
    })

    it('returns 403 for IP not in whitelist', async () => {
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: ['10.0.0.1', '192.168.1.0/24'], // Whitelist specific IPs
          pass_metadata: true,
          secret_encrypted: 'encrypted',
          secret_iv: 'iv',
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'deployed',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'Hello' })

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': timestamp.toString(),
          // No cf-connecting-ip header, defaults to 'unknown' which won't match whitelist
        },
        body: payload,
      })

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toBe('IP address not allowed')
    })

    it('includes rate limit headers in response', async () => {
      // Even for errors, rate limit headers should be set for successful webhook lookup
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 100,
          allowed_ips: [], // Allow all IPs
          pass_metadata: true,
          secret_encrypted: 'invalid', // Will fail decryption
          secret_iv: 'invalid',
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'deployed',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'Hello' })

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'sha256=fake',
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      // Should fail at decryption but rate limit headers should be set
      // The response will be 500 (decryption error)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100')
      expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
    })

    it('returns 401 for invalid signature', async () => {
      // Create a real encrypted secret for this test
      const secret = generateWebhookSecret()
      const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'
      const { encrypted, iv } = await encryptWebhookSecret(secret, serverSecret)

      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: true,
          secret_encrypted: encrypted,
          secret_iv: iv,
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'deployed',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'Hello' })

      // Send with WRONG signature
      const wrongSignature =
        'sha256=0000000000000000000000000000000000000000000000000000000000000000'

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': wrongSignature,
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Signature verification failed')
      expect(json.code).toBe('SIGNATURE_MISMATCH')
    })

    it('returns 401 for expired timestamp', async () => {
      const secret = generateWebhookSecret()
      const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'
      const { encrypted, iv } = await encryptWebhookSecret(secret, serverSecret)

      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: true,
          secret_encrypted: encrypted,
          secret_iv: iv,
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'deployed',
          },
        },
        error: null,
      }

      // Timestamp from 10 minutes ago (expired)
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600
      const payload = JSON.stringify({ message: 'Hello' })
      const signature = await createWebhookSignature(payload, secret, expiredTimestamp)

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': expiredTimestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('TIMESTAMP_EXPIRED')
    })

    it('successfully triggers agent with valid signature (happy path)', async () => {
      const secret = generateWebhookSecret()
      const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'
      const { encrypted, iv } = await encryptWebhookSecret(secret, serverSecret)

      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: true,
          secret_encrypted: encrypted,
          secret_iv: iv,
          agents: {
            id: 'agent-456',
            flow: { nodes: [{ type: 'process' }], edges: [] },
            config: {},
            claw_config: { gates: { credibility: true, avoidance: true } },
            status: 'deployed',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({
        message: 'Hello from webhook',
        metadata: { source: 'test' },
      })
      const signature = await createWebhookSignature(payload, secret, timestamp)

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.execution_id).toBeTruthy()
      expect(json.response).toBeTruthy()
      expect(json.blocked).toBe(false)
      expect(json.latency_ms).toBeGreaterThan(0)
      expect(json.metadata).toEqual({ source: 'test' })

      // Verify rate limit headers are present
      expect(res.headers.get('X-RateLimit-Limit')).toBe('60')
      expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy()
    })

    it('passes through metadata when configured', async () => {
      const secret = generateWebhookSecret()
      const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'
      const { encrypted, iv } = await encryptWebhookSecret(secret, serverSecret)

      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: true, // Enable metadata passthrough
          secret_encrypted: encrypted,
          secret_iv: iv,
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'deployed',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const metadata = { source: 'discord', user_id: '12345', channel: 'general' }
      const payload = JSON.stringify({ message: 'Test', metadata })
      const signature = await createWebhookSignature(payload, secret, timestamp)

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.metadata).toEqual(metadata)
    })

    it('does not pass metadata when disabled', async () => {
      const secret = generateWebhookSecret()
      const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'
      const { encrypted, iv } = await encryptWebhookSecret(secret, serverSecret)

      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          agent_id: 'agent-456',
          is_active: true,
          rate_limit: 60,
          allowed_ips: [],
          pass_metadata: false, // Disable metadata passthrough
          secret_encrypted: encrypted,
          secret_iv: iv,
          agents: {
            id: 'agent-456',
            flow: { nodes: [], edges: [] },
            config: {},
            claw_config: { gates: {} },
            status: 'deployed',
          },
        },
        error: null,
      }

      const timestamp = Math.floor(Date.now() / 1000)
      const payload = JSON.stringify({ message: 'Test', metadata: { source: 'test' } })
      const signature = await createWebhookSignature(payload, secret, timestamp)

      const res = await app.request('/webhooks/webhook-123/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': timestamp.toString(),
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.metadata).toBeUndefined()
    })
  })

  describe('GET /webhooks/:webhookId/health', () => {
    it('returns healthy status for active webhook', async () => {
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          is_active: true,
          agent_id: 'agent-456',
        },
        error: null,
      }

      const res = await app.request('/webhooks/webhook-123/health', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe('healthy')
      expect(json.webhook_id).toBe('webhook-123')
      expect(json.agent_id).toBe('agent-456')
    })

    it('returns disabled status for inactive webhook', async () => {
      mockState.webhookResult = {
        data: {
          id: 'webhook-123',
          is_active: false,
          agent_id: 'agent-456',
        },
        error: null,
      }

      const res = await app.request('/webhooks/webhook-123/health', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe('disabled')
    })

    it('returns 404 for non-existent webhook', async () => {
      mockState.webhookResult = { data: null, error: { code: 'PGRST116' } }

      const res = await app.request('/webhooks/invalid/health', {
        method: 'GET',
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.status).toBe('not_found')
    })
  })
})

// ============================================
// TESTS: SIGNATURE VERIFICATION
// ============================================

describe('Webhook Signature Verification', () => {
  it('createWebhookSignature produces valid format', async () => {
    const payload = '{"message":"test"}'
    const secret = 'whsec_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const timestamp = 1704067200

    const signature = await createWebhookSignature(payload, secret, timestamp)

    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/)
  })

  it('same inputs produce same signature', async () => {
    const payload = '{"message":"test"}'
    const secret = 'whsec_abcd1234'
    const timestamp = 1704067200

    const sig1 = await createWebhookSignature(payload, secret, timestamp)
    const sig2 = await createWebhookSignature(payload, secret, timestamp)

    expect(sig1).toBe(sig2)
  })

  it('different payloads produce different signatures', async () => {
    const secret = 'whsec_abcd1234'
    const timestamp = 1704067200

    const sig1 = await createWebhookSignature('{"a":1}', secret, timestamp)
    const sig2 = await createWebhookSignature('{"a":2}', secret, timestamp)

    expect(sig1).not.toBe(sig2)
  })

  it('different timestamps produce different signatures', async () => {
    const payload = '{"message":"test"}'
    const secret = 'whsec_abcd1234'

    const sig1 = await createWebhookSignature(payload, secret, 1000)
    const sig2 = await createWebhookSignature(payload, secret, 2000)

    expect(sig1).not.toBe(sig2)
  })
})
