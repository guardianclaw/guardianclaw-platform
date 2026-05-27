/**
 * Tests for the Stripe-billing bridge (Sprint 5).
 *
 * Mocks `fetch` to verify outgoing requests carry the right Idempotency-Key
 * and form payload, and `crypto.subtle` to verify webhook signing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  StripeBillingError,
  createInvoiceForPeriod,
  handleStripeWebhookEvent,
  verifyAndParseWebhook,
  type BillingAccountSnapshot,
  type BillingPeriodSnapshot,
  type StripeClientConfig,
} from './clawpay-stripe-billing'

function makePeriod(overrides: Partial<BillingPeriodSnapshot> = {}): BillingPeriodSnapshot {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    wallet_address: '0xagent',
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
    ...overrides,
  }
}

function makeAccount(overrides: Partial<BillingAccountSnapshot> = {}): BillingAccountSnapshot {
  return {
    wallet_address: '0xagent',
    stripe_customer_id: 'cus_test123',
    plan: 'pro',
    ...overrides,
  }
}

const config: StripeClientConfig = {
  apiKey: 'sk_test_xxx',
  webhookSecret: 'whsec_xxx',
  baseUrl: 'https://api.stripe.test/v1',
}

// Helper to create a fake fetch that returns sequential responses.
function queuedFetch(
  responses: Array<{ ok: boolean; status?: number; json?: unknown; text?: string }>
) {
  let i = 0
  return vi.fn(async () => {
    const r = responses[i++]
    if (!r) throw new Error(`unexpected extra fetch call (#${i})`)
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json,
      text: async () => r.text ?? '',
    } as unknown as Response
  })
}

// Minimal Supabase mock recording table+update args.
function makeSupabaseMock() {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = []
  const mock = {
    from: vi.fn((table: string) => ({
      update: vi.fn((values: Record<string, unknown>) => {
        const u: Record<string, unknown> = {}
        for (const m of ['eq', 'neq'])
          u[m] = vi.fn(() => u)
          // Make this thenable to silence Supabase await.
        ;(u as { then?: (r: (v: unknown) => void) => void }).then = (r: (v: unknown) => void) => {
          updates.push({ table, values })
          r({ data: null, error: null })
        }
        return u
      }),
    })),
    updates,
  }
  return mock
}

describe('createInvoiceForPeriod', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects when stripe_invoice_id is missing and period has no customer', async () => {
    const period = makePeriod()
    const account = makeAccount({ stripe_customer_id: null })
    const supabase = makeSupabaseMock()

    await expect(
      createInvoiceForPeriod(supabase as never, config, period, account)
    ).rejects.toMatchObject({ kind: 'missing_customer' })
  })

  it('rejects when total_usd is zero', async () => {
    const period = makePeriod({ total_usd: 0, usage_fee_usd: 0, subscription_fee_usd: 0 })
    const supabase = makeSupabaseMock()
    await expect(
      createInvoiceForPeriod(supabase as never, config, period, makeAccount())
    ).rejects.toMatchObject({ kind: 'nothing_to_bill' })
  })

  it('returns existing invoice and skips creation when already invoiced', async () => {
    const period = makePeriod({ stripe_invoice_id: 'in_test_existing' })

    const fakeFetch = queuedFetch([
      {
        ok: true,
        json: {
          id: 'in_test_existing',
          status: 'open',
          hosted_invoice_url: 'https://stripe.test/in/test',
          amount_due: 10400,
          amount_paid: 0,
          currency: 'usd',
          customer: 'cus_test123',
          metadata: {},
        },
      },
    ])
    vi.stubGlobal('fetch', fakeFetch)

    const result = await createInvoiceForPeriod(
      makeSupabaseMock() as never,
      config,
      period,
      makeAccount()
    )
    expect(result.idempotent).toBe(true)
    expect(result.invoice.id).toBe('in_test_existing')
    expect(fakeFetch).toHaveBeenCalledTimes(1)
  })

  it('creates subscription + usage line items, then invoice, with idempotency keys', async () => {
    const period = makePeriod()

    const fakeFetch = queuedFetch([
      // POST /v1/invoiceitems  (subscription)
      { ok: true, json: { id: 'ii_sub' } },
      // POST /v1/invoiceitems  (usage)
      { ok: true, json: { id: 'ii_usage' } },
      // POST /v1/invoices
      {
        ok: true,
        json: {
          id: 'in_test_new',
          status: 'open',
          hosted_invoice_url: 'https://stripe.test/in/new',
          amount_due: 10_400,
          amount_paid: 0,
          currency: 'usd',
          customer: 'cus_test123',
          metadata: { billing_period_id: period.id },
        },
      },
    ])
    vi.stubGlobal('fetch', fakeFetch)

    const supabase = makeSupabaseMock()
    const result = await createInvoiceForPeriod(supabase as never, config, period, makeAccount())

    expect(result.idempotent).toBe(false)
    expect(result.invoice.id).toBe('in_test_new')

    // Three fetches, in order.
    expect(fakeFetch).toHaveBeenCalledTimes(3)
    const subCall = fakeFetch.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> }
    const usageCall = fakeFetch.mock.calls[1]![1] as RequestInit & {
      headers: Record<string, string>
    }
    const invoiceCall = fakeFetch.mock.calls[2]![1] as RequestInit & {
      headers: Record<string, string>
    }

    expect(subCall.headers['Idempotency-Key']).toBe(`${period.id}:subscription`)
    expect(usageCall.headers['Idempotency-Key']).toBe(`${period.id}:usage`)
    expect(invoiceCall.headers['Idempotency-Key']).toBe(`${period.id}:invoice`)

    // Subscription amount in cents.
    const subBody = subCall.body as string
    expect(subBody).toContain('amount=9900') // $99.00 -> 9900 cents
    // Usage amount in cents.
    const usageBody = usageCall.body as string
    expect(usageBody).toContain('amount=500') // $5.00 -> 500 cents

    // Persisted period update with invoice id.
    expect(supabase.updates).toEqual([
      {
        table: 'clawpay_billing_periods',
        values: expect.objectContaining({
          status: 'invoiced',
          stripe_invoice_id: 'in_test_new',
        }),
      },
    ])
  })

  it('skips subscription line when subscription_fee_usd is 0', async () => {
    const period = makePeriod({ subscription_fee_usd: 0, total_usd: 5 })

    const fakeFetch = queuedFetch([
      // Only usage + invoice; no subscription line.
      { ok: true, json: { id: 'ii_usage' } },
      {
        ok: true,
        json: {
          id: 'in_x',
          status: 'open',
          hosted_invoice_url: null,
          amount_due: 500,
          amount_paid: 0,
          currency: 'usd',
          customer: 'cus_test123',
          metadata: {},
        },
      },
    ])
    vi.stubGlobal('fetch', fakeFetch)

    await createInvoiceForPeriod(makeSupabaseMock() as never, config, period, makeAccount())
    expect(fakeFetch).toHaveBeenCalledTimes(2)
  })

  it('throws StripeBillingError on Stripe HTTP error', async () => {
    const period = makePeriod()
    const fakeFetch = queuedFetch([{ ok: false, status: 402, text: '{"error":"card_declined"}' }])
    vi.stubGlobal('fetch', fakeFetch)

    await expect(
      createInvoiceForPeriod(makeSupabaseMock() as never, config, period, makeAccount())
    ).rejects.toMatchObject({ kind: 'stripe_request_failed', status: 402 })
  })
})

describe('verifyAndParseWebhook', () => {
  // A minimal helper to mint a valid signature for a given body+secret+ts.
  async function sign(secret: string, ts: number, body: string): Promise<string> {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${body}`))
    const bytes = new Uint8Array(sig)
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]!
      hex += b.toString(16).padStart(2, '0')
    }
    return `t=${ts},v1=${hex}`
  }

  it('parses a valid signed payload', async () => {
    const body = JSON.stringify({ id: 'evt_x', type: 'invoice.paid', data: { object: {} } })
    const ts = Math.floor(Date.now() / 1000)
    const header = await sign('whsec_test', ts, body)

    const event = await verifyAndParseWebhook(body, header, 'whsec_test')
    expect(event.id).toBe('evt_x')
    expect(event.type).toBe('invoice.paid')
  })

  it('rejects missing signature header', async () => {
    await expect(verifyAndParseWebhook('{}', null, 'whsec_test')).rejects.toMatchObject({
      kind: 'stripe_request_failed',
    })
  })

  it('rejects malformed signature header', async () => {
    await expect(
      verifyAndParseWebhook('{}', 'definitely-not-a-stripe-sig', 'whsec_test')
    ).rejects.toMatchObject({ kind: 'stripe_request_failed' })
  })

  it('rejects timestamp outside tolerance', async () => {
    const body = '{}'
    const oldTs = Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
    const header = await sign('whsec_test', oldTs, body)
    await expect(verifyAndParseWebhook(body, header, 'whsec_test')).rejects.toMatchObject({
      kind: 'stripe_request_failed',
    })
  })

  it('rejects bad signature', async () => {
    const ts = Math.floor(Date.now() / 1000)
    // Sign with wrong secret.
    const header = await sign('whsec_OTHER', ts, '{}')
    await expect(verifyAndParseWebhook('{}', header, 'whsec_test')).rejects.toMatchObject({
      kind: 'stripe_request_failed',
    })
  })
})

describe('handleStripeWebhookEvent', () => {
  function eventOf(
    type: string,
    metadata: Record<string, string> = {}
  ): {
    id: string
    type: string
    data: { object: Record<string, unknown> }
  } {
    return {
      id: 'evt_x',
      type,
      data: { object: { id: 'in_test', metadata } },
    }
  }

  it('marks period paid on invoice.paid', async () => {
    const supabase = makeSupabaseMock()
    const out = await handleStripeWebhookEvent(
      supabase as never,
      eventOf('invoice.paid', { billing_period_id: 'p1' })
    )
    expect(out.handled).toBe(true)
    expect(out.period_id).toBe('p1')
    expect(supabase.updates[0]?.values).toMatchObject({ status: 'paid' })
  })

  it('marks period failed on invoice.payment_failed', async () => {
    const supabase = makeSupabaseMock()
    const out = await handleStripeWebhookEvent(
      supabase as never,
      eventOf('invoice.payment_failed', { billing_period_id: 'p2' })
    )
    expect(out.handled).toBe(true)
    expect(supabase.updates[0]?.values).toMatchObject({
      status: 'failed',
      failure_reason: 'invoice.payment_failed',
    })
  })

  it('ignores unrelated events', async () => {
    const supabase = makeSupabaseMock()
    const out = await handleStripeWebhookEvent(supabase as never, eventOf('customer.created'))
    expect(out.handled).toBe(false)
    expect(supabase.updates).toHaveLength(0)
  })

  it('ignores events without billing_period_id metadata', async () => {
    const supabase = makeSupabaseMock()
    const out = await handleStripeWebhookEvent(supabase as never, eventOf('invoice.paid'))
    expect(out.handled).toBe(false)
  })
})

describe('StripeBillingError', () => {
  it('preserves kind and details', () => {
    const err = new StripeBillingError('missing_customer', 'no customer', 409, { foo: 'bar' })
    expect(err.kind).toBe('missing_customer')
    expect(err.status).toBe(409)
    expect(err.details).toEqual({ foo: 'bar' })
  })
})
