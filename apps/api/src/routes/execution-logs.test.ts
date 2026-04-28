/**
 * Execution Logs Routes Tests
 *
 * Integration tests for execution log management endpoints.
 * Tests pagination, filtering, validation, and authorization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { executionLogsRoutes } from './execution-logs'
import { testWallets, createAgent, generateUUID } from '../test/fixtures'
import { generateTestToken } from '../test/helpers'

// ============================================
// MOCK STATE
// ============================================

const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  logsResult: { data: [] as unknown[], error: null as unknown },
  singleLogResult: { data: null as unknown, error: null as unknown },
  healthResult: { data: [] as unknown[], error: null as unknown },
  countResult: { data: 0 as number, error: null as unknown },
  deleteResult: { error: null as unknown, count: 0 as number | null },
}

// Reset mock state
function resetMockState() {
  mockState.agentResult = { data: null, error: null }
  mockState.logsResult = { data: [], error: null }
  mockState.singleLogResult = { data: null, error: null }
  mockState.healthResult = { data: [], error: null }
  mockState.countResult = { data: 0, error: null }
  mockState.deleteResult = { error: null, count: 0 }
}

// Build chainable query mock
function createQueryChain(getResult: () => { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'single', 'order', 'gte', 'lt', 'limit']
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
    if (table === 'execution_logs') {
      return {
        select: vi.fn(() => {
          const chain = createQueryChain(() => mockState.singleLogResult)
          chain.order = vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockState.logsResult)),
            then: (resolve: (v: unknown) => void) => resolve(mockState.logsResult),
          }))
          return chain
        }),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => Promise.resolve(mockState.deleteResult)),
            then: (resolve: (v: unknown) => void) => resolve(mockState.deleteResult),
          })),
        })),
      }
    }
    return {}
  }),
  rpc: vi.fn((funcName: string) => {
    if (funcName === 'get_execution_logs') {
      return Promise.resolve(mockState.logsResult)
    }
    if (funcName === 'get_execution_logs_count') {
      return Promise.resolve(mockState.countResult)
    }
    if (funcName === 'get_agent_health_stats') {
      return Promise.resolve(mockState.healthResult)
    }
    return Promise.resolve({ data: null, error: null })
  }),
}

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// ============================================
// TEST APP SETUP
// ============================================

// Create test app with mock environment
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    SUPABASE_ANON_KEY: string
    SUPABASE_JWT_SECRET: string
    JWT_SECRET: string
    RATE_LIMIT_KV?: KVNamespace
    IP_HASH_SECRET?: string
  }
}>()

// Inject mock env
app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars-padding!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/agents', executionLogsRoutes)

// ============================================
// TEST FIXTURES
// ============================================

function createMockAgent() {
  return createAgent({
    id: generateUUID(),
    wallet_address: testWallets.alice,
    status: 'deployed',
  })
}

function createMockLog(overrides: Record<string, unknown> = {}) {
  return {
    id: generateUUID(),
    event_source: 'invoke',
    status: 'success',
    input_preview: 'Test input',
    output_preview: 'Test output',
    latency_ms: 150,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockHealthStats() {
  return {
    total_executions: 100,
    successful_executions: 85,
    blocked_executions: 10,
    error_executions: 5,
    success_rate: 85.0,
    avg_latency_ms: 150,
    last_execution_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_error_at: new Date(Date.now() - 86400000).toISOString(),
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('Execution Logs Routes', () => {
  let token: string

  beforeEach(async () => {
    resetMockState()
    vi.clearAllMocks()
    token = await generateTestToken(testWallets.alice)
  })

  // ==========================================
  // GET /agents/:agentId/executions
  // ==========================================

  describe('GET /agents/:agentId/executions', () => {
    it('returns 401 without authentication', async () => {
      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions`)

      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid agent ID format', async () => {
      const res = await app.request('/agents/invalid-uuid/executions', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid agent ID format')
    })

    it('returns 404 if agent not found', async () => {
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }

      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns paginated logs', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog(), createMockLog(), createMockLog()]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }
      mockState.countResult = { data: 50, error: null }

      const res = await app.request(`/agents/${agent.id}/executions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.logs).toHaveLength(3)
      expect(body.total).toBe(50)
      expect(body.limit).toBe(50) // default
      expect(body.offset).toBe(0)
    })

    it('applies pagination parameters', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }
      mockState.countResult = { data: 100, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?limit=10&offset=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.limit).toBe(10)
      expect(body.offset).toBe(20)
    })

    it('validates limit bounds (max 100)', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid query parameters')
    })

    it('validates offset bounds (max 10000)', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?offset=20000`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid query parameters')
    })

    it('filters by status', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog({ status: 'blocked' })]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?status=blocked`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.logs[0].status).toBe('blocked')
    })

    it('filters by event_source', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog({ event_source: 'webhook' })]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?event_source=webhook`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('rejects invalid status value', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?status=invalid`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /agents/:agentId/executions/:logId
  // ==========================================

  describe('GET /agents/:agentId/executions/:logId', () => {
    it('returns 400 for invalid log ID format', async () => {
      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions/invalid-log-id`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid log ID format')
    })

    it('returns single log entry', async () => {
      const agent = createMockAgent()
      const log = createMockLog()

      mockState.agentResult = { data: agent, error: null }
      mockState.singleLogResult = { data: log, error: null }

      const res = await app.request(`/agents/${agent.id}/executions/${log.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(log.id)
    })

    it('returns 404 if log not found', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.singleLogResult = { data: null, error: { code: 'PGRST116' } }

      const logId = generateUUID()
      const res = await app.request(`/agents/${agent.id}/executions/${logId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  // ==========================================
  // GET /agents/:agentId/health
  // ==========================================

  describe('GET /agents/:agentId/health', () => {
    it('returns health statistics', async () => {
      const agent = createMockAgent()
      const healthStats = createMockHealthStats()

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.stats).toBeDefined()
      expect(body.stats.total_executions).toBe(100)
    })

    it('determines "healthy" status for high success rate', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), success_rate: 98 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('healthy')
    })

    it('determines "degraded" status for moderate success rate', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), success_rate: 88 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('degraded')
    })

    it('determines "unhealthy" status for low success rate', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), success_rate: 60 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('unhealthy')
    })

    it('determines "unknown" status for no executions', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), total_executions: 0 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('unknown')
    })
  })

  // ==========================================
  // DELETE /agents/:agentId/executions
  // ==========================================

  describe('DELETE /agents/:agentId/executions', () => {
    it('deletes execution logs', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.deleteResult = { error: null, count: 10 }

      const res = await app.request(`/agents/${agent.id}/executions`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deleted).toBe(10)
    })

    it('validates before date parameter', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?before=invalid-date`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('accepts valid ISO date for before parameter', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.deleteResult = { error: null, count: 5 }

      const beforeDate = new Date().toISOString()
      const res = await app.request(
        `/agents/${agent.id}/executions?before=${encodeURIComponent(beforeDate)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      expect(res.status).toBe(200)
    })
  })

  // ==========================================
  // GET /agents/:agentId/executions/export
  // ==========================================

  describe('GET /agents/:agentId/executions/export', () => {
    it('exports logs as JSON', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog(), createMockLog()]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.agent_id).toBe(agent.id)
      expect(body.logs).toHaveLength(2)
      expect(body.exported_at).toBeDefined()
    })

    it('validates days parameter bounds', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export?days=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('accepts valid days parameter', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('sets Content-Disposition header for download', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Disposition')).toContain('attachment')
    })
  })

  // ==========================================
  // Authorization Tests
  // ==========================================

  describe('Authorization', () => {
    it('prevents access to another user agent', async () => {
      // Agent owned by different wallet
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }

      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })
})
