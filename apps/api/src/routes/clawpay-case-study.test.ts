/**
 * Tests for /clawpay/case-study/export.
 *
 * The route and the pure builder are tested separately:
 *   - `buildReport` is the data-shape contract (deterministic, no mocks).
 *   - The route checks auth + query validation + integration with the
 *     Supabase audit-events table mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { buildReport, clawpayCaseStudyRoutes } from './clawpay-case-study'
import { testWallets } from '../test/fixtures/index'

interface AuditEventRow {
  id: string
  occurred_at: string
  provider: string | null
  event_kind: string
  risk_level: string
  endpoint: string | null
  network: string | null
  asset: string | null
  pay_to: string | null
  amount_usd: number | null
  drainer_intel: unknown
  reasoning: string | null
  simulation: { status?: string; provider?: string } | null
}

function event(overrides: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    occurred_at: '2026-05-21T12:00:00Z',
    provider: 'x402',
    event_kind: 'payment_blocked',
    risk_level: 'blocked',
    endpoint: 'https://api.example.com/paid',
    network: 'base',
    asset: 'USDC',
    pay_to: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    amount_usd: 100,
    drainer_intel: [{ source: 'scamsniffer', severity: 'critical', scope: 'recipient' }],
    reasoning: 'blocked',
    simulation: { status: 'ok', provider: 'helius' },
    ...overrides,
  }
}

// ============================================================================
// buildReport — pure contract
// ============================================================================

describe('buildReport', () => {
  it('aggregates blocked + approved + confirmation_required totals', async () => {
    const events: AuditEventRow[] = [
      event({ id: 'b1', amount_usd: 100 }),
      event({ id: 'b2', amount_usd: 250 }),
      event({ id: 'a1', event_kind: 'payment_approved', amount_usd: 10 }),
      event({ id: 'c1', event_kind: 'payment_confirmation_required', amount_usd: 50 }),
    ]
    const report = await buildReport({
      events,
      wallet: '0xagent',
      anonymize: false,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.totals.blocked_event_count).toBe(2)
    expect(report.totals.blocked_value_usd).toBe(350)
    expect(report.totals.approved_event_count).toBe(1)
    expect(report.totals.confirmation_required_event_count).toBe(1)
  })

  it('anonymizes wallet + endpoint + pay_to when requested', async () => {
    const report = await buildReport({
      events: [event()],
      wallet: '0xagent',
      anonymize: true,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.agent_id).toMatch(/^agent_[a-f0-9]{8}$/)
    expect(report.anonymized).toBe(true)
    const sample = report.sample_blocked_events[0]!
    expect(sample.pay_to_label).toMatch(/^pay_to_[a-f0-9]{8}$/)
    expect(sample.endpoint_label).toMatch(/^endpoint_[a-f0-9]{8}$/)
  })

  it('keeps raw values when anonymize=false', async () => {
    const report = await buildReport({
      events: [event()],
      wallet: '0xagent',
      anonymize: false,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.agent_id).toBe('0xagent')
    const sample = report.sample_blocked_events[0]!
    expect(sample.endpoint_label).toBe('https://api.example.com/paid')
  })

  it('rolls up drainer_breakdown sorted by blocked value', async () => {
    const events: AuditEventRow[] = [
      event({
        id: 'a',
        amount_usd: 50,
        drainer_intel: [{ source: 'scamsniffer', severity: 'critical', scope: 'recipient' }],
      }),
      event({
        id: 'b',
        amount_usd: 1_000,
        drainer_intel: [{ source: 'goplus', severity: 'high', scope: 'recipient' }],
      }),
      event({
        id: 'c',
        amount_usd: 200,
        drainer_intel: [{ source: 'goplus', severity: 'high', scope: 'recipient' }],
      }),
    ]
    const report = await buildReport({
      events,
      wallet: '0xagent',
      anonymize: false,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.drainer_breakdown).toEqual([
      { source: 'goplus', hit_count: 2, blocked_value_usd: 1_200 },
      { source: 'scamsniffer', hit_count: 1, blocked_value_usd: 50 },
    ])
    expect(report.totals.distinct_drainer_sources).toBe(2)
  })

  it('counts simulation outcomes', async () => {
    const events: AuditEventRow[] = [
      event({ id: 'a', simulation: { status: 'ok' } }),
      event({ id: 'b', simulation: { status: 'suspicious_balance_change' } }),
      event({ id: 'c', simulation: { status: 'suspicious_balance_change' } }),
      event({ id: 'd', simulation: null }),
    ]
    const report = await buildReport({
      events,
      wallet: '0xagent',
      anonymize: false,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.simulation_outcomes).toEqual({
      ok: 1,
      suspicious_balance_change: 2,
    })
  })

  it('caps sample at sample_limit', async () => {
    const events: AuditEventRow[] = Array.from({ length: 50 }, (_, i) => event({ id: `b${i}` }))
    const report = await buildReport({
      events,
      wallet: '0xagent',
      anonymize: false,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.sample_blocked_events).toHaveLength(5)
  })

  it('preserves the schema_version bump indicator', async () => {
    const report = await buildReport({
      events: [],
      wallet: '0xagent',
      anonymize: false,
      sampleLimit: 5,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(report.schema_version).toBe(1)
  })

  it('returns same anonymized hash for the same input (deterministic)', async () => {
    const r1 = await buildReport({
      events: [],
      wallet: '0xagent',
      anonymize: true,
      sampleLimit: 0,
      occurredAfter: null,
      occurredBefore: null,
    })
    const r2 = await buildReport({
      events: [],
      wallet: '0xagent',
      anonymize: true,
      sampleLimit: 0,
      occurredAfter: null,
      occurredBefore: null,
    })
    expect(r1.agent_id).toBe(r2.agent_id)
  })
})

// ============================================================================
// Route — auth + validation
// ============================================================================

const mockState = {
  events: { data: [] as unknown[], error: null as { message?: string } | null },
}

function chain(getList: () => unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'range', 'limit']) {
    c[m] = vi.fn(() => c)
  }
  c.then = (resolve: (v: unknown) => void): void => resolve(getList())
  return c
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => chain(() => mockState.events)),
  })),
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
      json: (d: unknown, s: number) => Response
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
app.route('/clawpay', clawpayCaseStudyRoutes)

describe('GET /clawpay/case-study/export', () => {
  beforeEach(() => {
    mockState.events = { data: [], error: null }
    vi.clearAllMocks()
  })

  it('returns 401 without Bearer', async () => {
    const res = await app.request('/clawpay/case-study/export')
    expect(res.status).toBe(401)
  })

  it('returns 200 with the report shape', async () => {
    mockState.events = { data: [event()], error: null }
    const res = await app.request('/clawpay/case-study/export', {
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      schema_version: number
      anonymized: boolean
      totals: { blocked_event_count: number }
    }
    expect(body.schema_version).toBe(1)
    expect(body.anonymized).toBe(true)
    expect(body.totals.blocked_event_count).toBe(1)
  })

  it('respects ?anonymize=false', async () => {
    mockState.events = { data: [event()], error: null }
    const res = await app.request('/clawpay/case-study/export?anonymize=false', {
      headers: { Authorization: 'Bearer t' },
    })
    const body = (await res.json()) as { anonymized: boolean; agent_id: string }
    expect(body.anonymized).toBe(false)
    expect(body.agent_id).toBe(testWallets.alice)
  })

  it('rejects invalid occurred_after', async () => {
    const res = await app.request('/clawpay/case-study/export?occurred_after=yesterday', {
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(400)
  })

  it('rejects sample_limit > 200', async () => {
    const res = await app.request('/clawpay/case-study/export?sample_limit=5000', {
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(400)
  })

  it('500s on database error', async () => {
    mockState.events = {
      data: [] as unknown as unknown[],
      error: { message: 'db down' },
    }
    const res = await app.request('/clawpay/case-study/export', {
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(500)
  })
})
