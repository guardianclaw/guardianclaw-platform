/**
 * ClawPay Stripe-billing routes (Sprint 5).
 *
 * Split from the dashboard-facing `clawpay-billing` router because:
 *  - These routes touch live Stripe state and need their own rate limit.
 *  - The webhook endpoint must be public (no JWT) but signature-verified.
 *  - Failure modes differ (Stripe down should not block dashboard reads).
 *
 * Routes:
 *   POST /clawpay/billing/periods/:id/invoice    Authenticated. Idempotent.
 *                                                Creates the Stripe invoice
 *                                                for an already-closed period.
 *   POST /clawpay/billing/webhooks/stripe        Public. Stripe signature
 *                                                required. Handles
 *                                                invoice.paid /
 *                                                invoice.payment_failed.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getServiceClient, getUserClient } from '../lib/supabase-client'
import {
  StripeBillingError,
  createInvoiceForPeriod,
  handleStripeWebhookEvent,
  verifyAndParseWebhook,
  type BillingAccountSnapshot,
  type BillingPeriodSnapshot,
  type StripeClientConfig,
} from '../services/clawpay-stripe-billing'

// ============================================================================
// Types
// ============================================================================

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
  // Stripe-specific
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_API_BASE?: string
}

type Variables = {
  wallet: string
  plan: string
}

// ============================================================================
// Authenticated invoice route
// ============================================================================

const uuidSchema = z.string().uuid('Invalid UUID format')

export const clawpayBillingStripeRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpayBillingStripeRoutes.use('/billing/periods/:id/invoice', authMiddleware)
clawpayBillingStripeRoutes.use('/billing/periods/:id/invoice', walletRateLimitMiddleware())

clawpayBillingStripeRoutes.post('/billing/periods/:id/invoice', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json(
      {
        error: 'Stripe billing is not configured on this deployment',
        hint: 'Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in the worker env.',
      },
      503
    )
  }

  const wallet = c.get('wallet')
  const id = c.req.param('id')
  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) {
    return c.json({ error: 'Invalid period ID format' }, 400)
  }

  const userClient = await getUserClient(c.env, wallet)
  const serviceClient = getServiceClient(c.env)

  const { data: period, error: periodError } = await userClient
    .from('clawpay_billing_periods')
    .select('*')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()
  if (periodError) {
    console.error('invoice: load period error:', periodError)
    return c.json({ error: 'Failed to load period' }, 500)
  }
  if (!period) {
    return c.json({ error: 'Billing period not found' }, 404)
  }
  if (period.status === 'open') {
    return c.json(
      {
        error: 'Period must be closed before invoicing',
        hint: 'Call POST /clawpay/billing/periods/close first.',
      },
      409
    )
  }

  const { data: account, error: accountError } = await userClient
    .from('clawpay_billing_accounts')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle()
  if (accountError) {
    console.error('invoice: load account error:', accountError)
    return c.json({ error: 'Failed to load billing account' }, 500)
  }
  if (!account) {
    return c.json(
      {
        error: 'No billing account configured for this wallet',
        hint: 'Set up a Stripe customer first.',
      },
      409
    )
  }

  const config: StripeClientConfig = {
    apiKey: c.env.STRIPE_SECRET_KEY,
    webhookSecret: c.env.STRIPE_WEBHOOK_SECRET ?? '',
    baseUrl: c.env.STRIPE_API_BASE,
  }

  try {
    const result = await createInvoiceForPeriod(
      serviceClient,
      config,
      period as BillingPeriodSnapshot,
      account as BillingAccountSnapshot
    )
    return c.json({ invoice: result.invoice, idempotent: result.idempotent })
  } catch (err) {
    if (err instanceof StripeBillingError) {
      const status = err.kind === 'missing_customer' || err.kind === 'nothing_to_bill' ? 409 : 502
      return c.json({ error: err.message, kind: err.kind, details: err.details }, status)
    }
    console.error('invoice: unexpected error:', err)
    return c.json({ error: 'Failed to create invoice' }, 500)
  }
})

// ============================================================================
// Public webhook route
// ============================================================================

export const clawpayBillingStripeWebhookRoutes = new Hono<{ Bindings: Bindings }>()

clawpayBillingStripeWebhookRoutes.post('/billing/webhooks/stripe', async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Stripe webhooks are not configured' }, 503)
  }

  let rawBody: string
  try {
    rawBody = await c.req.text()
  } catch {
    return c.json({ error: 'Failed to read body' }, 400)
  }

  const signature = c.req.header('stripe-signature') ?? c.req.header('Stripe-Signature') ?? null

  let event
  try {
    event = await verifyAndParseWebhook(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    if (err instanceof StripeBillingError) {
      return c.json({ error: err.message }, (err.status ?? 401) as 400 | 401 | 403 | 502)
    }
    return c.json({ error: 'webhook verification failed' }, 401)
  }

  const supabase = getServiceClient(c.env)
  const result = await handleStripeWebhookEvent(supabase, event)

  return c.json({ received: true, ...result })
})
