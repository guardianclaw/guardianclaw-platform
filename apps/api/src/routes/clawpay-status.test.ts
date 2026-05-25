/**
 * Tests for the public /clawpay/status endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { clawpayStatusRoutes } from './clawpay-status'

const mockState = {
  incidents: { data: [] as unknown[], error: null as { message?: string } | null },
}

function chain(getList: () => unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) c[m] = vi.fn(() => c)
  c.then = (resolve: (v: unknown) => void): void => resolve(getList())
  return c
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => chain(() => mockState.incidents)),
  })),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('../lib/supabase-client', () => ({
  getServiceClient: vi.fn(() => mockSupabase),
}))

const app = new Hono()
app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://t.supabase.co',
    SUPABASE_SERVICE_KEY: 'svc',
  } as never
  await next()
})
app.route('/clawpay', clawpayStatusRoutes)

describe('GET /clawpay/status', () => {
  beforeEach(() => {
    mockState.incidents = { data: [], error: null }
    vi.clearAllMocks()
  })

  it('returns all-operational when there are no unresolved incidents', async () => {
    mockState.incidents = { data: [], error: null }
    const res = await app.request('/clawpay/status')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      operational: boolean
      overall_status: string
      components: Record<string, string>
      incidents: unknown[]
    }
    expect(body.operational).toBe(true)
    expect(body.overall_status).toBe('operational')
    expect(body.components.api).toBe('operational')
    expect(body.components.helius).toBe('operational')
    expect(body.incidents).toHaveLength(0)
  })

  it('does not require auth', async () => {
    const res = await app.request('/clawpay/status')
    expect(res.status).toBe(200)
  })

  it('downgrades a component when an unresolved minor incident affects it', async () => {
    mockState.incidents = {
      data: [
        {
          id: 'inc1',
          title: 'Helius RPC slow',
          description: null,
          severity: 'minor',
          status: 'investigating',
          affected_components: ['helius'],
          started_at: '2026-05-21T12:00:00Z',
          resolved_at: null,
        },
      ],
      error: null,
    }
    const res = await app.request('/clawpay/status')
    const body = (await res.json()) as {
      operational: boolean
      overall_status: string
      components: Record<string, string>
    }
    expect(body.operational).toBe(false)
    expect(body.overall_status).toBe('degraded')
    expect(body.components.helius).toBe('degraded')
    expect(body.components.api).toBe('operational')
  })

  it('flags outage on critical incident', async () => {
    mockState.incidents = {
      data: [
        {
          id: 'inc2',
          title: 'Supabase outage',
          description: null,
          severity: 'critical',
          status: 'investigating',
          affected_components: ['supabase'],
          started_at: '2026-05-21T12:00:00Z',
          resolved_at: null,
        },
      ],
      error: null,
    }
    const res = await app.request('/clawpay/status')
    const body = (await res.json()) as {
      operational: boolean
      overall_status: string
      components: Record<string, string>
    }
    expect(body.operational).toBe(false)
    expect(body.overall_status).toBe('outage')
    expect(body.components.supabase).toBe('outage')
  })

  it('ignores resolved incidents for the components map', async () => {
    mockState.incidents = {
      data: [
        {
          id: 'inc3',
          title: 'Past Tenderly slowness',
          description: null,
          severity: 'major',
          status: 'resolved',
          affected_components: ['tenderly'],
          started_at: '2026-05-20T12:00:00Z',
          resolved_at: '2026-05-20T13:00:00Z',
        },
      ],
      error: null,
    }
    const res = await app.request('/clawpay/status')
    const body = (await res.json()) as {
      operational: boolean
      components: Record<string, string>
      incidents: Array<{ id: string }>
    }
    // Resolved incidents still appear in the history list,
    // but they don't downgrade components.
    expect(body.operational).toBe(true)
    expect(body.components.tenderly).toBe('operational')
    expect(body.incidents).toHaveLength(1)
  })

  it('returns 200 with a warning when the incidents store is unreachable', async () => {
    mockState.incidents = {
      data: [] as unknown as unknown[],
      error: { message: 'db down' },
    }
    const res = await app.request('/clawpay/status')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { warning?: string; operational: boolean }
    expect(body.warning).toBeDefined()
    expect(body.operational).toBe(false)
  })

  it('ignores affected_components values that are not in the known list', async () => {
    mockState.incidents = {
      data: [
        {
          id: 'inc4',
          title: 'mystery component down',
          description: null,
          severity: 'major',
          status: 'investigating',
          affected_components: ['unknown_thing', 'modal'],
          started_at: '2026-05-21T12:00:00Z',
          resolved_at: null,
        },
      ],
      error: null,
    }
    const res = await app.request('/clawpay/status')
    const body = (await res.json()) as {
      components: Record<string, string>
    }
    expect(body.components.modal).toBe('outage')
    // No 'unknown_thing' key is exposed — the response is constrained
    // to the typed component vocabulary.
    expect((body.components as Record<string, string>)['unknown_thing']).toBeUndefined()
  })
})
