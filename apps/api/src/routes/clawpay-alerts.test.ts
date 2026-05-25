/**
 * ClawPay alerts route tests. Coverage:
 *   - auth gate
 *   - CRUD happy paths + validation errors
 *   - SSRF guard on create + update
 *   - 404 vs 409 distinction
 *   - test endpoint: fires fetch, persists delivery, returns status
 *   - test endpoint: timeout / network error path
 *   - test endpoint: SSRF re-check rejects rule whose URL became dangerous
 *   - deliveries listing: 404 when alert is foreign, 200 when own
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { clawpayAlertsRoutes } from './clawpay-alerts'
import { testWallets } from '../test/fixtures/index'

interface PgError {
  code?: string
  message?: string
}

const mockState = {
  agent: { data: null as unknown, error: null as PgError | null },
  list: { data: [] as unknown[], error: null as PgError | null, count: 0 as number | null },
  one: { data: null as unknown, error: null as PgError | null },
  insert: { data: null as unknown, error: null as PgError | null },
  update: { data: null as unknown, error: null as PgError | null },
  delete: { data: null as unknown, error: null as PgError | null },
  deliveryInsert: { data: null as unknown, error: null as PgError | null },
  deliveryList: { data: [] as unknown[], error: null as PgError | null, count: 0 as number | null },
}

function resetState(): void {
  mockState.agent = { data: null, error: null }
  mockState.list = { data: [], error: null, count: 0 }
  mockState.one = { data: null, error: null }
  mockState.insert = { data: null, error: null }
  mockState.update = { data: null, error: null }
  mockState.delete = { data: null, error: null }
  mockState.deliveryInsert = { data: null, error: null }
  mockState.deliveryList = { data: [], error: null, count: 0 }
}

function chain(
  getList: () => { data?: unknown; error?: PgError | null; count?: number | null },
  getOne: () => { data?: unknown; error?: PgError | null }
) {
  const c: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'range', 'limit']) {
    c[method] = vi.fn(() => c)
  }
  c.single = vi.fn(() => Promise.resolve(getOne()))
  c.maybeSingle = vi.fn(() => Promise.resolve(getOne()))
  c.then = (resolve: (v: unknown) => void): void => resolve(getList())
  return c
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.agent,
            () => mockState.agent
          )
        ),
      }
    }
    if (table === 'clawpay_alerts') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.list,
            () => mockState.one
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
        delete: vi.fn(() => {
          const d: Record<string, unknown> = {}
          for (const method of ['eq', 'select']) d[method] = vi.fn(() => d)
          d.maybeSingle = vi.fn(() => Promise.resolve(mockState.delete))
          return d
        }),
      }
    }
    if (table === 'clawpay_alert_deliveries') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.deliveryList,
            () => mockState.one
          )
        ),
        insert: vi.fn((_row: unknown) => {
          // Both shapes used: .insert().select().single() AND .insert() (fire-and-forget).
          const r: Record<string, unknown> = {}
          r.select = vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.deliveryInsert)),
          }))
          // Thenable so `await supabase.from(...).insert(...)` resolves.
          r.then = (resolve: (v: unknown) => void): void => resolve(mockState.deliveryInsert)
          return r
        }),
      }
    }
    return {
      select: vi.fn(() =>
        chain(
          () => mockState.list,
          () => mockState.one
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

// SSRF guard mock — let tests flip valid/invalid per case.
const ssrfState = { valid: true, error: 'Notification target is not allowed' }
vi.mock('../lib/ssrf-guard', () => ({
  checkUrlOrLog: vi.fn(async () =>
    ssrfState.valid ? { valid: true } : { valid: false, error: ssrfState.error }
  ),
}))

vi.mock('../lib/secure-logger', () => ({
  createSecureLogger: vi.fn(() => ({
    security: vi.fn(async () => undefined),
  })),
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
app.route('/clawpay', clawpayAlertsRoutes)

const validUUID = '11111111-1111-4111-8111-111111111111'

const alertFixture = {
  id: validUUID,
  wallet_address: testWallets.alice,
  agent_id: null,
  name: 'High-value blocks',
  description: null,
  condition: { kind: 'blocked_value_above', amount_usd: 100, window_minutes: 60 },
  notification_target: 'https://hooks.example.com/clawpay',
  notification_secret_hash: null,
  active: true,
  cooldown_seconds: 60,
  last_triggered_at: null,
  trigger_count: 0,
  metadata: {},
  created_at: '2026-05-21T00:00:00Z',
  updated_at: '2026-05-21T00:00:00Z',
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ClawPay alerts routes', () => {
  beforeEach(() => {
    resetState()
    ssrfState.valid = true
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  describe('auth gate', () => {
    it('returns 401 without Bearer', async () => {
      const res = await app.request('/clawpay/alerts')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /clawpay/alerts', () => {
    it('lists alerts with pagination', async () => {
      mockState.list = { data: [alertFixture], error: null, count: 1 }
      const res = await app.request('/clawpay/alerts', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        alerts: (typeof alertFixture)[]
        pagination: { total: number }
      }
      expect(body.alerts).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })

    it('rejects invalid agent_id query', async () => {
      const res = await app.request('/clawpay/alerts?agent_id=nope', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /clawpay/alerts', () => {
    const createBody = {
      name: 'My alert',
      condition: { kind: 'blocked_value_above', amount_usd: 50 },
      notification_target: 'https://hooks.example.com/x',
    }

    it('creates with valid body', async () => {
      mockState.insert = { data: alertFixture, error: null }
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as { alert: typeof alertFixture }
      expect(body.alert.name).toBe('High-value blocks')
    })

    it('rejects invalid JSON body', async () => {
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: 'not-json',
      })
      expect(res.status).toBe(400)
    })

    it('rejects missing name', async () => {
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createBody, name: undefined }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects non-http notification_target', async () => {
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createBody, notification_target: 'ftp://x.example.com' }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects condition without kind', async () => {
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createBody, condition: { foo: 'bar' } }),
      })
      expect(res.status).toBe(400)
    })

    it('rejects on SSRF guard failure', async () => {
      ssrfState.valid = false
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when agent_id does not belong to caller', async () => {
      mockState.agent = { data: null, error: null }
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createBody, agent_id: validUUID }),
      })
      expect(res.status).toBe(404)
    })

    it('returns 409 on duplicate name (Postgres 23505)', async () => {
      mockState.insert = { data: null, error: { code: '23505', message: 'duplicate' } }
      const res = await app.request('/clawpay/alerts', {
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      })
      expect(res.status).toBe(409)
    })
  })

  describe('GET /clawpay/alerts/:id', () => {
    it('returns alert when found', async () => {
      mockState.one = { data: alertFixture, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
    })

    it('rejects invalid UUID', async () => {
      const res = await app.request('/clawpay/alerts/bad', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when missing', async () => {
      mockState.one = { data: null, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /clawpay/alerts/:id', () => {
    it('updates with valid body', async () => {
      mockState.update = { data: { ...alertFixture, active: false }, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { alert: { active: boolean } }
      expect(body.alert.active).toBe(false)
    })

    it('rejects empty body', async () => {
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('re-checks SSRF when notification_target changes', async () => {
      ssrfState.valid = false
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_target: 'https://malicious.example.com' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when alert missing', async () => {
      mockState.update = { data: null, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /clawpay/alerts/:id', () => {
    it('deletes when found', async () => {
      mockState.delete = { data: { id: validUUID }, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
    })

    it('returns 404 when missing', async () => {
      mockState.delete = { data: null, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /clawpay/alerts/:id/test', () => {
    it('fires webhook and records a delivery on 200', async () => {
      mockState.one = { data: alertFixture, error: null }
      mockState.deliveryInsert = {
        data: { id: 'delivery-1', status: 'delivered' },
        error: null,
      }

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('ok', { status: 200 }))
      )

      const res = await app.request(`/clawpay/alerts/${validUUID}/test`, {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        tested: boolean
        http_status: number
        status: string
      }
      expect(body.tested).toBe(true)
      expect(body.http_status).toBe(200)
      expect(body.status).toBe('delivered')
      expect(fetch).toHaveBeenCalledWith(
        alertFixture.notification_target,
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('returns 502 when webhook fails with 5xx', async () => {
      mockState.one = { data: alertFixture, error: null }
      mockState.deliveryInsert = {
        data: { id: 'delivery-2', status: 'failed' },
        error: null,
      }

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('upstream down', { status: 503 }))
      )

      const res = await app.request(`/clawpay/alerts/${validUUID}/test`, {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(502)
      const body = (await res.json()) as { status: string; http_status: number }
      expect(body.status).toBe('failed')
      expect(body.http_status).toBe(503)
    })

    it('returns 502 when fetch throws (network error)', async () => {
      mockState.one = { data: alertFixture, error: null }
      mockState.deliveryInsert = {
        data: { id: 'delivery-3', status: 'failed' },
        error: null,
      }

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Network down')
        })
      )

      const res = await app.request(`/clawpay/alerts/${validUUID}/test`, {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(502)
    })

    it('rejects if SSRF re-check fails on stored URL', async () => {
      mockState.one = { data: alertFixture, error: null }
      ssrfState.valid = false

      const res = await app.request(`/clawpay/alerts/${validUUID}/test`, {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when alert missing', async () => {
      mockState.one = { data: null, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}/test`, {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(404)
    })

    it('rejects invalid UUID', async () => {
      const res = await app.request('/clawpay/alerts/bad/test', {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /clawpay/alerts/:id/deliveries', () => {
    it('returns deliveries for own alert', async () => {
      mockState.one = { data: { id: validUUID }, error: null }
      mockState.deliveryList = {
        data: [{ id: 'd1', status: 'delivered' }],
        error: null,
        count: 1,
      }

      const res = await app.request(`/clawpay/alerts/${validUUID}/deliveries`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        deliveries: unknown[]
        pagination: { total: number }
      }
      expect(body.deliveries).toHaveLength(1)
      expect(body.pagination.total).toBe(1)
    })

    it('returns 404 for a foreign alert (lookup miss)', async () => {
      mockState.one = { data: null, error: null }

      const res = await app.request(`/clawpay/alerts/${validUUID}/deliveries`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(404)
    })

    it('rejects invalid UUID', async () => {
      const res = await app.request('/clawpay/alerts/bad/deliveries', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('rejects invalid pagination', async () => {
      mockState.one = { data: { id: validUUID }, error: null }
      const res = await app.request(`/clawpay/alerts/${validUUID}/deliveries?limit=500`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })
  })
})
