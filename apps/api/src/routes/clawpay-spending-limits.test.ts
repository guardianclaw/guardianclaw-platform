/**
 * ClawPay spending-limits route tests.
 *
 * Mirrors the inline-mock pattern from alerts.test.ts so the test surface
 * stays consistent across routes. Tests:
 *   - auth gate (no Bearer → 401)
 *   - validation errors (bad body, bad UUID, empty PATCH)
 *   - happy-path CRUD
 *   - 404 vs 409 distinction
 *   - pagination query parsing
 *   - agent ownership check
 *   - soft-delete semantics (idempotency)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { clawpaySpendingLimitsRoutes } from './clawpay-spending-limits'
import { testWallets } from '../test/fixtures/index'

// ===========================================================================
// Mock state — shared between tests, reset in beforeEach
// ===========================================================================

interface PgError {
  code?: string
  message?: string
}

const mockState = {
  agent: { data: null as unknown, error: null as PgError | null },
  list: { data: [] as unknown[], error: null as PgError | null, count: 0 as number | null },
  selectOne: { data: null as unknown, error: null as PgError | null },
  insert: { data: null as unknown, error: null as PgError | null },
  update: { data: null as unknown, error: null as PgError | null },
  delete: { data: null as unknown, error: null as PgError | null },
}

function resetState(): void {
  mockState.agent = { data: null, error: null }
  mockState.list = { data: [], error: null, count: 0 }
  mockState.selectOne = { data: null, error: null }
  mockState.insert = { data: null, error: null }
  mockState.update = { data: null, error: null }
  mockState.delete = { data: null, error: null }
}

// A fluent chain builder. `getList` resolves on await (e.g. `await query`),
// `getOne` resolves on `.single()` / `.maybeSingle()`. Splitting these two
// terminals keeps list and get-one tests independent.
function chain(
  getList: () => { data?: unknown; error?: PgError | null; count?: number | null },
  getOne: () => { data?: unknown; error?: PgError | null }
) {
  const c: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'order', 'range', 'limit']) {
    c[method] = vi.fn(() => c)
  }
  c.single = vi.fn(() => Promise.resolve(getOne()))
  c.maybeSingle = vi.fn(() => Promise.resolve(getOne()))
  // Thenable so `await query` works without an explicit terminal call.
  c.then = (resolve: (v: unknown) => void): void => resolve(getList())
  return c
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        // Agent ownership check uses .maybeSingle() only.
        select: vi.fn(() =>
          chain(
            () => mockState.agent,
            () => mockState.agent
          )
        ),
      }
    }
    if (table === 'clawpay_spending_limits') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.list,
            () => mockState.selectOne
          )
        ),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insert)),
          })),
        })),
        update: vi.fn(() => {
          const u: Record<string, unknown> = {}
          for (const method of ['eq', 'select']) u[method] = vi.fn(() => u)
          u.maybeSingle = vi.fn(() => Promise.resolve(mockState.update))
          return u
        }),
      }
    }
    return {
      select: vi.fn(() =>
        chain(
          () => mockState.selectOne,
          () => mockState.selectOne
        )
      ),
    }
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('../lib/supabase-client', () => ({
  getUserClient: vi.fn(async () => mockSupabase),
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

// ===========================================================================
// Test app
// ===========================================================================

const app = new Hono()
app.use('*', async (c, next) => {
  // Minimal env so authMiddleware mock can ignore it.
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'svc',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_JWT_SECRET: 'jwt-secret-with-minimum-32-chars-padding!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  } as never
  await next()
})
app.route('/clawpay', clawpaySpendingLimitsRoutes)

const validUUID = '11111111-1111-4111-8111-111111111111'
const otherUUID = '22222222-2222-4222-8222-222222222222'
const limitFixture = {
  id: validUUID,
  wallet_address: testWallets.alice,
  agent_id: null,
  name: 'Daily USDC cap',
  period: 'daily',
  limit_usd: 500,
  active: true,
  description: null,
  metadata: {},
  created_at: '2026-05-21T00:00:00Z',
  updated_at: '2026-05-21T00:00:00Z',
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ClawPay spending-limits routes', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  describe('auth gate', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.request('/clawpay/spending-limits')
      expect(res.status).toBe(401)
    })

    it('returns 401 when Authorization header is not Bearer', async () => {
      const res = await app.request('/clawpay/spending-limits', {
        headers: { Authorization: 'Basic xyz' },
      })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /clawpay/spending-limits — list', () => {
    it('returns empty list when none exist', async () => {
      mockState.list = { data: [], error: null, count: 0 }

      const res = await app.request('/clawpay/spending-limits', {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { limits: unknown[]; pagination: { total: number } }
      expect(body.limits).toEqual([])
      expect(body.pagination.total).toBe(0)
    })

    it('returns existing limits with pagination metadata', async () => {
      mockState.list = { data: [limitFixture], error: null, count: 1 }

      const res = await app.request('/clawpay/spending-limits?limit=10&offset=0', {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        limits: (typeof limitFixture)[]
        pagination: { limit: number; offset: number; total: number }
      }
      expect(body.limits).toHaveLength(1)
      expect(body.limits[0].id).toBe(validUUID)
      expect(body.pagination).toEqual({ limit: 10, offset: 0, total: 1 })
    })

    it('rejects invalid limit query param', async () => {
      const res = await app.request('/clawpay/spending-limits?limit=500', {
        headers: { Authorization: 'Bearer test' },
      })
      // limit > 200 → 400
      expect(res.status).toBe(400)
    })

    it('rejects invalid agent_id query (not a UUID)', async () => {
      const res = await app.request('/clawpay/spending-limits?agent_id=not-a-uuid', {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 500 when Supabase errors', async () => {
      mockState.list = {
        data: null as unknown as unknown[],
        error: { message: 'db down' },
        count: null,
      }

      const res = await app.request('/clawpay/spending-limits', {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(500)
    })
  })

  describe('POST /clawpay/spending-limits — create', () => {
    it('creates a limit with valid body', async () => {
      mockState.insert = { data: limitFixture, error: null }

      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Daily USDC cap',
          period: 'daily',
          limit_usd: 500,
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { limit: typeof limitFixture }
      expect(body.limit.name).toBe('Daily USDC cap')
    })

    it('returns 400 for invalid JSON', async () => {
      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: 'not-json',
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for missing required field', async () => {
      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'daily', limit_usd: 100 }),
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { details?: unknown }
      expect(body.details).toBeDefined()
    })

    it('returns 400 for negative limit_usd', async () => {
      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'bad', period: 'daily', limit_usd: -1 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for limit_usd above $1M cap', async () => {
      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'too big', period: 'lifetime', limit_usd: 5_000_000 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid period enum', async () => {
      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x', period: 'fortnightly', limit_usd: 10 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when agent_id does not belong to caller', async () => {
      mockState.agent = { data: null, error: null }

      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'with agent',
          period: 'daily',
          limit_usd: 10,
          agent_id: otherUUID,
        }),
      })
      expect(res.status).toBe(404)
    })

    it('accepts a wallet-wide limit (agent_id=null) without ownership check', async () => {
      mockState.insert = { data: { ...limitFixture, agent_id: null }, error: null }

      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'global',
          period: 'monthly',
          limit_usd: 1000,
          agent_id: null,
        }),
      })
      expect(res.status).toBe(201)
    })

    it('returns 409 on unique-slot collision (Postgres 23505)', async () => {
      mockState.insert = { data: null, error: { code: '23505', message: 'duplicate' } }

      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'dup', period: 'daily', limit_usd: 10 }),
      })
      expect(res.status).toBe(409)
      const body = (await res.json()) as { error: string; hint?: string }
      expect(body.hint).toMatch(/PATCH the existing limit/)
    })

    it('returns 500 for unexpected database error', async () => {
      mockState.insert = { data: null, error: { code: 'XX000', message: 'fatal' } }

      const res = await app.request('/clawpay/spending-limits', {
        method: 'POST',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'x', period: 'daily', limit_usd: 10 }),
      })
      expect(res.status).toBe(500)
    })
  })

  describe('GET /clawpay/spending-limits/:id', () => {
    it('returns the limit when found', async () => {
      mockState.selectOne = { data: limitFixture, error: null }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { limit: typeof limitFixture }
      expect(body.limit.id).toBe(validUUID)
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await app.request('/clawpay/spending-limits/not-uuid', {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when not found', async () => {
      mockState.selectOne = { data: null, error: null }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /clawpay/spending-limits/:id', () => {
    it('updates with a single field', async () => {
      mockState.update = { data: { ...limitFixture, limit_usd: 750 }, error: null }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit_usd: 750 }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { limit: { limit_usd: number } }
      expect(body.limit.limit_usd).toBe(750)
    })

    it('returns 400 on empty body', async () => {
      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 on invalid UUID', async () => {
      const res = await app.request('/clawpay/spending-limits/not-uuid', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit_usd: 100 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when not found', async () => {
      mockState.update = { data: null, error: null }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit_usd: 100 }),
      })
      expect(res.status).toBe(404)
    })

    it('returns 409 on slot-collision update', async () => {
      mockState.update = { data: null, error: { code: '23505', message: 'duplicate' } }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'collides' }),
      })
      expect(res.status).toBe(409)
    })

    it('rejects invalid JSON', async () => {
      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        body: 'not-json',
      })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /clawpay/spending-limits/:id — soft-delete', () => {
    it('soft-deletes an active row', async () => {
      mockState.update = { data: { id: validUUID }, error: null }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: boolean; id: string }
      expect(body.success).toBe(true)
      expect(body.id).toBe(validUUID)
    })

    it('returns 404 when the row is already inactive or missing', async () => {
      mockState.update = { data: null, error: null }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(404)
    })

    it('returns 400 on invalid UUID', async () => {
      const res = await app.request('/clawpay/spending-limits/not-uuid', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 500 on database error', async () => {
      mockState.update = { data: null, error: { code: 'XX000', message: 'fatal' } }

      const res = await app.request(`/clawpay/spending-limits/${validUUID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test' },
      })
      expect(res.status).toBe(500)
    })
  })
})
