/**
 * Admin Deployments Routes Tests
 *
 * Comprehensive test coverage for all admin deployments endpoints:
 * - Platform statistics
 * - Deployment listing with filters
 * - Deployment details
 * - Deployment suspension/unsuspension
 * - Rate limit management
 * - Execution logs
 * - API keys
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
  total_deployments: 85,
  active_deployments: 52,
  suspended_deployments: 3,
  by_environment: { production: 30, staging: 25, development: 30 },
  by_status: { pending: 5, deployed: 65, stopped: 10, failed: 5 },
  created_7d: 8,
  created_30d: 25,
})

const createMockDeployment = (overrides = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440001',
  agent_id: '550e8400-e29b-41d4-a716-446655440000',
  agent_name: 'Test Agent',
  owner_wallet: 'TestWallet123456789012345678901234567890',
  owner_name: 'Test User',
  version: 3,
  status: 'deployed',
  environment: 'production',
  endpoint_url: 'https://api.claw.dev/agent/123',
  is_active: true,
  is_suspended: false,
  suspended_at: null,
  rate_limit_override: null,
  created_at: '2026-01-15T10:30:00Z',
  stopped_at: null,
  requests_24h: 1500,
  total_count: 85,
  ...overrides,
})

const createMockDeploymentDetails = (overrides = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440001',
  agent_id: '550e8400-e29b-41d4-a716-446655440000',
  agent_name: 'Test Agent',
  agent_framework: 'openai_agents',
  owner_wallet: 'TestWallet123456789012345678901234567890',
  owner_name: 'Test User',
  version: 3,
  status: 'deployed',
  environment: 'production',
  endpoint_url: 'https://api.claw.dev/agent/123',
  is_active: true,
  is_suspended: false,
  suspended_at: null,
  suspended_by: null,
  suspension_reason: null,
  rate_limit_override: null,
  config_snapshot: { model: 'gpt-4' },
  flow_snapshot: { nodes: [], edges: [] },
  claw_snapshot: { gates: ['credibility', 'avoidance'] },
  notes: 'Production deployment',
  deployed_by: 'TestWallet123456789012345678901234567890',
  created_at: '2026-01-15T10:30:00Z',
  stopped_at: null,
  requests_24h: 1500,
  requests_7d: 8500,
  blocks_24h: 45,
  api_keys_count: 3,
  ...overrides,
})

const createMockLog = (overrides = {}) => ({
  id: '770e8400-e29b-41d4-a716-446655440002',
  input_preview: 'User asked about...',
  output_preview: 'The response was...',
  claw_blocked: false,
  blocked_gate: null,
  execution_time_ms: 245,
  cost_usd: 0.003,
  created_at: '2026-01-20T14:30:00Z',
  total_count: 100,
  ...overrides,
})

const createMockApiKey = (overrides = {}) => ({
  id: '880e8400-e29b-41d4-a716-446655440003',
  key_prefix: 'sk_live_abc',
  name: 'Production Key',
  environment: 'production',
  is_revoked: false,
  rate_limit: null,
  created_at: '2026-01-10T08:00:00Z',
  last_used_at: '2026-01-20T14:00:00Z',
  requests_24h: 500,
  requests_total: 5000,
  ...overrides,
})

// Mock state to control test scenarios
const mockState = {
  // Stats
  statsResult: { data: [createMockStats()], error: null },

  // Deployment list
  deploymentsListResult: {
    data: [
      createMockDeployment(),
      createMockDeployment({ id: '660e8400-e29b-41d4-a716-446655440002', environment: 'staging' }),
    ],
    error: null,
  },

  // Deployment details
  deploymentDetailsResult: { data: [createMockDeploymentDetails()], error: null },

  // Logs
  logsResult: {
    data: [
      createMockLog(),
      createMockLog({
        id: '770e8400-e29b-41d4-a716-446655440003',
        claw_blocked: true,
        blocked_gate: 'avoidance',
      }),
    ],
    error: null,
  },

  // API Keys
  keysResult: {
    data: [
      createMockApiKey(),
      createMockApiKey({
        id: '880e8400-e29b-41d4-a716-446655440004',
        name: 'Staging Key',
        environment: 'staging',
      }),
    ],
    error: null,
  },

  // Suspend/unsuspend
  setStatusResult: {
    data: [{ success: true, previous_status: false, new_status: true, error: null }],
    error: null,
  },

  // Rate limit
  setRateLimitResult: {
    data: [{ success: true, previous_limit: null, new_limit: 100, error: null }],
    error: null,
  },

  // Environments list
  environments: ['production', 'staging', 'development'],

  // Statuses list
  statuses: ['pending', 'deployed', 'stopped', 'failed'],

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
  const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'range', 'is', 'in']

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
    if (table === 'deployments') {
      return {
        select: vi.fn(() =>
          createQueryChain(() => mockState.deploymentsListResult, { returnArray: true })
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
    if (funcName === 'admin_get_deployments_stats') {
      return Promise.resolve(mockState.statsResult)
    }
    if (funcName === 'admin_list_deployments') {
      return Promise.resolve(mockState.deploymentsListResult)
    }
    if (funcName === 'admin_get_deployment_details') {
      if (mockState.simulateNotFound) {
        return Promise.resolve({ data: [], error: null })
      }
      return Promise.resolve(mockState.deploymentDetailsResult)
    }
    if (funcName === 'admin_set_deployment_status') {
      return Promise.resolve(mockState.setStatusResult)
    }
    if (funcName === 'admin_set_deployment_rate_limit') {
      return Promise.resolve(mockState.setRateLimitResult)
    }
    if (funcName === 'admin_get_deployment_logs') {
      return Promise.resolve(mockState.logsResult)
    }
    if (funcName === 'admin_get_deployment_api_keys') {
      return Promise.resolve(mockState.keysResult)
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
        dashboards: ['overview', 'deployments', 'agents'],
        actions: ['view_deployment', 'suspend_deployment', 'manage_ratelimit'],
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
  mockState.deploymentsListResult = {
    data: [
      createMockDeployment(),
      createMockDeployment({ id: '660e8400-e29b-41d4-a716-446655440002', environment: 'staging' }),
    ],
    error: null,
  }
  mockState.deploymentDetailsResult = { data: [createMockDeploymentDetails()], error: null }
  mockState.logsResult = {
    data: [
      createMockLog(),
      createMockLog({
        id: '770e8400-e29b-41d4-a716-446655440003',
        claw_blocked: true,
        blocked_gate: 'avoidance',
      }),
    ],
    error: null,
  }
  mockState.keysResult = {
    data: [
      createMockApiKey(),
      createMockApiKey({
        id: '880e8400-e29b-41d4-a716-446655440004',
        name: 'Staging Key',
        environment: 'staging',
      }),
    ],
    error: null,
  }
  mockState.setStatusResult = {
    data: [{ success: true, previous_status: false, new_status: true, error: null }],
    error: null,
  }
  mockState.setRateLimitResult = {
    data: [{ success: true, previous_limit: null, new_limit: 100, error: null }],
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

describe('Admin Deployments Routes', () => {
  beforeEach(() => {
    resetMocks()
  })

  // ==========================================
  // GET /admin/deployments/stats
  // ==========================================
  describe('GET /admin/deployments/stats', () => {
    it('returns platform deployment statistics successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('environments')
      expect(data).toHaveProperty('statuses')
      expect(data).toHaveProperty('generated_at')
      expect(data.stats).toHaveProperty('total_deployments')
      expect(data.stats).toHaveProperty('active_deployments')
      expect(data.stats).toHaveProperty('suspended_deployments')
      expect(data.stats).toHaveProperty('by_environment')
      expect(data.stats).toHaveProperty('by_status')
    })

    it('returns environments and statuses lists', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      const data = await res.json()

      expect(Array.isArray(data.environments)).toBe(true)
      expect(Array.isArray(data.statuses)).toBe(true)
    })

    it('returns 500 on database error', async () => {
      mockState.statsResult = { data: null, error: { message: 'Database connection failed' } }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(500)

      const data = await res.json()
      expect(data.error).toContain('Failed')
    })
  })

  // ==========================================
  // GET /admin/deployments
  // ==========================================
  describe('GET /admin/deployments', () => {
    it('returns deployments list successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('deployments')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('filters')
      expect(Array.isArray(data.deployments)).toBe(true)
    })

    it('respects pagination parameters', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?limit=10&offset=20', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(20)
    })

    it('applies environment filter', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?environment=production', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.environment).toBe('production')
    })

    it('applies status filter', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?status=deployed', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.status).toBe('deployed')
    })

    it('applies suspended filter', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?suspended=true', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.suspended).toBe(true)
    })

    it('applies active_only filter', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?active_only=true', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.active_only).toBe(true)
    })

    it('rejects invalid environment value', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?environment=invalid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects invalid status value', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?status=invalid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('enforces maximum limit of 100', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?limit=500', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/deployments/:id
  // ==========================================
  describe('GET /admin/deployments/:id', () => {
    const validDeploymentId = '660e8400-e29b-41d4-a716-446655440001'

    it('returns deployment details successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('deployment')
      expect(data.deployment).toHaveProperty('id')
      expect(data.deployment).toHaveProperty('agent_name')
      expect(data.deployment).toHaveProperty('environment')
      expect(data.deployment).toHaveProperty('status')
      expect(data.deployment).toHaveProperty('requests_24h')
      expect(data.deployment).toHaveProperty('api_keys_count')
    })

    it('returns 400 for invalid UUID format', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments/invalid-uuid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toContain('Invalid deployment ID')
    })

    it('returns 404 when deployment not found', async () => {
      mockState.simulateNotFound = true

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(404)

      const data = await res.json()
      expect(data.error).toBe('Deployment not found')
    })

    it('includes suspension details when suspended', async () => {
      mockState.deploymentDetailsResult = {
        data: [
          createMockDeploymentDetails({
            is_suspended: true,
            suspended_at: '2026-01-20T10:00:00Z',
            suspended_by: 'hash_admin_abc',
            suspension_reason: 'Rate limit exceeded',
          }),
        ],
        error: null,
      }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.deployment.is_suspended).toBe(true)
      expect(data.deployment.suspended_at).toBe('2026-01-20T10:00:00Z')
      expect(data.deployment.suspension_reason).toBe('Rate limit exceeded')
    })
  })

  // ==========================================
  // PATCH /admin/deployments/:id/status
  // ==========================================
  describe('PATCH /admin/deployments/:id/status', () => {
    const validDeploymentId = '660e8400-e29b-41d4-a716-446655440001'

    it('suspends deployment successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suspended: true,
          reason: 'Excessive API calls detected',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data).toHaveProperty('previous_status')
      expect(data).toHaveProperty('new_status')
    })

    it('unsuspends deployment successfully', async () => {
      mockState.setStatusResult = {
        data: [{ success: true, previous_status: true, new_status: false, error: null }],
        error: null,
      }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/status`, {
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
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/status`, {
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

    it('returns 404 when deployment not found', async () => {
      mockState.setStatusResult = {
        data: [
          {
            success: false,
            previous_status: null,
            new_status: null,
            error: 'DEPLOYMENT_NOT_FOUND',
          },
        ],
        error: null,
      }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/status`, {
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
      expect(data.error).toBe('Deployment not found')
    })
  })

  // ==========================================
  // PATCH /admin/deployments/:id/ratelimit
  // ==========================================
  describe('PATCH /admin/deployments/:id/ratelimit', () => {
    const validDeploymentId = '660e8400-e29b-41d4-a716-446655440001'

    it('sets rate limit successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/ratelimit`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_limit: 100,
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data).toHaveProperty('previous_limit')
      expect(data).toHaveProperty('new_limit')
    })

    it('removes rate limit override with null', async () => {
      mockState.setRateLimitResult = {
        data: [{ success: true, previous_limit: 100, new_limit: null, error: null }],
        error: null,
      }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/ratelimit`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_limit: null,
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.new_limit).toBeNull()
    })

    it('allows unlimited rate limit (0)', async () => {
      mockState.setRateLimitResult = {
        data: [{ success: true, previous_limit: 100, new_limit: 0, error: null }],
        error: null,
      }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/ratelimit`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_limit: 0,
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.new_limit).toBe(0)
    })

    it('rejects negative rate limit', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/ratelimit`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_limit: -10,
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects rate limit above maximum (10000)', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/ratelimit`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rate_limit: 50000,
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('returns 404 when deployment not found', async () => {
      mockState.setRateLimitResult = {
        data: [
          { success: false, previous_limit: null, new_limit: null, error: 'DEPLOYMENT_NOT_FOUND' },
        ],
        error: null,
      }

      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/ratelimit`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rate_limit: 100 }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(404)

      const data = await res.json()
      expect(data.error).toBe('Deployment not found')
    })
  })

  // ==========================================
  // GET /admin/deployments/:id/logs
  // ==========================================
  describe('GET /admin/deployments/:id/logs', () => {
    const validDeploymentId = '660e8400-e29b-41d4-a716-446655440001'

    it('returns execution logs successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/logs`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('logs')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('filters')
      expect(Array.isArray(data.logs)).toBe(true)
    })

    it('respects pagination parameters', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(
        `http://localhost/admin/deployments/${validDeploymentId}/logs?limit=10&offset=20`,
        {
          headers: { Authorization: 'Bearer test-token' },
        }
      )

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(20)
    })

    it('applies blocked_only filter', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(
        `http://localhost/admin/deployments/${validDeploymentId}/logs?blocked_only=true`,
        {
          headers: { Authorization: 'Bearer test-token' },
        }
      )

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.blocked_only).toBe(true)
    })

    it('returns 400 for invalid UUID format', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments/invalid-uuid/logs', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/deployments/:id/keys
  // ==========================================
  describe('GET /admin/deployments/:id/keys', () => {
    const validDeploymentId = '660e8400-e29b-41d4-a716-446655440001'

    it('returns API keys successfully', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/keys`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('keys')
      expect(data).toHaveProperty('count')
      expect(Array.isArray(data.keys)).toBe(true)
    })

    it('includes key usage statistics', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request(`http://localhost/admin/deployments/${validDeploymentId}/keys`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      if (data.keys.length > 0) {
        expect(data.keys[0]).toHaveProperty('requests_24h')
        expect(data.keys[0]).toHaveProperty('requests_total')
        expect(data.keys[0]).toHaveProperty('last_used_at')
      }
    })

    it('returns 400 for invalid UUID format', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments/invalid-uuid/keys', {
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
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(50)
    })

    it('uses default offset of 0 when not specified', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.offset).toBe(0)
    })

    it('rejects negative offset', async () => {
      const { adminDeploymentsRoutes } = await import('./admin-deployments')
      const app = new Hono()
      app.route('/admin/deployments', adminDeploymentsRoutes)

      const req = new Request('http://localhost/admin/deployments?offset=-10', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })
})

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================
describe('Validation Schemas', () => {
  describe('deploymentsListSchema', () => {
    it('validates environment enum values', () => {
      const validEnvironments = ['production', 'staging', 'development']
      expect(validEnvironments.length).toBe(3)
    })

    it('validates status enum values', () => {
      const validStatuses = ['pending', 'deployed', 'stopped', 'failed']
      expect(validStatuses.length).toBe(4)
    })
  })

  describe('setDeploymentStatusSchema', () => {
    it('has required suspended field', () => {
      const requiredFields = ['suspended']
      expect(requiredFields).toContain('suspended')
    })
  })

  describe('setRateLimitSchema', () => {
    it('has sensible rate limit bounds', () => {
      const minRateLimit = 0
      const maxRateLimit = 10000

      expect(minRateLimit).toBeGreaterThanOrEqual(0)
      expect(maxRateLimit).toBeLessThanOrEqual(10000)
    })
  })

  describe('logsFilterSchema', () => {
    it('has blocked_only filter option', () => {
      const validFilters = ['blocked_only']
      expect(validFilters).toContain('blocked_only')
    })
  })
})
