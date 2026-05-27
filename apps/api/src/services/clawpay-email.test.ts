/**
 * Tests for clawpay-email service (Sprint 6).
 *
 * Covers:
 *   - InMemoryEmailProvider records outbox + override behavior
 *   - ResendEmailProvider POST shape, idempotency header, error mapping
 *   - Template renderer outputs subject + html + text for every template
 *   - sendClawpayEmail honors preferences, unsubscribe, missing email,
 *     transactional_critical override, idempotency key plumbing
 *   - Delivery rows persisted in clawpay_email_deliveries
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EmailSendError,
  InMemoryEmailProvider,
  ResendEmailProvider,
  getTemplatePreferenceKey,
  isTemplateTransactionalCritical,
  renderTemplate,
  sendClawpayEmail,
  type EmailServiceContext,
  type EmailTemplate,
} from './clawpay-email'

const ALL_TEMPLATES: EmailTemplate[] = [
  'welcome',
  'beta_invite_redeemed',
  'period_closed',
  'alerts_summary_daily',
  'alerts_critical',
]

interface PgError {
  message?: string
}

function makeSupabaseMock() {
  const inserts: Array<Record<string, unknown>> = []
  const state = {
    subscription: { data: null as unknown, error: null as PgError | null },
  }
  const mock = {
    inserts,
    state,
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const c: Record<string, unknown> = {}
        for (const m of ['eq', 'neq', 'order', 'limit']) c[m] = vi.fn(() => c)
        c.maybeSingle = vi.fn(() => Promise.resolve(state.subscription))
        c.then = (r: (v: unknown) => void): void => r(state.subscription)
        return c
      }),
      insert: vi.fn((row: Record<string, unknown>) => {
        const r: Record<string, unknown> = {}
        ;(r as { then?: (resolve: (v: unknown) => void) => void }).then = (
          resolve: (v: unknown) => void
        ) => {
          inserts.push({ table, ...row })
          resolve({ error: null })
        }
        return r
      }),
    })),
  }
  return mock
}

// ============================================================================
// InMemoryEmailProvider
// ============================================================================

describe('InMemoryEmailProvider', () => {
  it('captures messages and reports sent by default', async () => {
    const p = new InMemoryEmailProvider()
    const result = await p.send({
      to: 'a@example.com',
      subject: 'x',
      html: '<p>x</p>',
      text: 'x',
    })
    expect(result.status).toBe('sent')
    expect(result.providerMessageId).toBeDefined()
    expect(p.outbox).toHaveLength(1)
  })

  it('returns the override result when set', async () => {
    const p = new InMemoryEmailProvider()
    p.override_ = { status: 'failed', error: 'forced' }
    const result = await p.send({ to: 'a@x', subject: '', html: '', text: '' })
    expect(result.status).toBe('failed')
    expect(result.error).toBe('forced')
  })
})

// ============================================================================
// ResendEmailProvider
// ============================================================================

describe('ResendEmailProvider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs to /emails with Bearer + Idempotency-Key', async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_abc' }), { status: 200 }))
    vi.stubGlobal('fetch', fake)

    const provider = new ResendEmailProvider({
      apiKey: 're_test',
      defaultFrom: 'ClawPay <hello@guardianclaw.org>',
      baseUrl: 'https://api.resend.test',
    })
    const result = await provider.send({
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      idempotencyKey: 'idem-1',
      tags: { template: 'welcome' },
    })

    expect(result.status).toBe('sent')
    expect(result.providerMessageId).toBe('msg_abc')
    expect(fake).toHaveBeenCalledTimes(1)
    const [url, init] = fake.mock.calls[0]!
    expect(url).toBe('https://api.resend.test/emails')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer re_test')
    expect(headers['Idempotency-Key']).toBe('idem-1')
    const body = JSON.parse((init as RequestInit).body as string) as {
      from: string
      to: string[]
      tags: { name: string; value: string }[]
    }
    expect(body.from).toContain('ClawPay')
    expect(body.to).toEqual(['user@example.com'])
    expect(body.tags).toEqual([{ name: 'template', value: 'welcome' }])
  })

  it('maps 4xx to rejected, 5xx to failed', async () => {
    const responses = [
      new Response('{"error":"invalid"}', { status: 422 }),
      new Response('upstream down', { status: 503 }),
    ]
    let i = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responses[i++]!)
    )
    const provider = new ResendEmailProvider({
      apiKey: 're_test',
      defaultFrom: 'x',
      baseUrl: 'https://api.resend.test',
    })
    const r1 = await provider.send({ to: 'a@x', subject: '', html: '', text: '' })
    expect(r1.status).toBe('rejected')
    const r2 = await provider.send({ to: 'a@x', subject: '', html: '', text: '' })
    expect(r2.status).toBe('failed')
  })

  it('maps fetch exception to failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network down')
      })
    )
    const provider = new ResendEmailProvider({
      apiKey: 're_test',
      defaultFrom: 'x',
      baseUrl: 'https://api.resend.test',
    })
    const result = await provider.send({ to: 'a@x', subject: '', html: '', text: '' })
    expect(result.status).toBe('failed')
    expect(result.error).toContain('Network down')
  })
})

// ============================================================================
// Template registry + renderers
// ============================================================================

describe('template registry', () => {
  it('exposes preferenceKey for every template', () => {
    for (const t of ALL_TEMPLATES) {
      expect(getTemplatePreferenceKey(t)).toBeTruthy()
    }
  })

  it('marks alerts_summary_daily as non-critical, others as critical', () => {
    expect(isTemplateTransactionalCritical('alerts_summary_daily')).toBe(false)
    for (const t of ALL_TEMPLATES.filter((x) => x !== 'alerts_summary_daily')) {
      expect(isTemplateTransactionalCritical(t)).toBe(true)
    }
  })
})

describe('renderTemplate', () => {
  it('renders welcome with subject + html + text', () => {
    const r = renderTemplate('welcome', {
      walletAddress: '0xagent',
      dashboardUrl: 'https://dash/x',
    })
    expect(r.subject).toContain('ClawPay')
    expect(r.html).toContain('Open the dashboard')
    expect(r.html).toContain('https://dash/x')
    expect(r.text).toContain('https://dash/x')
  })

  it('escapes HTML in user-controlled fields', () => {
    const r = renderTemplate('beta_invite_redeemed', {
      walletAddress: '<script>alert(1)</script>',
      code: '<img src=x>',
      dashboardUrl: 'https://dash',
    })
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).toContain('&lt;img')
  })

  it('formats USD amounts in period_closed', () => {
    const r = renderTemplate('period_closed', {
      walletAddress: '0xagent',
      periodStart: '2026-05-01T00:00:00Z',
      periodEnd: '2026-06-01T00:00:00Z',
      blockedValueUsd: 12_000,
      blockedEventCount: 8,
      usageFeeUsd: 60,
      subscriptionFeeUsd: 99,
      totalUsd: 159,
      dashboardUrl: 'https://dash',
    })
    expect(r.html).toContain('$12,000.00')
    expect(r.html).toContain('$159.00')
    expect(r.subject).toContain('$159.00')
  })

  it('renders alerts_critical with the reason', () => {
    const r = renderTemplate('alerts_critical', {
      walletAddress: '0xagent',
      alertName: 'High-value blocks',
      triggeredAt: '2026-05-21T12:00:00Z',
      reason: 'drainer match severity=critical',
      dashboardUrl: 'https://dash',
    })
    expect(r.html).toContain('High-value blocks')
    expect(r.html).toContain('drainer match severity')
  })

  it('renders alerts_summary_daily', () => {
    const r = renderTemplate('alerts_summary_daily', {
      walletAddress: '0xagent',
      periodLabel: 'May 21, 2026',
      dashboardUrl: 'https://dash',
    })
    expect(r.subject).toContain('May 21, 2026')
    expect(r.html).toContain('digest')
  })
})

// ============================================================================
// sendClawpayEmail orchestration
// ============================================================================

function makeCtx(): EmailServiceContext & {
  outbox: InMemoryEmailProvider['outbox']
  inserts: ReturnType<typeof makeSupabaseMock>['inserts']
  supabaseMock: ReturnType<typeof makeSupabaseMock>
} {
  const provider = new InMemoryEmailProvider()
  const supabase = makeSupabaseMock()
  return {
    provider,
    supabase: supabase as never,
    dashboardBaseUrl: 'https://dash.example/app/clawpay',
    outbox: provider.outbox,
    inserts: supabase.inserts,
    supabaseMock: supabase,
  }
}

describe('sendClawpayEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a welcome email using the explicit `to` override', async () => {
    const ctx = makeCtx()
    const out = await sendClawpayEmail(ctx, {
      template: 'welcome',
      to: 'user@example.com',
      walletAddress: '0xagent',
      context: { walletAddress: '0xagent', dashboardUrl: 'https://dash/x' },
    })
    expect(out.delivered).toBe(true)
    expect(out.providerMessageId).toBeDefined()
    expect(ctx.outbox).toHaveLength(1)
    expect(ctx.outbox[0]!.to).toBe('user@example.com')

    expect(ctx.inserts).toHaveLength(1)
    expect(ctx.inserts[0]).toMatchObject({
      table: 'clawpay_email_deliveries',
      to_email: 'user@example.com',
      template: 'welcome',
      provider: 'in_memory',
      status: 'sent',
    })
  })

  it('looks up the recipient from the subscription row when `to` is omitted', async () => {
    const ctx = makeCtx()
    ctx.supabaseMock.state.subscription = {
      data: {
        wallet_address: '0xagent',
        email: 'user@example.com',
        preferences: { welcome: true },
        unsubscribed_at: null,
      },
      error: null,
    }
    const out = await sendClawpayEmail(ctx, {
      template: 'welcome',
      walletAddress: '0xagent',
      context: { walletAddress: '0xagent', dashboardUrl: 'https://dash/x' },
    })
    expect(out.delivered).toBe(true)
    expect(ctx.outbox[0]!.to).toBe('user@example.com')
  })

  it('reports no_email_on_file when neither override nor subscription has an email', async () => {
    const ctx = makeCtx()
    ctx.supabaseMock.state.subscription = {
      data: {
        wallet_address: '0xagent',
        email: null,
        preferences: {},
        unsubscribed_at: null,
      },
      error: null,
    }
    const out = await sendClawpayEmail(ctx, {
      template: 'welcome',
      walletAddress: '0xagent',
      context: { walletAddress: '0xagent', dashboardUrl: 'https://dash/x' },
    })
    expect(out.delivered).toBe(false)
    expect(out.reason).toBe('no_email_on_file')
    expect(ctx.inserts[0]).toMatchObject({
      status: 'rejected',
      error_excerpt: 'no email on file',
    })
  })

  it('skips non-critical templates when the user is unsubscribed', async () => {
    const ctx = makeCtx()
    ctx.supabaseMock.state.subscription = {
      data: {
        wallet_address: '0xagent',
        email: 'user@example.com',
        preferences: { alerts_summary_daily: true },
        unsubscribed_at: '2026-05-20T00:00:00Z',
      },
      error: null,
    }
    const out = await sendClawpayEmail(ctx, {
      template: 'alerts_summary_daily',
      walletAddress: '0xagent',
      context: {
        walletAddress: '0xagent',
        periodLabel: 'today',
        dashboardUrl: 'https://dash',
      },
    })
    expect(out.delivered).toBe(false)
    expect(out.reason).toBe('skipped_unsubscribed')
    expect(ctx.outbox).toHaveLength(0)
  })

  it('sends transactional_critical emails even when unsubscribed', async () => {
    const ctx = makeCtx()
    ctx.supabaseMock.state.subscription = {
      data: {
        wallet_address: '0xagent',
        email: 'user@example.com',
        preferences: { welcome: false },
        unsubscribed_at: '2026-05-20T00:00:00Z',
      },
      error: null,
    }
    const out = await sendClawpayEmail(ctx, {
      template: 'period_closed',
      walletAddress: '0xagent',
      context: {
        walletAddress: '0xagent',
        periodStart: '2026-05-01',
        periodEnd: '2026-06-01',
        blockedValueUsd: 100,
        blockedEventCount: 1,
        usageFeeUsd: 0.5,
        subscriptionFeeUsd: 99,
        totalUsd: 99.5,
        dashboardUrl: 'https://dash',
      },
    })
    expect(out.delivered).toBe(true)
    expect(ctx.outbox).toHaveLength(1)
  })

  it('respects per-channel preferences for non-critical templates', async () => {
    const ctx = makeCtx()
    ctx.supabaseMock.state.subscription = {
      data: {
        wallet_address: '0xagent',
        email: 'user@example.com',
        preferences: { alerts_summary_daily: false },
        unsubscribed_at: null,
      },
      error: null,
    }
    const out = await sendClawpayEmail(ctx, {
      template: 'alerts_summary_daily',
      walletAddress: '0xagent',
      context: {
        walletAddress: '0xagent',
        periodLabel: 'today',
        dashboardUrl: 'https://dash',
      },
    })
    expect(out.delivered).toBe(false)
    expect(out.reason).toBe('skipped_preference')
  })

  it('propagates the idempotency key into the provider call and the audit row', async () => {
    const ctx = makeCtx()
    await sendClawpayEmail(ctx, {
      template: 'welcome',
      to: 'user@example.com',
      walletAddress: '0xagent',
      idempotencyKey: 'welcome-0xagent',
      context: { walletAddress: '0xagent', dashboardUrl: 'https://dash/x' },
    })
    expect(ctx.outbox[0]!.idempotencyKey).toBe('welcome-0xagent')
    expect(ctx.inserts[0]!).toMatchObject({
      idempotency_key: 'welcome-0xagent',
    })
  })

  it('reports `failed` when the provider returns failed', async () => {
    const ctx = makeCtx()
    ;(ctx.provider as InMemoryEmailProvider).override_ = {
      status: 'failed',
      error: 'simulated outage',
    }
    const out = await sendClawpayEmail(ctx, {
      template: 'welcome',
      to: 'user@example.com',
      context: { walletAddress: '0xagent', dashboardUrl: 'https://dash/x' },
    })
    expect(out.delivered).toBe(false)
    expect(out.reason).toBe('failed')
    expect(out.error).toBe('simulated outage')
    expect(ctx.inserts[0]).toMatchObject({
      status: 'failed',
      error_excerpt: 'simulated outage',
    })
  })

  it('raises EmailSendError when the subscription lookup itself errors', async () => {
    const ctx = makeCtx()
    ctx.supabaseMock.state.subscription = {
      data: null,
      error: { message: 'db down' },
    }
    await expect(
      sendClawpayEmail(ctx, {
        template: 'welcome',
        walletAddress: '0xagent',
        context: { walletAddress: '0xagent', dashboardUrl: 'https://dash' },
      })
    ).rejects.toBeInstanceOf(EmailSendError)
  })
})
