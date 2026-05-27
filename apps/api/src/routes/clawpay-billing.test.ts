/**
 * ClawPay billing route tests.
 *
 * Covers:
 *   - auth gate
 *   - GET /billing/account: synthetic Free default when no row, real row otherwise
 *   - GET /billing/current: preview shape, empty case, with blocked events
 *   - GET /billing/periods: list + pagination + status filter + validation
 *   - GET /billing/periods/:id: own period + records, 404 / 400 paths
 *   - POST /billing/periods/close: ensure-or-create open period + RPC call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { clawpayBillingRoutes } from './clawpay-billing'
import { testWallets } from '../test/fixtures/index'

interface PgError {
  code?: string
  message?: string
}

const mockState = {
  account: { data: null as unknown, error: null as PgError | null },
  periodList: {
    data: [] as unknown[],
    error: null as PgError | null,
    count: 0 as number | null,
  },
  periodOne: { data: null as unknown, error: null as PgError | null },
  recordsList: { data: [] as unknown[], error: null as PgError | null },
  auditEvents: { data: [] as unknown[], error: null as PgError | null, count: 0 as number | null },
  insertPeriod: { data: null as unknown, error: null as PgError | null },
  rpc: { data: null as unknown, error: null as PgError | null },
}

function resetState(): void {
  mockState.account = { data: null, error: null }
  mockState.periodList = { data: [], error: null, count: 0 }
  mockState.periodOne = { data: null, error: null }
  mockState.recordsList = { data: [], error: null }
  mockState.auditEvents = { data: [], error: null, count: 0 }
  mockState.insertPeriod = { data: null, error: null }
  mockState.rpc = { data: null, error: null }
}

function chain(
  getList: () => { data?: unknown; error?: PgError | null; count?: number | null },
  getOne: () => { data?: unknown; error?: PgError | null }
) {
  const c: Record<string, unknown> = {}
  for (const m of [
    'select',
    'eq',
    'neq',
    'gte',
    'lt',
    'gt',
    'is',
    'not',
    'order',
    'range',
    'limit',
  ]) {
    c[m] = vi.fn(() => c)
  }
  c.single = vi.fn(() => Promise.resolve(getOne()))
  c.maybeSingle = vi.fn(() => Promise.resolve(getOne()))
  c.then = (resolve: (v: unknown) => void): void => resolve(getList())
  return c
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'clawpay_billing_accounts') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.account,
            () => mockState.account
          )
        ),
      }
    }
    if (table === 'clawpay_billing_periods') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.periodList,
            () => mockState.periodOne
          )
        ),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertPeriod)),
          })),
        })),
      }
    }
    if (table === 'clawpay_billing_usage_records') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.recordsList,
            () => mockState.recordsList
          )
        ),
      }
    }
    if (table === 'clawpay_audit_events') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.auditEvents,
            () => mockState.auditEvents
          )
        ),
      }
    }
    return {
      select: vi.fn(() =>
        chain(
          () => ({ data: [], error: null }),
          () => ({ data: null, error: null })
        )
      ),
    }
  }),
  rpc: vi.fn((_name: string, _args: unknown) => Promise.resolve(mockState.rpc)),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('../lib/supabase-client', () => ({
  getUserClient: vi.fn(async () => mockSupabase),
  getServiceClient: vi.fn(() => mockSupabase),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as {
      req: { header: (n: string) => string | undefined }
      set: (k: string, v: string) => void
      json: (data: unknown, status: number) => Response
    }
    if (!ctx.req.header('Authorization')?.startsWith('Bearer ')) {
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

const app = new Hono()
app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://t.supabase.co',
    SUPABASE_SERVICE_KEY: 'svc',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_JWT_SECRET: 'jwt-secret-with-minimum-32-chars-padding!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  } as never
  await next()
})
app.route('/clawpay', clawpayBillingRoutes)

const validUUID = '11111111-1111-4111-8111-111111111111'

const proAccount = {
  wallet_address: testWallets.alice,
  stripe_customer_id: 'cus_x',
  stripe_subscription_id: 'sub_x',
  plan: 'pro',
  fee_bps: 50,
  subscription_fee_usd: 99,
  status: 'active',
  metadata: {},
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

const samplePeriod = {
  id: validUUID,
  wallet_address: testWallets.alice,
  period_start: '2026-05-01T00:00:00Z',
  period_end: '2026-06-01T00:00:00Z',
  status: 'closed',
  blocked_value_usd: 1_000,
  usage_fee_usd: 5,
  subscription_fee_usd: 99,
  total_usd: 104,
  blocked_event_count: 12,
  fee_bps_snapshot: 50,
  plan_snapshot: 'pro',
  stripe_invoice_id: null,
  stripe_invoice_url: null,
  closed_at: '2026-06-01T00:01:00Z',
  invoiced_at: null,
  paid_at: null,
  failed_at: null,
  failure_reason: null,
  metadata: {},
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-06-01T00:01:00Z',
}

describe('ClawPay billing routes', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  describe('auth gate', () => {
    it('returns 401 without Bearer', async () => {
      const res = await app.request('/clawpay/billing/account')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /clawpay/billing/account', () => {
    it('returns synthetic Free-tier when no row', async () => {
      mockState.account = { data: null, error: null }
      const res = await app.request('/clawpay/billing/account', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        account: { plan: string; fee_bps: number }
        account_configured: boolean
        plan_pricing: Record<string, unknown>
      }
      expect(body.account.plan).toBe('free')
      expect(body.account_configured).toBe(false)
      expect(body.plan_pricing).toHaveProperty('pro')
    })

    it('returns real account when row exists', async () => {
      mockState.account = { data: proAccount, error: null }
      const res = await app.request('/clawpay/billing/account', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        account: typeof proAccount
        account_configured: boolean
      }
      expect(body.account.plan).toBe('pro')
      expect(body.account_configured).toBe(true)
    })

    it('returns 500 on database error', async () => {
      mockState.account = { data: null, error: { message: 'db down' } }
      const res = await app.request('/clawpay/billing/account', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(500)
    })
  })

  describe('GET /clawpay/billing/current', () => {
    it('returns zeroed preview when no blocked events', async () => {
      mockState.account = { data: null, error: null }
      mockState.auditEvents = { data: [], error: null, count: 0 }
      const res = await app.request('/clawpay/billing/current', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        preview: {
          blocked_value_usd: number
          blocked_event_count: number
          usage_fee_usd: number
          plan: string
          account_configured: boolean
        }
      }
      expect(body.preview.blocked_value_usd).toBe(0)
      expect(body.preview.blocked_event_count).toBe(0)
      expect(body.preview.usage_fee_usd).toBe(0)
      expect(body.preview.plan).toBe('free')
      expect(body.preview.account_configured).toBe(false)
    })

    it('computes usage_fee from blocked events at 0.5% (pro account)', async () => {
      mockState.account = { data: proAccount, error: null }
      mockState.auditEvents = {
        data: [{ amount_usd: 1_000 }, { amount_usd: 500 }, { amount_usd: 250 }],
        error: null,
        count: 3,
      }
      const res = await app.request('/clawpay/billing/current', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        preview: {
          blocked_value_usd: number
          blocked_event_count: number
          usage_fee_usd: number
          subscription_fee_usd: number
          total_usd: number
        }
      }
      expect(body.preview.blocked_value_usd).toBe(1_750)
      expect(body.preview.blocked_event_count).toBe(3)
      // 1750 * 50 / 10000 = 8.75
      expect(body.preview.usage_fee_usd).toBe(8.75)
      expect(body.preview.subscription_fee_usd).toBe(99)
      // total = 8.75 + 99 = 107.75
      expect(body.preview.total_usd).toBe(107.75)
    })

    it('filters out null and zero amounts', async () => {
      mockState.account = { data: proAccount, error: null }
      mockState.auditEvents = {
        data: [{ amount_usd: 100 }, { amount_usd: null }, { amount_usd: 0 }, { amount_usd: 50 }],
        error: null,
        count: 4,
      }
      const res = await app.request('/clawpay/billing/current', {
        headers: { Authorization: 'Bearer t' },
      })
      const body = (await res.json()) as {
        preview: { blocked_value_usd: number; blocked_event_count: number }
      }
      expect(body.preview.blocked_value_usd).toBe(150)
      expect(body.preview.blocked_event_count).toBe(2)
    })
  })

  describe('GET /clawpay/billing/periods', () => {
    it('lists periods with pagination', async () => {
      mockState.periodList = { data: [samplePeriod], error: null, count: 1 }
      const res = await app.request('/clawpay/billing/periods', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        periods: unknown[]
        pagination: { total: number }
      }
      expect(body.periods).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })

    it('filters by status', async () => {
      mockState.periodList = { data: [samplePeriod], error: null, count: 1 }
      const res = await app.request('/clawpay/billing/periods?status=closed', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
    })

    it('rejects invalid status', async () => {
      const res = await app.request('/clawpay/billing/periods?status=meltdown', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('caps limit at 100', async () => {
      const res = await app.request('/clawpay/billing/periods?limit=500', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 500 on database error', async () => {
      mockState.periodList = {
        data: null as unknown as unknown[],
        error: { message: 'db down' },
        count: null,
      }
      const res = await app.request('/clawpay/billing/periods', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(500)
    })
  })

  describe('GET /clawpay/billing/periods/:id', () => {
    it('returns period + usage records', async () => {
      mockState.periodOne = { data: samplePeriod, error: null }
      mockState.recordsList = {
        data: [
          {
            id: 'r1',
            billing_period_id: validUUID,
            blocked_usd: 100,
            fee_usd: 0.5,
          },
        ],
        error: null,
      }
      const res = await app.request(`/clawpay/billing/periods/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        period: typeof samplePeriod
        usage_records: unknown[]
      }
      expect(body.period.id).toBe(validUUID)
      expect(body.usage_records).toHaveLength(1)
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await app.request('/clawpay/billing/periods/bad-id', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when not found', async () => {
      mockState.periodOne = { data: null, error: null }
      const res = await app.request(`/clawpay/billing/periods/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /clawpay/billing/periods/close', () => {
    it('creates an open period then closes via RPC', async () => {
      // No existing period → insert path.
      mockState.periodOne = { data: null, error: null }
      mockState.account = { data: proAccount, error: null }
      mockState.insertPeriod = {
        data: { ...samplePeriod, status: 'open' },
        error: null,
      }
      mockState.rpc = {
        data: {
          period_id: validUUID,
          status: 'closed',
          blocked_value_usd: 1_000,
          blocked_event_count: 10,
          usage_fee_usd: 5,
          subscription_fee_usd: 99,
          total_usd: 104,
          idempotent: false,
        },
        error: null,
      }

      const res = await app.request('/clawpay/billing/periods/close', {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        period_id: string
        result: { status: string; idempotent: boolean }
      }
      expect(body.result.status).toBe('closed')
      expect(body.result.idempotent).toBe(false)
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'close_clawpay_billing_period',
        expect.objectContaining({ p_period_id: expect.any(String) })
      )
    })

    it('uses existing open period when one is present', async () => {
      mockState.periodOne = {
        data: { ...samplePeriod, status: 'open' },
        error: null,
      }
      mockState.rpc = {
        data: {
          period_id: validUUID,
          status: 'closed',
          blocked_value_usd: 0,
          blocked_event_count: 0,
          usage_fee_usd: 0,
          subscription_fee_usd: 0,
          total_usd: 0,
          idempotent: false,
        },
        error: null,
      }
      const res = await app.request('/clawpay/billing/periods/close', {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
    })

    it('returns 500 when RPC fails', async () => {
      mockState.periodOne = {
        data: { ...samplePeriod, status: 'open' },
        error: null,
      }
      mockState.rpc = { data: null, error: { message: 'rpc raised' } }
      const res = await app.request('/clawpay/billing/periods/close', {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(500)
    })

    it('reports idempotent re-close', async () => {
      mockState.periodOne = {
        data: { ...samplePeriod, status: 'closed' },
        error: null,
      }
      mockState.rpc = {
        data: {
          period_id: validUUID,
          status: 'closed',
          blocked_value_usd: 1_000,
          blocked_event_count: 10,
          usage_fee_usd: 5,
          subscription_fee_usd: 99,
          total_usd: 104,
          idempotent: true,
        },
        error: null,
      }
      const res = await app.request('/clawpay/billing/periods/close', {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { result: { idempotent: boolean } }
      expect(body.result.idempotent).toBe(true)
    })
  })
})
