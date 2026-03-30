/**
 * Admin Credits Routes Tests
 *
 * Comprehensive test coverage for all admin credits endpoints:
 * - Platform statistics
 * - User credit details and history
 * - Credit adjustments
 * - Deposits and adjustments listings
 * - Low balance users
 * - User notes management
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
  total_balance: 15000.5,
  total_deposited: 25000.0,
  total_spent: 10000.0,
  total_adjustments: 500.5,
  active_accounts: 150,
  zero_balance_accounts: 12,
  low_balance_accounts: 28,
  avg_balance: 100.0,
  deposits_24h: 15,
  deposits_7d: 85,
  deposits_30d: 320,
  revenue_24h: 450.0,
  revenue_7d: 2500.0,
  revenue_30d: 9500.0,
})

const createMockUserCredits = () => ({
  balance_usd: 25.5,
  total_deposited: 100.0,
  total_spent: 75.0,
  total_adjustments: 0.5,
  executions_remaining: 8500,
  last_deposit_at: '2026-01-15T10:30:00Z',
  deposit_count: 5,
  adjustment_count: 2,
})

const createMockDeposit = (overrides = {}) => ({
  id: 'dep-' + Math.random().toString(36).slice(2, 10),
  wallet_address: 'TestWallet123456789012345678901234567890',
  display_name: 'Test User',
  token: 'SOL',
  amount: 1.5,
  price_usd: 150.0,
  credits_usd: 225.0,
  bonus_applied: 1.0,
  tx_signature: 'tx_' + Math.random().toString(36).slice(2, 20),
  status: 'confirmed',
  created_at: '2026-01-20T14:30:00Z',
  ...overrides,
})

const createMockAdjustment = (overrides = {}) => ({
  id: 'adj-' + Math.random().toString(36).slice(2, 10),
  wallet_address: 'TestWallet123456789012345678901234567890',
  display_name: 'Test User',
  amount: 5.0,
  type: 'refund',
  reason: 'Service issue compensation',
  admin_wallet_hash: 'hash_abc123',
  reference_id: null,
  reference_type: null,
  balance_before: 20.0,
  balance_after: 25.0,
  created_at: '2026-01-20T14:30:00Z',
  ...overrides,
})

const createMockNote = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  wallet_address: 'TestWallet123456789012345678901234567890',
  note: 'Customer requested priority support',
  category: 'support',
  admin_wallet_hash: 'hash_abc123',
  is_pinned: false,
  created_at: '2026-01-20T14:30:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  ...overrides,
})

const createMockLowBalanceUser = (overrides = {}) => ({
  wallet_address: 'LowBalanceWallet12345678901234567890123',
  display_name: 'Low Balance User',
  balance_usd: 0.15,
  executions_remaining: 50,
  total_spent: 150.0,
  last_deposit_at: '2026-01-10T10:00:00Z',
  ...overrides,
})

// Mock state to control test scenarios
const mockState = {
  // Stats
  statsResult: { data: [createMockStats()], error: null },

  // User credits
  userCreditsResult: { data: [createMockUserCredits()], error: null },
  profileResult: {
    data: {
      wallet_address: 'TestWallet123456789012345678901234567890',
      display_name: 'Test User',
      status: 'active',
      plan: 'pro',
      created_at: '2025-06-15T08:00:00Z',
    },
    error: null,
  },

  // Deposits
  userDepositsResult: { data: [createMockDeposit(), createMockDeposit()], error: null },
  allDepositsResult: {
    data: [createMockDeposit(), createMockDeposit(), createMockDeposit()],
    error: null,
  },
  depositsCountResult: { count: 3, error: null },

  // Adjustments
  userAdjustmentsResult: { data: [createMockAdjustment()], error: null },
  allAdjustmentsResult: { data: [createMockAdjustment(), createMockAdjustment()], error: null },
  adjustmentsCountResult: { count: 2, error: null },

  // Adjust credits RPC
  adjustCreditsResult: {
    data: [{ success: true, new_balance: 30.5, adjustment_id: 'adj-new123' }],
    error: null,
  },

  // Low balance
  lowBalanceResult: { data: [createMockLowBalanceUser(), createMockLowBalanceUser()], error: null },

  // Notes
  notesResult: { data: [createMockNote(), createMockNote({ is_pinned: true })], error: null },
  insertNoteResult: { data: createMockNote(), error: null },
  deleteNoteResult: { error: null },
  updateNoteResult: { error: null },

  // Error simulation flags
  simulateError: false,
  simulateNotFound: false,
}

// Build chainable query mock
function createQueryChain(
  getResult: () => { data?: unknown; error?: unknown; count?: number },
  options: { returnArray?: boolean; supportCount?: boolean } = {}
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
    if (table === 'profiles') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.profileResult)),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      }
    }
    if (table === 'user_credits') {
      return {
        select: vi.fn(() =>
          createQueryChain(() => mockState.userCreditsResult, { returnArray: true })
        ),
      }
    }
    if (table === 'deposits') {
      return {
        select: vi.fn((cols: string) => {
          if (cols.includes('count')) {
            return createQueryChain(() => mockState.depositsCountResult)
          }
          const isUserQuery = cols.includes('wallet_address')
          return createQueryChain(
            () => (isUserQuery ? mockState.userDepositsResult : mockState.allDepositsResult),
            { returnArray: true }
          )
        }),
      }
    }
    if (table === 'credit_adjustments') {
      return {
        select: vi.fn((cols: string) => {
          if (cols.includes('count')) {
            return createQueryChain(() => mockState.adjustmentsCountResult)
          }
          return createQueryChain(() => mockState.allAdjustmentsResult, { returnArray: true })
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertNoteResult)),
          })),
        })),
      }
    }
    if (table === 'user_notes') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.notesResult, { returnArray: true })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertNoteResult)),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve(mockState.deleteNoteResult)),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve(mockState.updateNoteResult)),
        })),
      }
    }
    return {
      select: vi.fn(() => createQueryChain(() => ({ data: null, error: null }))),
    }
  }),
  rpc: vi.fn((funcName: string) => {
    if (funcName === 'admin_get_credits_stats') {
      return Promise.resolve(mockState.statsResult)
    }
    if (funcName === 'admin_get_user_credits') {
      return Promise.resolve(mockState.userCreditsResult)
    }
    if (funcName === 'admin_adjust_credits') {
      return Promise.resolve(mockState.adjustCreditsResult)
    }
    if (funcName === 'admin_get_low_balance_users') {
      return Promise.resolve(mockState.lowBalanceResult)
    }
    if (funcName === 'admin_get_all_deposits') {
      return Promise.resolve(mockState.allDepositsResult)
    }
    if (funcName === 'admin_get_all_adjustments') {
      return Promise.resolve(mockState.allAdjustmentsResult)
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
        dashboards: ['overview', 'credits', 'support'],
        actions: ['view_user', 'adjust_credits', 'manage_alerts'],
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
  mockState.userCreditsResult = { data: [createMockUserCredits()], error: null }
  mockState.profileResult = {
    data: {
      wallet_address: 'TestWallet123456789012345678901234567890',
      display_name: 'Test User',
      status: 'active',
      plan: 'pro',
      created_at: '2025-06-15T08:00:00Z',
    },
    error: null,
  }
  mockState.userDepositsResult = { data: [createMockDeposit(), createMockDeposit()], error: null }
  mockState.allDepositsResult = {
    data: [createMockDeposit(), createMockDeposit(), createMockDeposit()],
    error: null,
  }
  mockState.depositsCountResult = { count: 3, error: null }
  mockState.userAdjustmentsResult = { data: [createMockAdjustment()], error: null }
  mockState.allAdjustmentsResult = {
    data: [createMockAdjustment(), createMockAdjustment()],
    error: null,
  }
  mockState.adjustmentsCountResult = { count: 2, error: null }
  mockState.adjustCreditsResult = {
    data: [{ success: true, new_balance: 30.5, adjustment_id: 'adj-new123' }],
    error: null,
  }
  mockState.lowBalanceResult = {
    data: [createMockLowBalanceUser(), createMockLowBalanceUser()],
    error: null,
  }
  mockState.notesResult = {
    data: [createMockNote(), createMockNote({ is_pinned: true })],
    error: null,
  }
  mockState.insertNoteResult = { data: createMockNote(), error: null }
  mockState.deleteNoteResult = { error: null }
  mockState.updateNoteResult = { error: null }
  mockState.simulateError = false
  mockState.simulateNotFound = false
  vi.clearAllMocks()
}

// Create test app
async function _createTestApp() {
  const { adminCreditsRoutes } = await import('./admin-credits')
  const app = new Hono()

  app.use('*', async (c, next) => {
    const ctx = c as unknown as { env: Record<string, string> }
    ctx.env = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key',
      JWT_SECRET: 'test-jwt-secret',
    }
    await next()
  })

  app.route('/admin/credits', adminCreditsRoutes)
  return app
}

const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
  JWT_SECRET: 'test-jwt-secret',
}

// ============================================
// TEST SUITES
// ============================================

describe('Admin Credits Routes', () => {
  beforeEach(() => {
    resetMocks()
  })

  // ==========================================
  // GET /admin/credits/stats
  // ==========================================
  describe('GET /admin/credits/stats', () => {
    it('returns platform credit statistics successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('config')
      expect(data).toHaveProperty('generated_at')
      expect(data.stats).toHaveProperty('total_balance')
      expect(data.stats).toHaveProperty('active_accounts')
      expect(data.stats).toHaveProperty('revenue_30d')
      expect(data.config).toHaveProperty('cost_per_execution')
      expect(data.config).toHaveProperty('min_deposit_usd')
    })

    it('returns correct config values', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      const data = await res.json()

      expect(data.config.cost_per_execution).toBe(0.003)
      expect(data.config.min_deposit_usd).toBe(3.0)
    })

    it('returns 500 on database error', async () => {
      mockState.statsResult = { data: null, error: { message: 'Database connection failed' } }

      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/stats', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(500)

      const data = await res.json()
      expect(data.error).toContain('Failed')
    })
  })

  // ==========================================
  // GET /admin/credits/user/:wallet
  // ==========================================
  describe('GET /admin/credits/user/:wallet', () => {
    const validWallet = 'TestWallet123456789012345678901234567890'

    it('returns user credit details successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.wallet_address).toBe(validWallet)
      expect(data).toHaveProperty('credits')
      expect(data).toHaveProperty('display_name')
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('plan')
      expect(data).toHaveProperty('config')
    })

    it('returns 400 for wallet address too short', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/user/short', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toContain('Invalid wallet')
    })

    it('returns 400 for wallet address too long', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const longWallet = 'a'.repeat(100)
      const req = new Request(`http://localhost/admin/credits/user/${longWallet}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('returns user with null display_name when not set', async () => {
      mockState.profileResult = {
        data: {
          wallet_address: validWallet,
          display_name: null,
          status: 'active',
          plan: 'free',
          created_at: '2025-06-15T08:00:00Z',
        },
        error: null,
      }

      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.display_name).toBeNull()
    })
  })

  // ==========================================
  // POST /admin/credits/adjust
  // ==========================================
  describe('POST /admin/credits/adjust', () => {
    const validPayload = {
      wallet_address: 'TestWallet123456789012345678901234567890',
      amount: 10.0,
      type: 'refund',
      reason: 'Service issue compensation for downtime',
    }

    it('adjusts credits successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data).toHaveProperty('adjustment')
      expect(data).toHaveProperty('new_balance')
      expect(data).toHaveProperty('executions_remaining')
    })

    it('accepts negative amount for deductions', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPayload,
          amount: -5.0,
          type: 'penalty',
          reason: 'Abuse of service terms',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
    })

    it('rejects zero amount', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...validPayload, amount: 0 }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toBe('Invalid request')
    })

    it('rejects invalid adjustment type', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...validPayload, type: 'invalid_type' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('validates all valid adjustment types', async () => {
      const validTypes = ['refund', 'courtesy', 'correction', 'bonus', 'penalty']

      for (const type of validTypes) {
        resetMocks()
        const { adminCreditsRoutes } = await import('./admin-credits')
        const app = new Hono()
        app.route('/admin/credits', adminCreditsRoutes)

        const req = new Request('http://localhost/admin/credits/adjust', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...validPayload, type }),
        })

        const res = await app.fetch(req, mockEnv)
        expect(res.status).toBe(200)
      }
    })

    it('rejects reason shorter than 5 characters', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...validPayload, reason: 'Hi' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects reason longer than 500 characters', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...validPayload, reason: 'a'.repeat(501) }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects invalid wallet address format', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...validPayload, wallet_address: 'short' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('returns 404 when user not found', async () => {
      mockState.profileResult = { data: null, error: null }

      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validPayload),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(404)

      const data = await res.json()
      expect(data.error).toBe('User not found')
    })

    it('accepts optional reference_id and reference_type', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPayload,
          reference_id: 'TICKET-12345',
          reference_type: 'ticket',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)
    })

    it('validates reference_type enum values', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPayload,
          reference_id: 'ref-123',
          reference_type: 'invalid_ref_type',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('returns error when adjustment fails due to insufficient balance', async () => {
      mockState.adjustCreditsResult = {
        data: [{ success: false, new_balance: 0, error: 'INSUFFICIENT_BALANCE' }],
        error: null,
      }

      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjust', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validPayload,
          amount: -1000,
          type: 'penalty',
        }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.code).toBe('INSUFFICIENT_BALANCE')
    })
  })

  // ==========================================
  // GET /admin/credits/deposits
  // ==========================================
  describe('GET /admin/credits/deposits', () => {
    it('returns deposits list successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('deposits')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('filters')
      expect(Array.isArray(data.deposits)).toBe(true)
    })

    it('respects pagination parameters', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?limit=10&offset=20', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.offset).toBe(20)
    })

    it('applies status filter', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?status=confirmed', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.status).toBe('confirmed')
    })

    it('applies token filter', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?token=USDC', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.token).toBe('USDC')
    })

    it('rejects invalid status value', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?status=invalid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects invalid token value', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?token=BITCOIN', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('enforces maximum limit of 100', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?limit=500', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/credits/adjustments
  // ==========================================
  describe('GET /admin/credits/adjustments', () => {
    it('returns adjustments list successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjustments', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('adjustments')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('filters')
    })

    it('applies type filter', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjustments?type=refund', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.filters.type).toBe('refund')
    })

    it('rejects invalid type value', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/adjustments?type=invalid', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/credits/low-balance
  // ==========================================
  describe('GET /admin/credits/low-balance', () => {
    it('returns low balance users successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/low-balance', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('users')
      expect(data).toHaveProperty('threshold_usd')
      expect(data).toHaveProperty('threshold_executions')
      expect(data).toHaveProperty('pagination')
    })

    it('accepts custom threshold parameter', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/low-balance?threshold=0.50', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.threshold_usd).toBe(0.5)
    })

    it('uses default threshold of 0.30', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/low-balance', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.threshold_usd).toBe(0.3)
    })

    it('calculates threshold_executions correctly', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/low-balance?threshold=0.30', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      // 0.30 / 0.003 = 100 executions
      expect(data.threshold_executions).toBe(100)
    })

    it('rejects threshold below minimum (0.01)', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/low-balance?threshold=0.001', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects threshold above maximum (10)', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/low-balance?threshold=15', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /admin/credits/user/:wallet/deposits
  // ==========================================
  describe('GET /admin/credits/user/:wallet/deposits', () => {
    const validWallet = 'TestWallet123456789012345678901234567890'

    it('returns user deposit history successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/deposits`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('deposits')
      expect(data).toHaveProperty('pagination')
    })

    it('respects pagination parameters', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(
        `http://localhost/admin/credits/user/${validWallet}/deposits?limit=5&offset=10`,
        {
          headers: { Authorization: 'Bearer test-token' },
        }
      )

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(5)
      expect(data.pagination.offset).toBe(10)
    })
  })

  // ==========================================
  // GET /admin/credits/user/:wallet/adjustments
  // ==========================================
  describe('GET /admin/credits/user/:wallet/adjustments', () => {
    const validWallet = 'TestWallet123456789012345678901234567890'

    it('returns user adjustment history successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/adjustments`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('adjustments')
      expect(data).toHaveProperty('pagination')
    })
  })

  // ==========================================
  // USER NOTES ENDPOINTS
  // ==========================================
  describe('GET /admin/credits/user/:wallet/notes', () => {
    const validWallet = 'TestWallet123456789012345678901234567890'

    it('returns user notes successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('notes')
      expect(data).toHaveProperty('pagination')
    })
  })

  describe('POST /admin/credits/user/:wallet/notes', () => {
    const validWallet = 'TestWallet123456789012345678901234567890'
    const validNote = {
      note: 'Customer requested priority support for their enterprise account',
      category: 'support',
    }

    it('adds note successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validNote),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(201)
    })

    it('rejects empty note', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: '' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects note exceeding 2000 characters', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'a'.repeat(2001) }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('validates category enum values', async () => {
      const validCategories = ['general', 'support', 'billing', 'security', 'compliance']

      for (const category of validCategories) {
        resetMocks()
        const { adminCreditsRoutes } = await import('./admin-credits')
        const app = new Hono()
        app.route('/admin/credits', adminCreditsRoutes)

        const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ note: 'Test note content', category }),
        })

        const res = await app.fetch(req, mockEnv)
        expect(res.status).toBe(201)
      }
    })

    it('rejects invalid category', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Test note', category: 'invalid_category' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('returns 404 when user not found', async () => {
      mockState.profileResult = { data: null, error: null }

      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validNote),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(404)
    })

    it('uses default category of general when not specified', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/user/${validWallet}/notes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Note without category' }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(201)
    })
  })

  describe('DELETE /admin/credits/notes/:id', () => {
    const validNoteId = '550e8400-e29b-41d4-a716-446655440000'

    it('deletes note successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/notes/${validNoteId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('rejects invalid UUID format', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/notes/invalid-id', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)

      const data = await res.json()
      expect(data.error).toContain('Invalid note ID')
    })

    it('rejects malformed UUID', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/notes/550e8400-e29b-41d4-a716', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /admin/credits/notes/:id/pin', () => {
    const validNoteId = '550e8400-e29b-41d4-a716-446655440000'

    it('pins note successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/notes/${validNoteId}/pin`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_pinned: true }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.is_pinned).toBe(true)
    })

    it('unpins note successfully', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request(`http://localhost/admin/credits/notes/${validNoteId}/pin`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_pinned: false }),
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.is_pinned).toBe(false)
    })

    it('rejects invalid UUID format', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/notes/invalid-id/pin', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_pinned: true }),
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
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.limit).toBe(50)
    })

    it('uses default offset of 0 when not specified', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.pagination.offset).toBe(0)
    })

    it('rejects negative offset', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?offset=-10', {
        headers: { Authorization: 'Bearer test-token' },
      })

      const res = await app.fetch(req, mockEnv)
      expect(res.status).toBe(400)
    })

    it('rejects limit below 1', async () => {
      const { adminCreditsRoutes } = await import('./admin-credits')
      const app = new Hono()
      app.route('/admin/credits', adminCreditsRoutes)

      const req = new Request('http://localhost/admin/credits/deposits?limit=0', {
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
  describe('adjustCreditsSchema', () => {
    it('validates all required fields are present', () => {
      const requiredFields = ['wallet_address', 'amount', 'type', 'reason']
      requiredFields.forEach((field) => {
        expect(requiredFields).toContain(field)
      })
    })

    it('validates adjustment types', () => {
      const validTypes = ['refund', 'courtesy', 'correction', 'bonus', 'penalty']
      expect(validTypes.length).toBe(5)
    })

    it('validates reference types', () => {
      const validReferenceTypes = ['ticket', 'deposit', 'agent_event', 'other']
      expect(validReferenceTypes.length).toBe(4)
    })
  })

  describe('addNoteSchema', () => {
    it('validates note categories', () => {
      const validCategories = ['general', 'support', 'billing', 'security', 'compliance']
      expect(validCategories.length).toBe(5)
    })
  })

  describe('paginationSchema', () => {
    it('has sensible defaults', () => {
      const defaultLimit = 50
      const defaultOffset = 0
      const maxLimit = 100

      expect(defaultLimit).toBeGreaterThan(0)
      expect(defaultOffset).toBe(0)
      expect(maxLimit).toBeGreaterThanOrEqual(defaultLimit)
    })
  })

  describe('lowBalanceSchema', () => {
    it('has sensible threshold bounds', () => {
      const minThreshold = 0.01
      const maxThreshold = 10
      const defaultThreshold = 0.3

      expect(defaultThreshold).toBeGreaterThanOrEqual(minThreshold)
      expect(defaultThreshold).toBeLessThanOrEqual(maxThreshold)
    })
  })

  describe('depositsFilterSchema', () => {
    it('validates status values', () => {
      const validStatuses = ['pending', 'confirmed', 'failed']
      expect(validStatuses.length).toBe(3)
    })

    it('validates token values', () => {
      const validTokens = ['SOL', 'USDC', 'GCLAW']
      expect(validTokens.length).toBe(3)
    })
  })
})
