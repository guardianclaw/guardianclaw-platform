/**
 * Alert Routes Tests
 *
 * Tests for validation schemas and helper logic in the alert routes.
 * Full integration tests would require a test environment setup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import { alertsRoutes } from './alerts'
import { testWallets } from '../test/fixtures/index'

// =========================================
// MOCK SETUP
// =========================================

const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  listResult: { data: [] as unknown[], error: null as unknown },
  selectResult: { data: null as unknown, error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  deleteResult: { data: null as unknown, error: null as unknown },
  countResult: { count: 0 as number | null, error: null as unknown },
}

function createQueryChain(
  terminalValue: () => { data?: unknown; error?: unknown; count?: number | null }
) {
  const chain: Record<string, unknown> = {}

  const chainMethods = ['select', 'eq', 'neq', 'order', 'range', 'limit']
  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain)
  }

  chain.single = vi.fn(() => Promise.resolve(terminalValue()))
  chain.maybeSingle = vi.fn(() => Promise.resolve(terminalValue()))
  chain.then = (resolve: (v: unknown) => void) => resolve(terminalValue())

  return chain
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.agentResult)),
      }
    }
    if (table === 'agent_alert_rules') {
      return {
        select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            const countChain: Record<string, unknown> = {}
            countChain.eq = vi.fn(() => countChain)
            countChain.then = (resolve: (v: unknown) => void) => resolve(mockState.countResult)
            return countChain
          }
          const selectChain = createQueryChain(() => mockState.selectResult)
          selectChain.single = vi.fn(() => Promise.resolve(mockState.selectResult))
          selectChain.then = (resolve: (v: unknown) => void) => {
            resolve(mockState.listResult)
          }
          return selectChain
        }),
        insert: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.select = vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          }))
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.select = vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.updateResult)),
          }))
          return chain
        }),
        delete: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.then = (resolve: (v: unknown) => void) => resolve(mockState.deleteResult)
          return chain
        }),
      }
    }
    if (table === 'agent_alert_history') {
      return {
        select: vi.fn(() => {
          const chain = createQueryChain(() => ({
            ...mockState.listResult,
            count: mockState.countResult.count,
          }))
          chain.then = (resolve: (v: unknown) => void) =>
            resolve({ ...mockState.listResult, count: mockState.countResult.count })
          return chain
        }),
      }
    }
    return {
      select: vi.fn(() => createQueryChain(() => mockState.selectResult)),
    }
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as {
      req: { header: (name: string) => string | undefined }
      set: (key: string, value: string) => void
      json: (data: unknown, status: number) => Response
    }
    const authHeader = ctx.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.json({ error: 'Unauthorized' }, 401)
    }
    ctx.set('wallet', testWallets.alice)
    ctx.set('plan', 'pro')
    await next()
  }),
}))

vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  }),
}))

function resetMockState() {
  mockState.agentResult = { data: null, error: null }
  mockState.listResult = { data: [], error: null }
  mockState.selectResult = { data: null, error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
  mockState.deleteResult = { data: null, error: null }
  mockState.countResult = { count: 0, error: null }
}

// Create test app
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    JWT_SECRET: string
  }
}>()

app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/agents', alertsRoutes)

// Test fixtures
const mockAgent = { id: '00000000-0000-0000-0000-000000000001', name: 'Test Agent' }

const mockAlertRule = {
  id: '00000000-0000-0000-0000-000000000002',
  agent_id: '00000000-0000-0000-0000-000000000001',
  wallet_address: testWallets.alice,
  name: 'High Error Rate',
  description: 'Alert when error rate exceeds 5%',
  rule_type: 'error_rate',
  threshold: 5,
  window_minutes: 60,
  comparison: 'gt',
  notification_channel: 'webhook',
  notification_target: 'https://example.com/webhook',
  cooldown_minutes: 30,
  consecutive_threshold: 1,
  severity: 'warning',
  is_active: true,
  last_triggered_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// =========================================
// HTTP ROUTE TESTS
// =========================================

describe('Alert Routes HTTP Tests', () => {
  const token = 'test-token'
  const validAgentId = '00000000-0000-0000-0000-000000000001'
  const validAlertId = '00000000-0000-0000-0000-000000000002'

  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  describe('GET /agents/:agentId/alerts', () => {
    it('returns list of alert rules', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.listResult = { data: [mockAlertRule], error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.rules).toHaveLength(1)
    })

    it('returns 400 for invalid agent ID format', async () => {
      const res = await app.request('/agents/invalid-uuid/alerts', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request(`/agents/${validAgentId}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/agents/${validAgentId}/alerts`)
      expect(res.status).toBe(401)
    })
  })

  describe('POST /agents/:agentId/alerts', () => {
    it('creates a new alert rule', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.countResult = { count: 0, error: null }
      mockState.insertResult = { data: mockAlertRule, error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Alert',
          rule_type: 'error_rate',
          threshold: 5,
          notification_channel: 'webhook',
          notification_target: 'https://example.com/webhook',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.rule).toBeDefined()
    })

    it('returns 400 for invalid body', async () => {
      const res = await app.request(`/agents/${validAgentId}/alerts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: '' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 when limit reached', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.countResult = { count: 10, error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Alert',
          rule_type: 'error_rate',
          threshold: 5,
          notification_channel: 'webhook',
          notification_target: 'https://example.com',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('limit')
    })
  })

  describe('GET /agents/:agentId/alerts/:alertId', () => {
    it('returns a single alert rule', async () => {
      mockState.selectResult = { data: mockAlertRule, error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.rule.id).toBe(validAlertId)
    })

    it('returns 400 for invalid ID format', async () => {
      const res = await app.request(`/agents/${validAgentId}/alerts/invalid-uuid`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent alert', async () => {
      mockState.selectResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /agents/:agentId/alerts/:alertId', () => {
    it('updates an alert rule', async () => {
      mockState.updateResult = { data: { ...mockAlertRule, name: 'Updated Alert' }, error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Alert' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.rule.name).toBe('Updated Alert')
    })

    it('returns 400 for empty update', async () => {
      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent alert', async () => {
      mockState.updateResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Alert' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /agents/:agentId/alerts/:alertId', () => {
    it('deletes an alert rule', async () => {
      mockState.deleteResult = { data: null, error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('returns 400 for invalid ID format', async () => {
      const res = await app.request(`/agents/${validAgentId}/alerts/invalid-uuid`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /agents/:agentId/alerts/:alertId/history', () => {
    it('returns alert history', async () => {
      mockState.selectResult = { data: { id: validAlertId }, error: null }
      mockState.listResult = { data: [], error: null }
      mockState.countResult = { count: 0, error: null }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.history).toBeDefined()
      expect(data.total).toBeDefined()
    })

    it('returns 404 for non-existent alert', async () => {
      mockState.selectResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /agents/:agentId/alerts/:alertId/test', () => {
    it('returns 404 for non-existent alert', async () => {
      mockState.selectResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request(`/agents/${validAgentId}/alerts/${validAlertId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })
})

// =========================================
// SCHEMA TESTS (existing)
// =========================================

// Copy the validation schemas from the routes for testing
const uuidSchema = z.string().uuid('Invalid UUID format')

const ruleTypeSchema = z.enum([
  'error_rate',
  'latency_p95',
  'latency_p99',
  'block_rate',
  'success_rate',
  'request_volume',
])

const comparisonSchema = z.enum(['gt', 'gte', 'lt', 'lte', 'eq'])

const severitySchema = z.enum(['info', 'warning', 'critical'])

const notificationChannelSchema = z.enum(['webhook', 'slack'])

const createAlertSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rule_type: ruleTypeSchema,
  threshold: z.number().min(0),
  window_minutes: z.number().int().min(1).max(1440).default(60),
  comparison: comparisonSchema.default('gt'),
  notification_channel: notificationChannelSchema,
  notification_target: z.string().min(1).max(500),
  cooldown_minutes: z.number().int().min(0).max(1440).default(60),
  consecutive_threshold: z.number().int().min(1).default(1),
  severity: severitySchema.default('warning'),
})

const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  threshold: z.number().min(0).optional(),
  window_minutes: z.number().int().min(1).max(1440).optional(),
  comparison: comparisonSchema.optional(),
  notification_channel: notificationChannelSchema.optional(),
  notification_target: z.string().min(1).max(500).optional(),
  cooldown_minutes: z.number().int().min(0).max(1440).optional(),
  consecutive_threshold: z.number().int().min(1).optional(),
  severity: severitySchema.optional(),
  is_active: z.boolean().optional(),
})

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).max(10000).default(0),
})

describe('Alert Routes Validation Schemas', () => {
  describe('UUID Schema', () => {
    it('accepts valid UUIDs', () => {
      const validUUIDs = [
        '00000000-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '550e8400-e29b-41d4-a716-446655440000',
      ]

      for (const uuid of validUUIDs) {
        expect(uuidSchema.safeParse(uuid).success).toBe(true)
      }
    })

    it('rejects invalid UUIDs', () => {
      const invalidUUIDs = [
        'invalid',
        '12345',
        'not-a-uuid',
        '00000000-0000-0000-0000', // Too short
        '00000000-0000-0000-0000-0000000000001', // Too long
      ]

      for (const uuid of invalidUUIDs) {
        const result = uuidSchema.safeParse(uuid)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('Rule Type Schema', () => {
    it('accepts valid rule types', () => {
      const validTypes = [
        'error_rate',
        'latency_p95',
        'latency_p99',
        'block_rate',
        'success_rate',
        'request_volume',
      ]

      for (const type of validTypes) {
        expect(ruleTypeSchema.safeParse(type).success).toBe(true)
      }
    })

    it('rejects invalid rule types', () => {
      const invalidTypes = ['invalid', 'ERROR_RATE', 'latency', 'cpu_usage']

      for (const type of invalidTypes) {
        expect(ruleTypeSchema.safeParse(type).success).toBe(false)
      }
    })
  })

  describe('Comparison Schema', () => {
    it('accepts valid comparisons', () => {
      const valid = ['gt', 'gte', 'lt', 'lte', 'eq']

      for (const comp of valid) {
        expect(comparisonSchema.safeParse(comp).success).toBe(true)
      }
    })

    it('rejects invalid comparisons', () => {
      const invalid = ['>', '>=', '<', '<=', '==', 'ne', 'between']

      for (const comp of invalid) {
        expect(comparisonSchema.safeParse(comp).success).toBe(false)
      }
    })
  })

  describe('Create Alert Schema', () => {
    it('accepts valid complete input', () => {
      const input = {
        name: 'High Error Rate Alert',
        description: 'Triggers when error rate exceeds 5%',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 30,
        consecutive_threshold: 3,
        severity: 'critical',
      }

      const result = createAlertSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('High Error Rate Alert')
        expect(result.data.threshold).toBe(5)
      }
    })

    it('accepts minimal valid input with defaults', () => {
      const input = {
        name: 'Test Alert',
        rule_type: 'error_rate',
        threshold: 10,
        notification_channel: 'webhook',
        notification_target: 'https://example.com',
      }

      const result = createAlertSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.window_minutes).toBe(60) // Default
        expect(result.data.comparison).toBe('gt') // Default
        expect(result.data.cooldown_minutes).toBe(60) // Default
        expect(result.data.consecutive_threshold).toBe(1) // Default
        expect(result.data.severity).toBe('warning') // Default
      }
    })

    it('rejects missing required fields', () => {
      const inputs = [
        {}, // All missing
        { name: 'Test' }, // Missing rule_type, threshold, notification
        { name: 'Test', rule_type: 'error_rate' }, // Missing threshold, notification
        { name: 'Test', rule_type: 'error_rate', threshold: 5 }, // Missing notification
      ]

      for (const input of inputs) {
        expect(createAlertSchema.safeParse(input).success).toBe(false)
      }
    })

    it('rejects invalid name length', () => {
      expect(
        createAlertSchema.safeParse({
          name: '', // Too short
          rule_type: 'error_rate',
          threshold: 5,
          notification_channel: 'webhook',
          notification_target: 'https://example.com',
        }).success
      ).toBe(false)

      expect(
        createAlertSchema.safeParse({
          name: 'a'.repeat(101), // Too long
          rule_type: 'error_rate',
          threshold: 5,
          notification_channel: 'webhook',
          notification_target: 'https://example.com',
        }).success
      ).toBe(false)
    })

    it('rejects negative threshold', () => {
      expect(
        createAlertSchema.safeParse({
          name: 'Test',
          rule_type: 'error_rate',
          threshold: -5,
          notification_channel: 'webhook',
          notification_target: 'https://example.com',
        }).success
      ).toBe(false)
    })

    it('rejects invalid window_minutes', () => {
      const invalidWindows = [0, -1, 1441, 10000]

      for (const window of invalidWindows) {
        expect(
          createAlertSchema.safeParse({
            name: 'Test',
            rule_type: 'error_rate',
            threshold: 5,
            window_minutes: window,
            notification_channel: 'webhook',
            notification_target: 'https://example.com',
          }).success
        ).toBe(false)
      }
    })

    it('accepts all notification channels', () => {
      const channels = ['webhook', 'slack']

      for (const channel of channels) {
        const result = createAlertSchema.safeParse({
          name: 'Test',
          rule_type: 'error_rate',
          threshold: 5,
          notification_channel: channel,
          notification_target: 'https://example.com',
        })
        expect(result.success).toBe(true)
      }
    })

    it('rejects email as notification channel', () => {
      const result = createAlertSchema.safeParse({
        name: 'Test',
        rule_type: 'error_rate',
        threshold: 5,
        notification_channel: 'email',
        notification_target: 'user@example.com',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Update Alert Schema', () => {
    it('accepts partial updates', () => {
      const updates = [
        { name: 'Updated Name' },
        { threshold: 10 },
        { is_active: false },
        { severity: 'critical' },
        { name: 'New Name', threshold: 20 },
      ]

      for (const update of updates) {
        expect(updateAlertSchema.safeParse(update).success).toBe(true)
      }
    })

    it('accepts empty object (no updates)', () => {
      // The schema accepts empty, but the route handler checks for this
      expect(updateAlertSchema.safeParse({}).success).toBe(true)
    })

    it('accepts nullable description', () => {
      expect(updateAlertSchema.safeParse({ description: null }).success).toBe(true)
      expect(updateAlertSchema.safeParse({ description: 'New description' }).success).toBe(true)
    })

    it('rejects invalid update values', () => {
      const invalidUpdates = [
        { name: '' }, // Too short
        { threshold: -1 }, // Negative
        { window_minutes: 0 }, // Too small
        { severity: 'invalid' }, // Invalid enum
        { is_active: 'yes' }, // Wrong type
      ]

      for (const update of invalidUpdates) {
        expect(updateAlertSchema.safeParse(update).success).toBe(false)
      }
    })
  })

  describe('History Query Schema', () => {
    it('accepts valid query params', () => {
      const queries = [
        { limit: '10', offset: '0' },
        { limit: '100', offset: '500' },
        { limit: 50, offset: 100 },
      ]

      for (const query of queries) {
        expect(historyQuerySchema.safeParse(query).success).toBe(true)
      }
    })

    it('applies defaults for missing params', () => {
      const result = historyQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
        expect(result.data.offset).toBe(0)
      }
    })

    it('coerces string values to numbers', () => {
      const result = historyQuerySchema.safeParse({ limit: '50', offset: '10' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(10)
      }
    })

    it('rejects invalid limit values', () => {
      const invalidLimits = [0, -1, 101, 1000]

      for (const limit of invalidLimits) {
        expect(historyQuerySchema.safeParse({ limit }).success).toBe(false)
      }
    })

    it('rejects invalid offset values', () => {
      const invalidOffsets = [-1, 10001, 50000]

      for (const offset of invalidOffsets) {
        expect(historyQuerySchema.safeParse({ offset }).success).toBe(false)
      }
    })
  })
})

describe('Alert Rule Logic', () => {
  describe('Comparison Evaluation', () => {
    const evaluate = (value: number, threshold: number, comparison: string): boolean => {
      switch (comparison) {
        case 'gt':
          return value > threshold
        case 'gte':
          return value >= threshold
        case 'lt':
          return value < threshold
        case 'lte':
          return value <= threshold
        case 'eq':
          return value === threshold
        default:
          return false
      }
    }

    it('evaluates gt (greater than) correctly', () => {
      expect(evaluate(10, 5, 'gt')).toBe(true)
      expect(evaluate(5, 5, 'gt')).toBe(false)
      expect(evaluate(4, 5, 'gt')).toBe(false)
    })

    it('evaluates gte (greater than or equal) correctly', () => {
      expect(evaluate(10, 5, 'gte')).toBe(true)
      expect(evaluate(5, 5, 'gte')).toBe(true)
      expect(evaluate(4, 5, 'gte')).toBe(false)
    })

    it('evaluates lt (less than) correctly', () => {
      expect(evaluate(3, 5, 'lt')).toBe(true)
      expect(evaluate(5, 5, 'lt')).toBe(false)
      expect(evaluate(6, 5, 'lt')).toBe(false)
    })

    it('evaluates lte (less than or equal) correctly', () => {
      expect(evaluate(3, 5, 'lte')).toBe(true)
      expect(evaluate(5, 5, 'lte')).toBe(true)
      expect(evaluate(6, 5, 'lte')).toBe(false)
    })

    it('evaluates eq (equal) correctly', () => {
      expect(evaluate(5, 5, 'eq')).toBe(true)
      expect(evaluate(4, 5, 'eq')).toBe(false)
      expect(evaluate(6, 5, 'eq')).toBe(false)
    })
  })

  describe('Cooldown Logic', () => {
    const isInCooldown = (lastTriggeredAt: string | null, cooldownMinutes: number): boolean => {
      if (!lastTriggeredAt || cooldownMinutes === 0) {
        return false
      }

      const lastTriggered = new Date(lastTriggeredAt).getTime()
      const cooldownMs = cooldownMinutes * 60 * 1000
      const now = Date.now()

      return now - lastTriggered < cooldownMs
    }

    it('returns false when never triggered', () => {
      expect(isInCooldown(null, 60)).toBe(false)
    })

    it('returns false when cooldown is 0', () => {
      expect(isInCooldown(new Date().toISOString(), 0)).toBe(false)
    })

    it('returns true during cooldown period', () => {
      const justTriggered = new Date().toISOString()
      expect(isInCooldown(justTriggered, 60)).toBe(true)
    })

    it('returns false after cooldown period', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      expect(isInCooldown(twoHoursAgo, 60)).toBe(false) // 60 min cooldown, 2 hours passed
    })
  })
})
