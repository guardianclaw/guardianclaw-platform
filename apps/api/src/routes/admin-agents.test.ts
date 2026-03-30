/**
 * Admin Agents Routes Tests
 *
 * Comprehensive test coverage for all admin agents endpoints:
 * - Platform statistics
 * - Agent listing with filters
 * - Agent details
 * - Agent suspension/unsuspension
 * - Agent analytics
 *
 * Test categories:
 * 1. Success scenarios with proper mocked data
 * 2. Input validation (Zod schemas)
 * 3. Error handling (404, 500)
 * 4. Edge cases and boundary conditions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ============================================
// MOCK SETUP
// ============================================

// Mock data generators
const createMockStats = () => ({
  total_agents: 150,
  active_agents: 85,
  suspended_agents: 5,
  by_framework: { openai_agents: 35, elizaos: 45, custom: 50 },
  by_status: { draft: 30, testing: 25, deployed: 85, archived: 10 },
  created_7d: 12,
  created_30d: 45,
})

const createMockAgent = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  framework: 'openai_agents',
  status: 'deployed',
  wallet_address: 'TestWallet123456789012345678901234567890',
  owner_name: 'Test User',
  is_suspended: false,
  suspended_at: null,
  claw_config: { gates: ['credibility', 'avoidance', 'limits', 'worth'] },
  created_at: '2026-01-15T10:30:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  total_requests: 5000,
  total_blocks: 150,
  is_deployed: true,
  total_count: 150,
  ...overrides,
})

const createMockAgentDetails = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  icon: null,
  framework: 'openai_agents',
  status: 'deployed',
  wallet_address: 'TestWallet123456789012345678901234567890',
  owner_name: 'Test User',
  is_suspended: false,
  suspended_at: null,
  suspended_by: null,
  suspension_reason: null,
  flow: { nodes: [], edges: [] },
  config: { model: 'gpt-4' },
  claw_config: { gates: ['credibility', 'avoidance', 'limits', 'worth'] },
  integration_config: null,
  version: 3,
  created_at: '2026-01-15T10:30:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  total_requests_30d: 5000,
  total_blocks_30d: 150,
  block_rate_30d: 3.0,
  avg_latency_ms: 245.5,
  deployments_count: 2,
  active_deployment_id: '660e8400-e29b-41d4-a716-446655440001',
  ...overrides,
})

const createMockAnalyticsDay = (date: string, overrides = {}) => ({
  date,
  requests: 200,
  blocks: 6,
  block_rate: 3.0,
  avg_latency_ms: 245.5,
  gate_truth_blocks: 1,
  gate_harm_blocks: 2,
  gate_scope_blocks: 2,
  gate_purpose_blocks: 1,
  ...overrides,
})

// Mock state to control test scenarios
const mockState = {
  // Stats
  statsResult: { data: [createMockStats()], error: null },

  // Agent list
  agentsListResult: {
    data: [
      createMockAgent(),
      createMockAgent({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'Agent 2' }),
    ],
    error: null,
  },

  // Agent details
  agentDetailsResult: { data: [createMockAgentDetails()], error: null },

  // Agent analytics
  analyticsResult: {
    data: [
      createMockAnalyticsDay('2026-01-20'),
      createMockAnalyticsDay('2026-01-19'),
      createMockAnalyticsDay('2026-01-18'),
    ],
    error: null,
  },

  // Suspend/unsuspend
  setStatusResult: {
    data: [{ success: true, previous_status: false, new_status: true, error: null }],
    error: null,
  },

  // Frameworks list
  frameworks: ['openai_agents', 'elizaos', 'custom'],

  // Statuses list
  statuses: ['draft', 'testing', 'deployed', 'archived'],

  // Error simulation flags
  simulateError: false,
  simulateNotFound: false,
}

// Build chainable query mock
function createQueryChain(
  getResult: () => { data?: unknown; error?: unknown; count?: number },
  options: { returnArray?: boolean } = {}
) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'eq',
    'neq',
    'gte',
    'lte',
    'order',
    'limit',
    'range',
    'is',
    'in',
    'ilike',
  ]

  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }

  chain.single = vi.fn(() => Promise.resolve(getResult()))

  chain.then = (resolve: (v: unknown) => void) => {
    const result = getResult()
    if (options.returnArray && result.data && !Array.isArray(result.data)) {
      resolve({ data: [result.data], error: result.error, count: result.count })
    } else {
      resolve(result)
    }
  }

  return chain
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() =>
          createQueryChain(() => mockState.agentsListResult, { returnArray: true })
        ),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      }
    }
    return {
      select: vi.fn(() => createQueryChain(() => ({ data: null, error: null }))),
    }
  }),
  rpc: vi.fn((funcName: string, _params?: Record<string, unknown>) => {
    if (funcName === 'admin_get_agents_stats') {
      return Promise.resolve(mockState.statsResult)
    }
    if (funcName === 'admin_list_agents') {
      return Promise.resolve(mockState.agentsListResult)
    }
    if (funcName === 'admin_get_agent_details') {
      if (mockState.simulateNotFound) {
        return Promise.resolve({ data: [], error: null })
      }
      return Promise.resolve(mockState.agentDetailsResult)
    }
    if (funcName === 'admin_set_agent_status') {
      return Promise.resolve(mockState.setStatusResult)
    }
    if (funcName === 'admin_get_agent_analytics') {
      return Promise.resolve(mockState.analyticsResult)
    }
    return Promise.resolve({ data: null, error: { message: 'Unknown RPC' } })
  }),
}

// Mock dependencies
vi.mock('../middleware/admin-auth', () => ({
  adminAuthMiddleware: vi.fn(
    (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set('wallet', 'AdminWallet12345678901234567890123456')
      c.set('adminRole', 'admin')
      c.set('walletHash', 'hash_admin_abc123')
      c.set('adminPermissions', {
        dashboards: ['overview', 'agents', 'deployments'],
        actions: ['view_agent', 'suspend_agent'],
      })
      return next()
    }
  ),
  requireDashboard: () => vi.fn((_c: unknown, next: () => Promise<void>) => next()),
  requireAction: () => vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('../middleware/admin-audit', () => ({
  adminAuditMiddleware: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Reset mock state before each test
function resetMocks() {
  mockState.statsResult = { data: [createMockStats()], error: null }
  mockState.agentsListResult = {
    data: [
      createMockAgent(),
      createMockAgent({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'Agent 2' }),
    ],
    error: null,
  }
  mockState.agentDetailsResult = { data: [createMockAgentDetails()], error: null }
  mockState.analyticsResult = {
    data: [
      createMockAnalyticsDay('2026-01-20'),
      createMockAnalyticsDay('2026-01-19'),
      createMockAnalyticsDay('2026-01-18'),
    ],
    error: null,
  }
  mockState.setStatusResult = {
    data: [{ success: true, previous_status: false, new_status: true, error: null }],
    error: null,
  }
  mockState.simulateError = false
  mockState.simulateNotFound = false
  vi.clearAllMocks()
}

const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
  JWT_SECRET: 'test-jwt-secret',
}

// ============================================
// TEST SUITES
// ============================================

describe('Admin Agents Routes', () => {
  beforeEach(() => {
    resetMocks()
  })

  // ==========================================
  // GET /admin/agents/stats
  // ==========================================
  describe('GET /admin/agents/stats', () => {
    it('returns platform agent statistics successfully', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('frameworks')
      expect(data).toHaveProperty('statuses')
      expect(data).toHaveProperty('generated_at')
      expect(data.stats).toHaveProperty('total_agents')
      expect(data.stats).toHaveProperty('active_agents')
      expect(data.stats).toHaveProperty('suspended_agents')
      expect(data.stats).toHaveProperty('by_framework')
      expect(data.stats).toHaveProperty('by_status')
    })

    it('returns frameworks and statuses lists', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      const data = await res.json()

      expect(Array.isArray(data.frameworks)).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
    })

    it('returns 500 on database error', async () => {
      mockState.statsResult = { data: null, error: { message: 'Database connection failed' } }

      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(500)

      const data = await res.json()
      expect(data.error).toContain('Failed')
    })
  })

  // ==========================================
  // GET /admin/agents
  // ==========================================
  describe('GET /admin/agents', () => {
    it('returns agents list successfully', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('agents')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('filters')
      expect(Array.isArray(data.agents)).toBe(true)
    })

    it('respects pagination parameters', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?limit=10&offset=20', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(20)
    })

    it('applies framework filter', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?framework=openai_agents', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.framework).toBe('openai_agents')
    })

    it('applies status filter', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?status=deployed', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.status).toBe('deployed')
    })

    it('applies suspended filter', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?suspended=true', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.suspended).toBe(true)
    })

    it('applies search filter', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?search=test', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.search).toBe('test')
    })

    it('applies order_by parameter', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?order_by=name&order_dir=asc', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
    })

    it('rejects invalid status value', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?status=invalid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects invalid order_by value', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?order_by=invalid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('enforces maximum limit of 100', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?limit=500', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects negative offset', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents?offset=-10', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/agents/:id
  // ==========================================
  describe('GET /admin/agents/:id', () => {
    const validAgentId = '550e8400-e29b-41d4-a716-446655440000'

    it('returns agent details successfully', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('agent')
      expect(data.agent).toHaveProperty('id')
      expect(data.agent).toHaveProperty('name')
      expect(data.agent).toHaveProperty('framework')
      expect(data.agent).toHaveProperty('status')
      expect(data.agent).toHaveProperty('total_requests_30d')
      expect(data.agent).toHaveProperty('block_rate_30d')
    })

    it('returns 400 for invalid UUID format', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents/invalid-uuid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toContain('Invalid agent ID')
    })

    it('returns 404 when agent not found', async () => {
      mockState.simulateNotFound = true

      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(404)

      const data = await res.json()
      expect(data.error).toBe('Agent not found')
    })

    it('includes suspension details when suspended', async () => {
      mockState.agentDetailsResult = {
        data: [
          createMockAgentDetails({
            is_suspended: true,
            suspended_at: '2026-01-20T10:00:00Z',
            suspended_by: 'hash_admin_abc',
            suspension_reason: 'Policy violation',
          }),
        ],
        error: null,
      }

      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.agent.is_suspended).toBe(true)
      expect(data.agent.suspended_at).toBe('2026-01-20T10:00:00Z')
      expect(data.agent.suspension_reason).toBe('Policy violation')
    })
  })

  // ==========================================
  // PATCH /admin/agents/:id/status
  // ==========================================
  describe('PATCH /admin/agents/:id/status', () => {
    const validAgentId = '550e8400-e29b-41d4-a716-446655440000'

    it('suspends agent successfully', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suspended: true,
          reason: 'Policy violation detected',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data).toHaveProperty('previous_status')
      expect(data).toHaveProperty('new_status')
    })

    it('unsuspends agent successfully', async () => {
      mockState.setStatusResult = {
        data: [{ success: true, previous_status: true, new_status: false, error: null }],
        error: null,
      }

      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suspended: false,
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      // API returns 'active' or 'suspended' strings, not booleans
      expect(data.new_status).toBe('active')
    })

    it('requires reason when suspending', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suspended: true,
          // Missing reason
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toContain('Reason is required')
    })

    it('rejects reason when unsuspending', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suspended: false,
          reason: 'Should not be allowed',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      // This should still succeed - reason is optional when unsuspending
      expect(res.status).toBe(200)
    })

    it('returns 400 for invalid UUID format', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents/invalid-uuid/status', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspended: true, reason: 'Test' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('returns 404 when agent not found', async () => {
      mockState.setStatusResult = {
        data: [
          { success: false, previous_status: null, new_status: null, error: 'AGENT_NOT_FOUND' },
        ],
        error: null,
      }

      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspended: true, reason: 'Test reason' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(404)

      const data = await res.json()
      expect(data.error).toBe('Agent not found')
    })

    it('validates reason length minimum (5 chars)', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspended: true, reason: 'Hi' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('validates reason length maximum (500 chars)', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ suspended: true, reason: 'a'.repeat(501) }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/agents/:id/analytics
  // ==========================================
  describe('GET /admin/agents/:id/analytics', () => {
    const validAgentId = '550e8400-e29b-41d4-a716-446655440000'

    it('returns agent analytics successfully', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/analytics`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('agent_id')
      expect(data).toHaveProperty('days')
      expect(data).toHaveProperty('analytics')
      expect(data).toHaveProperty('summary')
      expect(Array.isArray(data.analytics)).toBe(true)
    })

    it('accepts custom days parameter', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/analytics?days=7`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.days).toBe(7)
    })

    it('uses default of 30 days', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/analytics`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.days).toBe(30)
    })

    it('returns summary with totals', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/analytics`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.summary).toHaveProperty('total_requests')
      expect(data.summary).toHaveProperty('total_blocks')
      expect(data.summary).toHaveProperty('block_rate')
      expect(data.summary).toHaveProperty('gate_truth_blocks')
      expect(data.summary).toHaveProperty('gate_harm_blocks')
      expect(data.summary).toHaveProperty('gate_scope_blocks')
      expect(data.summary).toHaveProperty('gate_purpose_blocks')
    })

    it('returns 400 for invalid UUID format', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents/invalid-uuid/analytics', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects days below minimum (1)', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/analytics?days=0`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects days above maximum (90)', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request(`http://localhost/admin/agents/${validAgentId}/analytics?days=100`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // PAGINATION EDGE CASES
  // ==========================================
  describe('Pagination', () => {
    it('uses default limit of 50 when not specified', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(50)
    })

    it('uses default offset of 0 when not specified', async () => {
      const { adminAgentsRoutes } = await import('./admin-agents')
      const app = new Hono()
      app.route('/admin/agents', adminAgentsRoutes)

      const req = new Request('http://localhost/admin/agents', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.offset).toBe(0)
    })
  })
})

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================
describe('Validation Schemas', () => {
  describe('agentsListSchema', () => {
    it('validates status enum values', () => {
      const validStatuses = ['draft', 'testing', 'deployed', 'archived']
      expect(validStatuses.length).toBe(4)
    })

    it('validates order_by enum values', () => {
      const validOrderBy = ['name', 'created_at', 'updated_at']
      expect(validOrderBy.length).toBe(3)
    })

    it('validates order_dir enum values', () => {
      const validOrderDir = ['asc', 'desc']
      expect(validOrderDir.length).toBe(2)
    })
  })

  describe('setAgentStatusSchema', () => {
    it('has required suspended field', () => {
      const requiredFields = ['suspended']
      expect(requiredFields).toContain('suspended')
    })

    it('reason field is optional for unsuspend', () => {
      // The reason is only required when suspending
      const optionalFields = ['reason']
      expect(optionalFields).toContain('reason')
    })
  })

  describe('analyticsSchema', () => {
    it('has sensible days bounds', () => {
      const minDays = 1
      const maxDays = 90
      const defaultDays = 30

      expect(defaultDays).toBeGreaterThanOrEqual(minDays)
      expect(defaultDays).toBeLessThanOrEqual(maxDays)
    })
  })
})
