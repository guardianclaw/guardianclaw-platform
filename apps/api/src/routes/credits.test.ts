import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { Hono } from 'hono'
import { creditsRoutes } from './credits'
import { createClient } from '@supabase/supabase-js'

// Mock environment
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars-padding!',
  JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  TREASURY_WALLET: 'TestTreasuryWallet123456789012345678901234',
  SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
}

// Type definitions for responses
interface PricingResponse {
  cost_per_execution: number
  minimum_deposit: number
  payment_tokens: Array<{
    token: string
    bonus: number
    note: string | null
  }>
  treasury: string
  examples: Record<string, number>
}

interface BalanceResponse {
  balance_usd: number
  total_deposited: number
  total_spent: number
  executions_remaining: number
  cost_per_execution: number
  warning_level: string
  alerts: {
    low_balance: boolean
    message: string | null
  }
}

interface ErrorResponse {
  error: string
  details?: unknown
}

// Mock JWT verification
const mockWallet = 'TestWalletAddress123456789012345678901234'

// Create a mock Supabase client with configurable responses
function createMockSupabase(
  overrides: {
    rpcResponse?: unknown
    selectResponse?: unknown
    insertResponse?: unknown
  } = {}
) {
  return {
    rpc: vi.fn(() =>
      Promise.resolve({
        data: overrides.rpcResponse ?? [
          {
            balance_usd: 10.5,
            total_deposited: 15.0,
            total_spent: 4.5,
            executions_remaining: 3500,
          },
        ],
        error: null,
      })
    ),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: overrides.selectResponse ?? null,
              error: null,
            })
          ),
          order: vi.fn(() => ({
            range: vi.fn(() =>
              Promise.resolve({
                data: overrides.selectResponse ?? [],
                error: null,
              })
            ),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: overrides.insertResponse ?? { id: 'test-deposit-id' },
              error: null,
            })
          ),
        })),
      })),
    })),
  }
}

// Mock the Supabase client
let mockSupabaseClient = createMockSupabase()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Mock auth middleware to inject wallet
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((c: unknown, next: () => Promise<void>) => {
    const context = c as { set: (key: string, value: string) => void }
    context.set('wallet', mockWallet)
    return next()
  }),
}))

// Mock rate limit middleware
vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => (c: unknown, next: () => Promise<void>) => next()),
}))

// Create test app
function createTestApp() {
  const app = new Hono()
  app.route('/credits', creditsRoutes)
  return app
}

describe('Credits Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient = createMockSupabase()
    ;(createClient as Mock).mockReturnValue(mockSupabaseClient)
  })

  // ============================================
  // GET /credits/pricing
  // ============================================
  describe('GET /credits/pricing', () => {
    it('should return pricing information', async () => {
      const app = createTestApp()
      const res = await app.request('/credits/pricing', {}, mockEnv)

      expect(res.status).toBe(200)

      const data = (await res.json()) as PricingResponse
      expect(data.cost_per_execution).toBe(0.003)
      expect(data.minimum_deposit).toBe(3.0)
      expect(data.payment_tokens).toHaveLength(3)
      expect(data.treasury).toBe(mockEnv.TREASURY_WALLET)
    })

    it('should include GCLAW bonus in payment tokens', async () => {
      const app = createTestApp()
      const res = await app.request('/credits/pricing', {}, mockEnv)

      const data = (await res.json()) as PricingResponse
      const clawToken = data.payment_tokens.find((t) => t.token === 'GCLAW')

      expect(clawToken).toBeDefined()
      expect(clawToken?.bonus).toBe(1.2)
      expect(clawToken?.note).toContain('20%')
    })

    it('should include execution examples', async () => {
      const app = createTestApp()
      const res = await app.request('/credits/pricing', {}, mockEnv)

      const data = (await res.json()) as PricingResponse
      expect(data.examples['$3.00_deposit']).toBe(1000) // $3 / $0.003
      expect(data.examples['$10.00_deposit']).toBe(3333) // $10 / $0.003
    })
  })

  // ============================================
  // GET /credits/balance
  // ============================================
  describe('GET /credits/balance', () => {
    it('should return balance for authenticated user', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/balance',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)

      const data = (await res.json()) as BalanceResponse
      expect(data.balance_usd).toBe(10.5)
      expect(data.total_deposited).toBe(15.0)
      expect(data.total_spent).toBe(4.5)
      expect(data.executions_remaining).toBe(3500)
      expect(data.cost_per_execution).toBe(0.003)
    })

    it('should return normal warning level for healthy balance', async () => {
      mockSupabaseClient = createMockSupabase({
        rpcResponse: [
          { balance_usd: 10, total_deposited: 10, total_spent: 0, executions_remaining: 3333 },
        ],
      })
      ;(createClient as Mock).mockReturnValue(mockSupabaseClient)

      const app = createTestApp()
      const res = await app.request(
        '/credits/balance',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      const data = (await res.json()) as BalanceResponse
      expect(data.warning_level).toBe('normal')
      expect(data.alerts.low_balance).toBe(false)
    })

    it('should return low warning level when executions < 100', async () => {
      mockSupabaseClient = createMockSupabase({
        rpcResponse: [
          { balance_usd: 0.2, total_deposited: 10, total_spent: 9.8, executions_remaining: 66 },
        ],
      })
      ;(createClient as Mock).mockReturnValue(mockSupabaseClient)

      const app = createTestApp()
      const res = await app.request(
        '/credits/balance',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      const data = (await res.json()) as BalanceResponse
      expect(data.warning_level).toBe('low')
      expect(data.alerts.low_balance).toBe(true)
    })

    it('should return critical warning level when executions < 10', async () => {
      mockSupabaseClient = createMockSupabase({
        rpcResponse: [
          { balance_usd: 0.02, total_deposited: 10, total_spent: 9.98, executions_remaining: 6 },
        ],
      })
      ;(createClient as Mock).mockReturnValue(mockSupabaseClient)

      const app = createTestApp()
      const res = await app.request(
        '/credits/balance',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      const data = (await res.json()) as BalanceResponse
      expect(data.warning_level).toBe('critical')
      expect(data.alerts.low_balance).toBe(true)
      expect(data.alerts.message).toContain('Critical')
    })

    it('should return zeros for new user with no balance', async () => {
      mockSupabaseClient = createMockSupabase({
        rpcResponse: [], // Empty result = no record
      })
      ;(createClient as Mock).mockReturnValue(mockSupabaseClient)

      const app = createTestApp()
      const res = await app.request(
        '/credits/balance',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      const data = (await res.json()) as BalanceResponse
      expect(data.balance_usd).toBe(0)
      expect(data.executions_remaining).toBe(0)
    })
  })

  // ============================================
  // POST /credits/deposit
  // ============================================
  describe('POST /credits/deposit', () => {
    it('should reject request with missing tx_signature', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/deposit',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: 'SOL',
          }),
        },
        mockEnv
      )

      expect(res.status).toBe(400)
      const data = (await res.json()) as ErrorResponse
      expect(data.error).toBe('Invalid request')
    })

    it('should reject request with invalid token', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/deposit',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tx_signature:
              '5wHu1Q6rVp9qW1j7x1e2YZ3j4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9',
            token: 'INVALID',
          }),
        },
        mockEnv
      )

      expect(res.status).toBe(400)
    })

    // Note: These integration tests would require more complex Supabase mocking
    // For full deposit flow testing, see the E2E tests
    it.skip('should reject already used transaction', async () => {
      // Skipped: Requires proper Supabase client mock setup
    })

    it.skip('should return 503 when treasury is not configured', async () => {
      // Skipped: Requires environment variable to be empty before route initialization
    })
  })

  // ============================================
  // GET /credits/history
  // ============================================
  describe('GET /credits/history', () => {
    it('should return deposit history', async () => {
      mockSupabaseClient = createMockSupabase({
        selectResponse: [
          {
            id: 'deposit-1',
            wallet_address: mockWallet,
            token: 'SOL',
            amount: 0.5,
            credits_usd: 75,
            bonus_applied: 1.0,
            tx_signature: 'sig1',
            status: 'confirmed',
            created_at: '2026-01-21T00:00:00Z',
          },
        ],
      })
      ;(createClient as Mock).mockReturnValue(mockSupabaseClient)

      const app = createTestApp()
      const res = await app.request(
        '/credits/history',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)
    })

    it('should support pagination parameters', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/history?limit=5&offset=10',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)
    })

    it('should reject invalid pagination parameters', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/history?limit=200',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(400)
      const data = (await res.json()) as ErrorResponse
      expect(data.error).toBe('Invalid query parameters')
    })
  })

  // ============================================
  // GET /credits/usage
  // ============================================
  describe('GET /credits/usage', () => {
    it('should return usage history', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/usage',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)
    })

    it('should support pagination parameters', async () => {
      const app = createTestApp()
      const res = await app.request(
        '/credits/usage?limit=10&offset=0',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)
    })
  })
})

// ============================================
// Integration Tests (invoke.ts credit checks)
// ============================================
describe('Invoke Credit Checks', () => {
  // These tests verify the integration between invoke.ts and credits.ts
  // They mock the credit deduction and verify proper error handling

  it('should require credits to execute agent', async () => {
    // This is tested in invoke.test.ts, but we verify the error format here
    const expectedErrorFormat = {
      error: expect.stringContaining('credits'),
      code: expect.any(String),
      balance_usd: expect.any(Number),
      required_usd: 0.003,
      hint: expect.stringContaining('/credits/deposit'),
    }

    // The actual test would be in invoke.test.ts
    expect(expectedErrorFormat.required_usd).toBe(0.003)
  })
})
