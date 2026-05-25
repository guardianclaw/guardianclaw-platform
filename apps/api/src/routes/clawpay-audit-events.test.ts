/**
 * ClawPay audit-events route tests. Coverage:
 *   - auth gate
 *   - list pagination + filter parsing
 *   - single-event fetch (200/400/404)
 *   - CSV export (content-type, header row, cell escaping, row count)
 *   - rejection of invalid filters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { clawpayAuditEventsRoutes } from './clawpay-audit-events'
import { testWallets } from '../test/fixtures/index'

interface PgError {
  code?: string
  message?: string
}

const mockState = {
  list: { data: [] as unknown[], error: null as PgError | null, count: 0 as number | null },
  one: { data: null as unknown, error: null as PgError | null },
}

function resetState(): void {
  mockState.list = { data: [], error: null, count: 0 }
  mockState.one = { data: null, error: null }
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
  from: vi.fn(() => ({
    select: vi.fn(() =>
      chain(
        () => mockState.list,
        () => mockState.one
      )
    ),
  })),
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
app.route('/clawpay', clawpayAuditEventsRoutes)

const validUUID = '11111111-1111-4111-8111-111111111111'

const sampleEvent = {
  id: validUUID,
  wallet_address: testWallets.alice,
  agent_id: null,
  event_kind: 'payment_blocked',
  endpoint: 'https://api.example.com/paid',
  network: 'base',
  asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  pay_to: '0xdeadbeef',
  amount_usd: 25.5,
  decision: 'block',
  risk_level: 'critical',
  gates: { credibility: { passed: true } },
  drainer_intel: [
    {
      kind: 'address',
      value: '0xdeadbeef',
      severity: 'critical',
      source: 'scamsniffer',
      scope: 'recipient',
    },
  ],
  reasoning: 'Recipient matched ScamSniffer feed',
  tx_signature: null,
  metadata: {},
  occurred_at: '2026-05-21T12:00:00Z',
  created_at: '2026-05-21T12:00:01Z',
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ClawPay audit-events routes', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  describe('auth gate', () => {
    it('returns 401 when missing Authorization', async () => {
      const res = await app.request('/clawpay/audit-events')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /clawpay/audit-events', () => {
    it('returns empty list with pagination metadata', async () => {
      const res = await app.request('/clawpay/audit-events', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { events: unknown[]; pagination: { total: number } }
      expect(body.events).toEqual([])
      expect(body.pagination.total).toBe(0)
    })

    it('returns events with filter parsing', async () => {
      mockState.list = { data: [sampleEvent], error: null, count: 1 }
      const res = await app.request(
        '/clawpay/audit-events?event_kind=payment_blocked&risk_level=critical&limit=20',
        { headers: { Authorization: 'Bearer t' } }
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        events: (typeof sampleEvent)[]
        pagination: { limit: number; total: number }
      }
      expect(body.events).toHaveLength(1)
      expect(body.events[0].risk_level).toBe('critical')
      expect(body.pagination.limit).toBe(20)
    })

    it('rejects invalid event_kind enum', async () => {
      const res = await app.request('/clawpay/audit-events?event_kind=payment_invalid', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('rejects invalid risk_level enum', async () => {
      const res = await app.request('/clawpay/audit-events?risk_level=extreme', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('accepts provider=stripe filter', async () => {
      mockState.list = { data: [sampleEvent], error: null, count: 1 }
      const res = await app.request('/clawpay/audit-events?provider=stripe', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
    })

    it('accepts provider=x402 filter', async () => {
      mockState.list = { data: [sampleEvent], error: null, count: 1 }
      const res = await app.request('/clawpay/audit-events?provider=x402', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
    })

    it('rejects unknown provider value', async () => {
      const res = await app.request('/clawpay/audit-events?provider=paypal', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('accepts simulation_status=suspicious_balance_change filter', async () => {
      mockState.list = { data: [sampleEvent], error: null, count: 1 }
      const res = await app.request(
        '/clawpay/audit-events?simulation_status=suspicious_balance_change',
        { headers: { Authorization: 'Bearer t' } }
      )
      expect(res.status).toBe(200)
    })

    it('rejects invalid simulation_status', async () => {
      const res = await app.request('/clawpay/audit-events?simulation_status=meltdown', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('rejects non-ISO occurred_after', async () => {
      const res = await app.request('/clawpay/audit-events?occurred_after=yesterday', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('caps limit at 200', async () => {
      const res = await app.request('/clawpay/audit-events?limit=500', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 500 when Supabase errors', async () => {
      mockState.list = {
        data: null as unknown as unknown[],
        error: { message: 'db down' },
        count: null,
      }
      const res = await app.request('/clawpay/audit-events', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(500)
    })
  })

  describe('GET /clawpay/audit-events/:id', () => {
    it('returns the event when found', async () => {
      mockState.one = { data: sampleEvent, error: null }
      const res = await app.request(`/clawpay/audit-events/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { event: typeof sampleEvent }
      expect(body.event.id).toBe(validUUID)
    })

    it('rejects invalid UUID', async () => {
      const res = await app.request('/clawpay/audit-events/not-uuid', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 404 when not found', async () => {
      mockState.one = { data: null, error: null }
      const res = await app.request(`/clawpay/audit-events/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(404)
    })

    it('returns 500 on database error', async () => {
      mockState.one = { data: null, error: { message: 'fatal' } }
      const res = await app.request(`/clawpay/audit-events/${validUUID}`, {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(500)
    })
  })

  describe('GET /clawpay/audit-events/export.csv', () => {
    it('returns CSV with the right content-type and headers', async () => {
      mockState.list = { data: [sampleEvent], error: null, count: 1 }
      const res = await app.request('/clawpay/audit-events/export.csv', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/text\/csv/)
      const disp = res.headers.get('content-disposition')
      expect(disp).toMatch(/attachment; filename="clawpay-audit-/)
      expect(res.headers.get('cache-control')).toBe('no-store')
    })

    it('includes header row + a row per event', async () => {
      mockState.list = { data: [sampleEvent, sampleEvent], error: null, count: 2 }
      const res = await app.request('/clawpay/audit-events/export.csv', {
        headers: { Authorization: 'Bearer t' },
      })
      const text = await res.text()
      const lines = text.split('\n')
      // 1 header + 2 data rows.
      expect(lines).toHaveLength(3)
      expect(lines[0]).toMatch(/^id,occurred_at,provider,event_kind,decision,risk_level/)
      // Sprint 4: simulation_status + simulation columns must be present.
      expect(lines[0]).toContain('simulation_status')
      expect(lines[0]).toContain('simulation')
    })

    it('escapes cells with commas and quotes', async () => {
      const evil = {
        ...sampleEvent,
        reasoning: 'has, comma and "quote"',
        endpoint: 'normal-no-escape',
      }
      mockState.list = { data: [evil], error: null, count: 1 }
      const res = await app.request('/clawpay/audit-events/export.csv', {
        headers: { Authorization: 'Bearer t' },
      })
      const text = await res.text()
      // CSV-escaped: doubled quotes and wrapped in outer quotes.
      expect(text).toContain('"has, comma and ""quote"""')
      // Non-escaped cell stays bare.
      expect(text).toContain('normal-no-escape')
    })

    it('renders nested objects as JSON', async () => {
      mockState.list = { data: [sampleEvent], error: null, count: 1 }
      const res = await app.request('/clawpay/audit-events/export.csv', {
        headers: { Authorization: 'Bearer t' },
      })
      const text = await res.text()
      expect(text).toContain('"scamsniffer"') // drainer_intel JSON cell
    })

    it('returns CSV with header row and zero data rows when empty', async () => {
      mockState.list = { data: [], error: null, count: 0 }
      const res = await app.request('/clawpay/audit-events/export.csv', {
        headers: { Authorization: 'Bearer t' },
      })
      const text = await res.text()
      const lines = text.split('\n').filter((l) => l.length > 0)
      expect(lines).toHaveLength(1)
    })

    it('caps export limit at 10,000', async () => {
      const res = await app.request('/clawpay/audit-events/export.csv?limit=50000', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('rejects invalid filter on export endpoint', async () => {
      const res = await app.request('/clawpay/audit-events/export.csv?event_kind=unknown', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(400)
    })

    it('returns 500 on database error', async () => {
      mockState.list = {
        data: null as unknown as unknown[],
        error: { message: 'db down' },
        count: null,
      }
      const res = await app.request('/clawpay/audit-events/export.csv', {
        headers: { Authorization: 'Bearer t' },
      })
      expect(res.status).toBe(500)
    })
  })
})
