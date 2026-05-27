/**
 * ClawPay billing routes (Sprint 5).
 *
 * The dashboard speaks to this surface; the aggregation service speaks to
 * the SQL RPC directly. Routes:
 *
 *   GET  /clawpay/billing/account          The caller's billing account
 *                                          (synthetic Free-tier when none).
 *   GET  /clawpay/billing/current          In-flight preview of the open
 *                                          period.
 *   GET  /clawpay/billing/periods          Paginated history.
 *   POST /clawpay/billing/periods/close    Self-service close of the open
 *                                          period (returns the snapshot;
 *                                          invoicing is a separate step
 *                                          in clawpay-billing-stripe).
 *
 * Service-role-only routes (admin opens, plan upgrades, manual reconcile)
 * intentionally live elsewhere — we keep this file dashboard-facing.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getUserClient, getServiceClient } from '../lib/supabase-client'
import {
  closeBillingPeriod,
  ensureOpenBillingPeriod,
  loadBillingAccount,
  previewCurrentPeriod,
  PLAN_PRICING,
} from '../services/clawpay-billing'

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
}

type Variables = {
  wallet: string
  plan: string
}

// ============================================================================
// Validation schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid UUID format')

const periodStatusSchema = z.enum(['open', 'closed', 'invoiced', 'paid', 'failed', 'void'])

const listPeriodsQuerySchema = z.object({
  status: periodStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).max(10_000).default(0),
})

// ============================================================================
// Routes
// ============================================================================

export const clawpayBillingRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpayBillingRoutes.use('*', authMiddleware)
clawpayBillingRoutes.use('*', walletRateLimitMiddleware())

/**
 * GET /clawpay/billing/account — caller's billing account.
 *
 * Returns the synthetic Free-tier shape when no row exists, with
 * ``account_configured`` flag so the dashboard can prompt setup.
 */
clawpayBillingRoutes.get('/billing/account', async (c) => {
  const wallet = c.get('wallet')
  const supabase = await getUserClient(c.env, wallet)

  try {
    const { account, effective } = await loadBillingAccount(supabase, wallet)
    return c.json({
      account: effective,
      account_configured: account !== null,
      plan_pricing: PLAN_PRICING,
    })
  } catch (err) {
    console.error('Load billing account error:', err)
    return c.json({ error: 'Failed to load billing account' }, 500)
  }
})

/**
 * GET /clawpay/billing/current — preview of the open period.
 *
 * Aggregates audit events on the fly. Cheap when activity is low; we cap
 * the query inside the service to the rows in the current calendar month.
 */
clawpayBillingRoutes.get('/billing/current', async (c) => {
  const wallet = c.get('wallet')
  const supabase = await getUserClient(c.env, wallet)

  try {
    const preview = await previewCurrentPeriod(supabase, wallet)
    return c.json({ preview })
  } catch (err) {
    console.error('Preview current period error:', err)
    return c.json({ error: 'Failed to preview current period' }, 500)
  }
})

/**
 * GET /clawpay/billing/periods — history.
 */
clawpayBillingRoutes.get('/billing/periods', async (c) => {
  const wallet = c.get('wallet')

  const parsed = listPeriodsQuerySchema.safeParse({
    status: c.req.query('status'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
  }
  const { status, limit, offset } = parsed.data

  const supabase = await getUserClient(c.env, wallet)

  let query = supabase
    .from('clawpay_billing_periods')
    .select('*', { count: 'exact' })
    .eq('wallet_address', wallet)
    .order('period_start', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    console.error('List billing periods error:', error)
    return c.json({ error: 'Failed to list billing periods' }, 500)
  }

  return c.json({
    periods: data ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  })
})

/**
 * GET /clawpay/billing/periods/:id — single period + its usage records.
 */
clawpayBillingRoutes.get('/billing/periods/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) {
    return c.json({ error: 'Invalid period ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const { data: period, error: periodError } = await supabase
    .from('clawpay_billing_periods')
    .select('*')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (periodError) {
    console.error('Get billing period error:', periodError)
    return c.json({ error: 'Failed to fetch billing period' }, 500)
  }
  if (!period) {
    return c.json({ error: 'Billing period not found' }, 404)
  }

  const { data: records, error: recordsError } = await supabase
    .from('clawpay_billing_usage_records')
    .select('*')
    .eq('billing_period_id', id)
    .eq('wallet_address', wallet)
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (recordsError) {
    console.error('List usage records error:', recordsError)
    return c.json({ error: 'Failed to load usage records' }, 500)
  }

  return c.json({ period, usage_records: records ?? [] })
})

/**
 * POST /clawpay/billing/periods/close — close the caller's current period.
 *
 * Idempotent self-service close. Uses the service-role client because the
 * `close_clawpay_billing_period` RPC needs to SUM across rows the caller
 * may not see directly (the RPC re-asserts the wallet match internally).
 *
 * The Stripe invoicing step is *not* triggered here — that's a separate
 * route under /clawpay/billing/periods/:id/invoice so a Stripe outage
 * doesn't roll back the close.
 */
clawpayBillingRoutes.post('/billing/periods/close', async (c) => {
  const wallet = c.get('wallet')
  const userClient = await getUserClient(c.env, wallet)

  // The aggregation needs SERVICE_ROLE so the SUM can reach every row the
  // RPC needs — RLS would otherwise hide rows that aren't visible to the
  // anon JWT. The RPC itself re-checks ownership before writing.
  // (See `close_clawpay_billing_period` in migration 20260521040000.)
  const serviceClient = getServiceClient(c.env)

  try {
    // 1. Find-or-create the open period for the caller's current month.
    const period = await ensureOpenBillingPeriod(userClient, wallet)

    // 2. Run the atomic close RPC.
    const result = await closeBillingPeriod(serviceClient, period.id)

    return c.json({ period_id: period.id, result })
  } catch (err) {
    console.error('Close billing period error:', err)
    return c.json({ error: 'Failed to close billing period' }, 500)
  }
})
