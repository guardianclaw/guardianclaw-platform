/**
 * Tests for clawpay-beta routes (Sprint 6).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { clawpayBetaPublicRoutes, clawpayBetaRoutes } from './clawpay-beta'
import { testWallets } from '../test/fixtures/index'

interface PgError {
  message?: string
  code?: string
}

const mockState = {
  inviteLookup: { data: null as unknown, error: null as PgError | null },
  subscription: { data: null as unknown, error: null as PgError | null },
  updateResult: { data: null as unknown, error: null as PgError | null },
  insertResult: { data: null as unknown, error: null as PgError | null },
  rpc: { data: null as unknown, error: null as PgError | null },
  inserts: [] as Array<{ table: string; row: unknown }>,
  updates: [] as Array<{ table: string; values: Record<string, unknown> }>,
}

function resetState(): void {
  mockState.inviteLookup = { data: null, error: null }
  mockState.subscription = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.rpc = { data: null, error: null }
  mockState.inserts = []
  mockState.updates = []
}

function chain(
  getList: () => { data?: unknown; error?: PgError | null; count?: number | null },
  getOne: () => { data?: unknown; error?: PgError | null }
) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'order', 'range', 'limit']) c[m] = vi.fn(() => c)
  c.single = vi.fn(() => Promise.resolve(getOne()))
  c.maybeSingle = vi.fn(() => Promise.resolve(getOne()))
  c.then = (resolve: (v: unknown) => void): void => resolve(getList())
  return c
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'clawpay_beta_invites') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.inviteLookup,
            () => mockState.inviteLookup
          )
        ),
      }
    }
    if (table === 'clawpay_email_subscriptions') {
      return {
        select: vi.fn(() =>
          chain(
            () => mockState.subscription,
            () => mockState.subscription
          )
        ),
        insert: vi.fn((row: Record<string, unknown>) => {
          mockState.inserts.push({ table, row })
          return {
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(mockState.insertResult)),
              maybeSingle: vi.fn(() => Promise.resolve(mockState.insertResult)),
            })),
          }
        }),
        update: vi.fn((values: Record<string, unknown>) => {
          const u: Record<string, unknown> = {}
          for (const m of ['eq', 'neq']) u[m] = vi.fn(() => u)
          u.select = vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.updateResult)),
            maybeSingle: vi.fn(() => Promise.resolve(mockState.updateResult)),
          }))
          mockState.updates.push({ table, values })
          return u
        }),
      }
    }
    if (table === 'clawpay_email_deliveries') {
      return {
        insert: vi.fn((row: Record<string, unknown>) => {
          const r: Record<string, unknown> = {}
          ;(r as { then?: (resolve: (v: unknown) => void) => void }).then = (
            resolve: (v: unknown) => void
          ) => {
            mockState.inserts.push({ table, row })
            resolve({ error: null })
          }
          return r
        }),
      }
    }
    return {
      select: vi.fn(() =>
        chain(
          () => ({ data: [] }),
          () => ({ data: null })
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
    // No RESEND_API_KEY → service falls back to InMemory.
    CLAWPAY_DASHBOARD_URL: 'https://dash.test/app/clawpay',
  } as never
  await next()
})
app.route('/clawpay', clawpayBetaPublicRoutes)
app.route('/clawpay', clawpayBetaRoutes)

// ============================================================================
// Public — invite check
// ============================================================================

describe('GET /clawpay/beta/invites/:code (public)', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  it('returns valid=true for a fresh code', async () => {
    mockState.inviteLookup = {
      data: {
        code: 'BETA1234',
        max_uses: 100,
        used_count: 1,
        expires_at: null,
        metadata: { campaign: 'coinbase-devs' },
      },
      error: null,
    }
    const res = await app.request('/clawpay/beta/invites/BETA1234')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { valid: boolean; remaining_uses: number; metadata: unknown }
    expect(body.valid).toBe(true)
    expect(body.remaining_uses).toBe(99)
    expect(body.metadata).toEqual({ campaign: 'coinbase-devs' })
  })

  it('rejects malformed codes with 400', async () => {
    const res = await app.request('/clawpay/beta/invites/ab')
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown codes', async () => {
    mockState.inviteLookup = { data: null, error: null }
    const res = await app.request('/clawpay/beta/invites/UNKNOWN1234')
    expect(res.status).toBe(404)
    const body = (await res.json()) as { valid: boolean; reason: string }
    expect(body.valid).toBe(false)
    expect(body.reason).toBe('unknown_code')
  })

  it('flags expired codes', async () => {
    mockState.inviteLookup = {
      data: {
        code: 'EXP12345',
        max_uses: 10,
        used_count: 0,
        expires_at: '2020-01-01T00:00:00Z',
        metadata: {},
      },
      error: null,
    }
    const res = await app.request('/clawpay/beta/invites/EXP12345')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { valid: boolean; reason?: string }
    expect(body.valid).toBe(false)
    expect(body.reason).toBe('expired')
  })

  it('flags exhausted codes', async () => {
    mockState.inviteLookup = {
      data: {
        code: 'EXH12345',
        max_uses: 1,
        used_count: 1,
        expires_at: null,
        metadata: {},
      },
      error: null,
    }
    const res = await app.request('/clawpay/beta/invites/EXH12345')
    const body = (await res.json()) as { valid: boolean; reason?: string }
    expect(body.valid).toBe(false)
    expect(body.reason).toBe('exhausted')
  })

  it('500s on database error', async () => {
    mockState.inviteLookup = { data: null, error: { message: 'db down' } }
    const res = await app.request('/clawpay/beta/invites/CODE1234')
    expect(res.status).toBe(500)
  })
})

// ============================================================================
// Authenticated — redeem + notifications
// ============================================================================

describe('POST /clawpay/beta/invites/:code/redeem', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  it('returns 401 without Bearer', async () => {
    const res = await app.request('/clawpay/beta/invites/CODE1234/redeem', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('redeems a fresh code', async () => {
    mockState.rpc = {
      data: {
        success: true,
        idempotent: false,
        code: 'CODE1234',
        wallet_address: testWallets.alice,
        redeemed_at: '2026-05-21T12:00:00Z',
        metadata: { campaign: 'coinbase-devs' },
      },
      error: null,
    }
    const res = await app.request('/clawpay/beta/invites/CODE1234/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { redeemed: boolean; idempotent: boolean }
    expect(body.redeemed).toBe(true)
    expect(body.idempotent).toBe(false)
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'redeem_clawpay_beta_invite',
      expect.objectContaining({ p_code: 'CODE1234', p_wallet: testWallets.alice })
    )
  })

  it('reports 404 on unknown_code', async () => {
    mockState.rpc = { data: { success: false, error: 'unknown_code' }, error: null }
    const res = await app.request('/clawpay/beta/invites/UNKNOWN1234/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(404)
  })

  it('reports 410 (gone) on expired / exhausted', async () => {
    mockState.rpc = { data: { success: false, error: 'expired' }, error: null }
    const res1 = await app.request('/clawpay/beta/invites/EXPIRED1234/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res1.status).toBe(410)

    mockState.rpc = { data: { success: false, error: 'exhausted' }, error: null }
    const res2 = await app.request('/clawpay/beta/invites/EXHAUSTED1234/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res2.status).toBe(410)
  })

  it('reports idempotent re-redeem with the original timestamp', async () => {
    mockState.rpc = {
      data: {
        success: true,
        idempotent: true,
        code: 'CODE1234',
        wallet_address: testWallets.alice,
        redeemed_at: '2026-05-21T12:00:00Z',
        metadata: {},
      },
      error: null,
    }
    const res = await app.request('/clawpay/beta/invites/CODE1234/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { redeemed: boolean; idempotent: boolean }
    expect(body.idempotent).toBe(true)
  })

  it('rejects malformed codes with 400', async () => {
    const res = await app.request('/clawpay/beta/invites/ab/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(400)
  })

  it('500s on rpc error', async () => {
    mockState.rpc = { data: null, error: { message: 'rpc raised' } }
    const res = await app.request('/clawpay/beta/invites/CODE1234/redeem', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(500)
  })
})

describe('GET /clawpay/notifications/preferences', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  it('returns synthetic defaults when no row exists', async () => {
    mockState.subscription = { data: null, error: null }
    const res = await app.request('/clawpay/notifications/preferences', {
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      configured: boolean
      subscription: { preferences: Record<string, boolean>; email: string | null }
    }
    expect(body.configured).toBe(false)
    expect(body.subscription.preferences.welcome).toBe(true)
    expect(body.subscription.email).toBeNull()
  })

  it('returns the stored row when present', async () => {
    mockState.subscription = {
      data: {
        wallet_address: testWallets.alice,
        email: 'user@example.com',
        preferences: { welcome: true, period_close: false },
        unsubscribed_at: null,
      },
      error: null,
    }
    const res = await app.request('/clawpay/notifications/preferences', {
      headers: { Authorization: 'Bearer t' },
    })
    const body = (await res.json()) as { configured: boolean; subscription: { email: string } }
    expect(body.configured).toBe(true)
    expect(body.subscription.email).toBe('user@example.com')
  })
})

describe('PATCH /clawpay/notifications/preferences', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  it('rejects body with no fields', async () => {
    const res = await app.request('/clawpay/notifications/preferences', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(400)
  })

  it('rejects unknown preference keys', async () => {
    const res = await app.request('/clawpay/notifications/preferences', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { not_a_real_channel: true } }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects invalid email', async () => {
    const res = await app.request('/clawpay/notifications/preferences', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    })
    expect(res.status).toBe(400)
  })

  it('inserts when no row exists', async () => {
    mockState.subscription = { data: null, error: null }
    mockState.insertResult = {
      data: {
        wallet_address: testWallets.alice,
        email: 'user@example.com',
        preferences: { welcome: true },
        unsubscribed_at: null,
      },
      error: null,
    }
    const res = await app.request('/clawpay/notifications/preferences', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    })
    expect(res.status).toBe(201)
  })

  it('merges preferences on update', async () => {
    mockState.subscription = {
      data: {
        wallet_address: testWallets.alice,
        email: 'user@example.com',
        preferences: { welcome: true, period_close: true },
        unsubscribed_at: null,
      },
      error: null,
    }
    mockState.updateResult = {
      data: {
        wallet_address: testWallets.alice,
        email: 'user@example.com',
        preferences: { welcome: true, period_close: true, alerts_summary_daily: true },
        unsubscribed_at: null,
      },
      error: null,
    }
    const res = await app.request('/clawpay/notifications/preferences', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { alerts_summary_daily: true } }),
    })
    expect(res.status).toBe(200)
    const updateCall = mockState.updates.find((u) => u.table === 'clawpay_email_subscriptions')
    expect(updateCall?.values.preferences).toMatchObject({
      welcome: true,
      period_close: true,
      alerts_summary_daily: true,
    })
  })

  it('sets unsubscribed_at when unsubscribed=true', async () => {
    mockState.subscription = {
      data: {
        wallet_address: testWallets.alice,
        email: 'user@example.com',
        preferences: { welcome: true },
        unsubscribed_at: null,
      },
      error: null,
    }
    mockState.updateResult = { data: { wallet_address: testWallets.alice }, error: null }
    const res = await app.request('/clawpay/notifications/preferences', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ unsubscribed: true }),
    })
    expect(res.status).toBe(200)
    const updateCall = mockState.updates.find((u) => u.table === 'clawpay_email_subscriptions')
    expect(updateCall?.values.unsubscribed_at).toBeTypeOf('string')
  })
})

describe('POST /clawpay/notifications/test', () => {
  beforeEach(() => {
    resetState()
    vi.clearAllMocks()
  })

  it('returns 422 when no email is on file', async () => {
    mockState.subscription = {
      data: {
        wallet_address: testWallets.alice,
        email: null,
        preferences: {},
        unsubscribed_at: null,
      },
      error: null,
    }
    const res = await app.request('/clawpay/notifications/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(422)
  })

  it('returns 200 with delivered=true via the in-memory provider', async () => {
    mockState.subscription = {
      data: {
        wallet_address: testWallets.alice,
        email: 'user@example.com',
        preferences: { welcome: true },
        unsubscribed_at: null,
      },
      error: null,
    }
    const res = await app.request('/clawpay/notifications/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { delivered: boolean; provider: string }
    expect(body.delivered).toBe(true)
    expect(body.provider).toBe('in_memory')
  })
})
