/**
 * ClawPay → Stripe invoicing bridge (Sprint 5).
 *
 * Two surfaces:
 *  1. `createInvoiceForPeriod` — given a closed billing_period, emits a
 *     Stripe invoice with one InvoiceItem per line (subscription fee +
 *     usage fee). Idempotent via Stripe's `Idempotency-Key` header (we
 *     use the period_id), so a retry after a network blip never produces
 *     a second invoice.
 *  2. `handleStripeWebhookEvent` — verifies the Stripe signature, then
 *     dispatches `invoice.paid` / `invoice.payment_failed` to the
 *     billing_periods row keyed by the stored `stripe_invoice_id`.
 *
 * We deliberately do NOT depend on the official `stripe-node` SDK from
 * inside Cloudflare Workers — the lib's Node-specific build has nuances
 * with Workers' fetch. Instead we hit Stripe's REST endpoints directly
 * via `fetch` and verify webhooks with our own HMAC-SHA256 routine. This
 * keeps the worker image small and avoids the "stripe-node uses Node
 * crypto" footgun.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Stripe-side types — only the fields we use, not the full schema.
// ============================================================================

export interface StripeClientConfig {
  /** Stripe secret key (rk_* recommended). */
  apiKey: string
  /** Webhook signing secret (whsec_*). */
  webhookSecret: string
  /** Optional override — used in tests so we never accidentally hit live Stripe. */
  baseUrl?: string
  /** Total HTTP timeout per Stripe call. */
  timeoutMs?: number
}

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

export interface StripeInvoice {
  id: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  hosted_invoice_url: string | null
  amount_due: number
  amount_paid: number
  currency: string
  customer: string
  metadata: Record<string, string>
}

export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

// ============================================================================
// Period → Stripe invoice
// ============================================================================

export interface BillingPeriodSnapshot {
  id: string
  wallet_address: string
  period_start: string
  period_end: string
  status: string
  blocked_value_usd: number
  usage_fee_usd: number
  subscription_fee_usd: number
  total_usd: number
  blocked_event_count: number
  fee_bps_snapshot: number
  plan_snapshot: string
  stripe_invoice_id: string | null
}

export interface BillingAccountSnapshot {
  wallet_address: string
  stripe_customer_id: string | null
  plan: string
}

export interface CreateInvoiceResult {
  invoice: StripeInvoice
  /** True when the call short-circuited because the period was already invoiced. */
  idempotent: boolean
}

export class StripeBillingError extends Error {
  constructor(
    public readonly kind:
      | 'missing_customer'
      | 'already_invoiced'
      | 'stripe_request_failed'
      | 'nothing_to_bill',
    message: string,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'StripeBillingError'
  }
}

/**
 * Idempotently create a Stripe invoice for a closed billing period.
 *
 * Side effects, in order:
 *  1. Skip if the period.stripe_invoice_id is already set (idempotent).
 *  2. POST /v1/invoiceitems (one per non-zero line).
 *  3. POST /v1/invoices with `auto_advance=true` to finalize + send.
 *  4. UPDATE billing_period row with invoice id + URL + invoiced_at.
 *
 * Stripe's Idempotency-Key header carries `period_id:type` so a retry of
 * the whole sequence is safe.
 */
export async function createInvoiceForPeriod(
  supabase: SupabaseClient,
  config: StripeClientConfig,
  period: BillingPeriodSnapshot,
  account: BillingAccountSnapshot
): Promise<CreateInvoiceResult> {
  if (period.stripe_invoice_id) {
    // Already invoiced — return the existing invoice. We re-fetch from
    // Stripe so the caller has the latest status, not a stale snapshot.
    const existing = await stripeGet<StripeInvoice>(config, `/invoices/${period.stripe_invoice_id}`)
    return { invoice: existing, idempotent: true }
  }
  if (!account.stripe_customer_id) {
    throw new StripeBillingError(
      'missing_customer',
      `wallet ${account.wallet_address} has no stripe_customer_id; complete /billing/setup first`
    )
  }
  if (period.total_usd <= 0) {
    throw new StripeBillingError(
      'nothing_to_bill',
      `period ${period.id} has total_usd=0 — nothing to invoice`
    )
  }

  // 1. Subscription fee (when > 0). Idempotency-Key tied to period+line.
  if (period.subscription_fee_usd > 0) {
    await stripeForm<unknown>(
      config,
      '/invoiceitems',
      {
        customer: account.stripe_customer_id,
        amount: String(Math.round(period.subscription_fee_usd * 100)),
        currency: 'usd',
        description: `ClawPay subscription — ${formatPeriodLabel(period)}`,
        'metadata[wallet_address]': account.wallet_address,
        'metadata[billing_period_id]': period.id,
        'metadata[line]': 'subscription',
      },
      `${period.id}:subscription`
    )
  }

  // 2. Usage fee (outcome line). Skipped silently when blocked_value=0.
  if (period.usage_fee_usd > 0) {
    await stripeForm<unknown>(
      config,
      '/invoiceitems',
      {
        customer: account.stripe_customer_id,
        amount: String(Math.round(period.usage_fee_usd * 100)),
        currency: 'usd',
        description:
          `ClawPay outcome fee — ${period.blocked_event_count} blocked payments` +
          ` worth $${period.blocked_value_usd.toFixed(2)} × ` +
          `${(period.fee_bps_snapshot / 100).toFixed(2)}%`,
        'metadata[wallet_address]': account.wallet_address,
        'metadata[billing_period_id]': period.id,
        'metadata[line]': 'usage',
        'metadata[blocked_event_count]': String(period.blocked_event_count),
        'metadata[blocked_value_usd]': period.blocked_value_usd.toFixed(2),
        'metadata[fee_bps]': String(period.fee_bps_snapshot),
      },
      `${period.id}:usage`
    )
  }

  // 3. Create + finalize + send.
  const invoice = await stripeForm<StripeInvoice>(
    config,
    '/invoices',
    {
      customer: account.stripe_customer_id,
      auto_advance: 'true',
      collection_method: 'charge_automatically',
      description: `ClawPay billing — ${formatPeriodLabel(period)}`,
      'metadata[wallet_address]': account.wallet_address,
      'metadata[billing_period_id]': period.id,
    },
    `${period.id}:invoice`
  )

  // 4. Persist Stripe state on the period row.
  const { error } = await supabase
    .from('clawpay_billing_periods')
    .update({
      status: 'invoiced',
      stripe_invoice_id: invoice.id,
      stripe_invoice_url: invoice.hosted_invoice_url,
      invoiced_at: new Date().toISOString(),
    })
    .eq('id', period.id)
    .neq('status', 'paid') // a webhook may have flipped to 'paid' already

  if (error) {
    // We DON'T throw — the invoice exists in Stripe; the DB will reconcile
    // via the webhook. Log + return.
    console.error('Failed to mark billing period invoiced:', error)
  }

  return { invoice, idempotent: false }
}

// ============================================================================
// Webhook handling
// ============================================================================

/**
 * Verify a Stripe webhook signature using `Stripe-Signature` and return
 * the parsed event payload. Throws on signature mismatch.
 *
 * Implements the public scheme documented at
 * https://docs.stripe.com/webhooks/signature: HMAC-SHA256 over
 * `<timestamp>.<raw_body>` keyed by the webhook secret, compared in
 * constant time against the `v1` value from the header.
 */
export async function verifyAndParseWebhook(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSeconds = 300 // 5 min — Stripe's recommended default
): Promise<StripeWebhookEvent> {
  if (!signatureHeader) {
    throw new StripeBillingError('stripe_request_failed', 'missing Stripe-Signature header', 401)
  }
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k, v]
    })
  ) as Record<string, string | undefined>

  const timestamp = parts['t']
  const v1 = parts['v1']
  if (!timestamp || !v1) {
    throw new StripeBillingError('stripe_request_failed', 'malformed Stripe-Signature header', 401)
  }

  const now = Math.floor(Date.now() / 1000)
  const ts = parseInt(timestamp, 10)
  if (Number.isNaN(ts) || Math.abs(now - ts) > toleranceSeconds) {
    throw new StripeBillingError(
      'stripe_request_failed',
      'Stripe webhook timestamp outside tolerance — possible replay',
      401
    )
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = await hmacSha256Hex(webhookSecret, signedPayload)
  if (!timingSafeEqual(expected, v1)) {
    throw new StripeBillingError('stripe_request_failed', 'signature mismatch', 401)
  }

  return JSON.parse(rawBody) as StripeWebhookEvent
}

/**
 * Dispatch a verified webhook event. Only handles invoice.paid /
 * invoice.payment_failed in Sprint 5; other events are no-ops so a
 * misconfigured webhook endpoint doesn't 500.
 */
export async function handleStripeWebhookEvent(
  supabase: SupabaseClient,
  event: StripeWebhookEvent
): Promise<{ handled: boolean; period_id?: string }> {
  if (event.type !== 'invoice.paid' && event.type !== 'invoice.payment_failed') {
    return { handled: false }
  }
  const invoice = event.data.object as {
    id?: string
    metadata?: Record<string, string>
  }
  const periodId = invoice.metadata?.['billing_period_id']
  if (!periodId) {
    return { handled: false }
  }

  const update: Record<string, unknown> =
    event.type === 'invoice.paid'
      ? { status: 'paid', paid_at: new Date().toISOString() }
      : {
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: 'invoice.payment_failed',
        }

  const { error } = await supabase.from('clawpay_billing_periods').update(update).eq('id', periodId)

  if (error) {
    console.error('webhook update billing_period error:', error)
  }
  return { handled: true, period_id: periodId }
}

// ============================================================================
// HTTP / crypto helpers
// ============================================================================

async function stripeForm<T>(
  config: StripeClientConfig,
  path: string,
  body: Record<string, string>,
  idempotencyKey?: string
): Promise<T> {
  const url = `${config.baseUrl ?? STRIPE_API_BASE}${path}`
  const form = new URLSearchParams(body).toString()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: form,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new StripeBillingError(
        'stripe_request_failed',
        `Stripe ${path} failed: ${res.status}`,
        res.status,
        text.slice(0, 1024)
      )
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function stripeGet<T>(config: StripeClientConfig, path: string): Promise<T> {
  const url = `${config.baseUrl ?? STRIPE_API_BASE}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new StripeBillingError(
        'stripe_request_failed',
        `Stripe ${path} failed: ${res.status}`,
        res.status,
        text.slice(0, 1024)
      )
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function formatPeriodLabel(p: BillingPeriodSnapshot): string {
  const start = new Date(p.period_start)
  return start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
