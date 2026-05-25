/**
 * ClawPay outcome-billing service (Sprint 5).
 *
 * Two responsibilities, deliberately split so a failure in the second
 * doesn't taint the first:
 *
 *  1. **Aggregation** — close a billing period: hand the period ID to the
 *     `close_clawpay_billing_period` RPC defined in migration
 *     `20260521040000_clawpay_billing.sql`. The RPC does the SUM /
 *     usage-record insert atomically and is idempotent.
 *  2. **Preview** — compute the in-flight numbers for the open period
 *     without persisting anything. Used by the dashboard "current period"
 *     card so a tenant can see what they're about to be billed.
 *
 * The Stripe invoicing step lives in a sibling service so a failed Stripe
 * call doesn't roll back the close.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Plan pricing — single source of truth for the four tiers.
// ============================================================================

export type BillingPlan = 'free' | 'starter' | 'pro' | 'enterprise'

export interface BillingPlanConfig {
  /** USD/month flat — billed regardless of usage. */
  subscriptionFeeUsd: number
  /** Outcome fee, basis points (50 = 0.5%). */
  feeBps: number
  /** Free validations / month before usage kicks in. */
  freeValidations: number
}

export const PLAN_PRICING: Record<BillingPlan, BillingPlanConfig> = {
  free: { subscriptionFeeUsd: 0, feeBps: 0, freeValidations: 1_000 },
  starter: { subscriptionFeeUsd: 29, feeBps: 0, freeValidations: 100_000 },
  pro: { subscriptionFeeUsd: 99, feeBps: 50, freeValidations: 1_000_000 },
  enterprise: { subscriptionFeeUsd: 499, feeBps: 25, freeValidations: 10_000_000 },
}

// ============================================================================
// Types
// ============================================================================

export type BillingPeriodStatus = 'open' | 'closed' | 'invoiced' | 'paid' | 'failed' | 'void'

export type BillingAccountStatus = 'active' | 'paused' | 'closed'

export interface BillingAccount {
  wallet_address: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: BillingPlan
  fee_bps: number
  subscription_fee_usd: number
  status: BillingAccountStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BillingPeriod {
  id: string
  wallet_address: string
  period_start: string
  period_end: string
  status: BillingPeriodStatus
  blocked_value_usd: number
  usage_fee_usd: number
  subscription_fee_usd: number
  total_usd: number
  blocked_event_count: number
  fee_bps_snapshot: number
  plan_snapshot: BillingPlan
  stripe_invoice_id: string | null
  stripe_invoice_url: string | null
  closed_at: string | null
  invoiced_at: string | null
  paid_at: string | null
  failed_at: string | null
  failure_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CurrentPeriodPreview {
  period_start: string
  period_end: string
  blocked_value_usd: number
  blocked_event_count: number
  usage_fee_usd: number
  subscription_fee_usd: number
  total_usd: number
  fee_bps: number
  plan: BillingPlan
  /** True if a billing_accounts row exists for the caller. When false the
   *  preview uses the default Free-tier config. */
  account_configured: boolean
}

export interface CloseBillingPeriodResult {
  period_id: string
  status: 'closed' | 'invoiced' | 'paid'
  blocked_value_usd: number
  blocked_event_count: number
  usage_fee_usd: number
  subscription_fee_usd: number
  total_usd: number
  idempotent: boolean
}

// ============================================================================
// Period boundaries — calendar month in UTC.
// ============================================================================

/**
 * Returns the [start, end) of the calendar month containing `at` (in UTC).
 * We pick the first instant of the next month for `end` so the SQL
 * comparison `occurred_at < period_end` covers everything in the month.
 */
export function calendarMonthBoundaries(at: Date = new Date()): {
  period_start: Date
  period_end: Date
} {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  return { period_start: start, period_end: end }
}

// ============================================================================
// Account access
// ============================================================================

/**
 * Returns the billing account for the wallet, falling back to a synthetic
 * Free-tier shape when the row doesn't exist. The caller never has to
 * branch on the missing-account case for read paths.
 */
export async function loadBillingAccount(
  supabase: SupabaseClient,
  wallet: string
): Promise<{ account: BillingAccount | null; effective: BillingAccount }> {
  const { data, error } = await supabase
    .from('clawpay_billing_accounts')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    throw new Error(`failed to load billing account: ${error.message}`)
  }

  const account = (data as BillingAccount | null) ?? null
  if (account) {
    return { account, effective: account }
  }

  // Synthetic Free-tier row. Not persisted — the dashboard treats the
  // absence of a row as "unconfigured" via `account_configured`.
  const freeConfig = PLAN_PRICING.free
  return {
    account: null,
    effective: {
      wallet_address: wallet,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      plan: 'free',
      fee_bps: freeConfig.feeBps,
      subscription_fee_usd: freeConfig.subscriptionFeeUsd,
      status: 'active',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

/**
 * Find-or-create the open period for the wallet that covers `at`. Returns
 * the existing row when one is already open for the calendar month, or
 * inserts a fresh `status='open'` row otherwise.
 */
export async function ensureOpenBillingPeriod(
  supabase: SupabaseClient,
  wallet: string,
  at: Date = new Date()
): Promise<BillingPeriod> {
  const { period_start, period_end } = calendarMonthBoundaries(at)

  // Try to find an existing period first — covers the common warm-cache case.
  const { data: existing, error: selectError } = await supabase
    .from('clawpay_billing_periods')
    .select('*')
    .eq('wallet_address', wallet)
    .eq('period_start', period_start.toISOString())
    .neq('status', 'failed')
    .neq('status', 'void')
    .maybeSingle()

  if (selectError) {
    throw new Error(`failed to look up billing period: ${selectError.message}`)
  }
  if (existing) {
    return existing as BillingPeriod
  }

  // Snapshot the plan/fee at insert time so the period reflects what the
  // tenant signed up for — even if they upgrade mid-period later.
  const { effective } = await loadBillingAccount(supabase, wallet)

  const { data: inserted, error: insertError } = await supabase
    .from('clawpay_billing_periods')
    .insert({
      wallet_address: wallet,
      period_start: period_start.toISOString(),
      period_end: period_end.toISOString(),
      status: 'open',
      fee_bps_snapshot: effective.fee_bps,
      plan_snapshot: effective.plan,
      subscription_fee_usd: effective.subscription_fee_usd,
    })
    .select()
    .single()

  if (insertError) {
    // Race: another request inserted between our select and insert. Re-query.
    const code = (insertError as { code?: string }).code
    if (code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('clawpay_billing_periods')
        .select('*')
        .eq('wallet_address', wallet)
        .eq('period_start', period_start.toISOString())
        .neq('status', 'failed')
        .neq('status', 'void')
        .single()
      if (retryError || !retry) {
        throw new Error(`race resolution failed: ${retryError?.message}`)
      }
      return retry as BillingPeriod
    }
    throw new Error(`failed to create billing period: ${insertError.message}`)
  }
  return inserted as BillingPeriod
}

// ============================================================================
// Preview — what the tenant would be billed if the period closed right now.
// ============================================================================

/**
 * Computes the in-flight numbers for the open period without persisting.
 *
 * Sums `clawpay_audit_events.amount_usd` for blocked events whose
 * `occurred_at` is inside the calendar month. Adds the subscription fee
 * snapshot from the account. The dashboard calls this for the
 * "current period" card.
 */
export async function previewCurrentPeriod(
  supabase: SupabaseClient,
  wallet: string,
  at: Date = new Date()
): Promise<CurrentPeriodPreview> {
  const { period_start, period_end } = calendarMonthBoundaries(at)
  const { account, effective } = await loadBillingAccount(supabase, wallet)

  const { data, error } = await supabase
    .from('clawpay_audit_events')
    .select('amount_usd', { count: 'exact' })
    .eq('wallet_address', wallet)
    .eq('event_kind', 'payment_blocked')
    .gte('occurred_at', period_start.toISOString())
    .lt('occurred_at', period_end.toISOString())
    .not('amount_usd', 'is', null)
    .gt('amount_usd', 0)

  if (error) {
    throw new Error(`failed to preview period: ${error.message}`)
  }

  let blockedValue = 0
  let count = 0
  for (const row of data ?? []) {
    const v = (row as { amount_usd: number | null }).amount_usd
    if (typeof v === 'number' && v > 0) {
      blockedValue += v
      count += 1
    }
  }

  const usage = roundUsd((blockedValue * effective.fee_bps) / 10_000)
  const total = roundUsd(usage + effective.subscription_fee_usd)

  return {
    period_start: period_start.toISOString(),
    period_end: period_end.toISOString(),
    blocked_value_usd: roundUsd(blockedValue),
    blocked_event_count: count,
    usage_fee_usd: usage,
    subscription_fee_usd: effective.subscription_fee_usd,
    total_usd: total,
    fee_bps: effective.fee_bps,
    plan: effective.plan,
    account_configured: account !== null,
  }
}

// ============================================================================
// Close — atomically aggregate audit events into a closed period.
// ============================================================================

/**
 * Wraps the `close_clawpay_billing_period(uuid)` RPC. Idempotent —
 * re-calling for a period that's already at status `invoiced` / `paid`
 * returns the existing snapshot unchanged.
 *
 * Requires service-role (the RPC is SECURITY DEFINER and granted to
 * `authenticated`, but the SUM walks every wallet's audit events; the
 * SQL gates that via `wallet_address = jwt_wallet_address()`-equivalent
 * comparison inside the function).
 */
export async function closeBillingPeriod(
  supabase: SupabaseClient,
  periodId: string
): Promise<CloseBillingPeriodResult> {
  const { data, error } = await supabase.rpc('close_clawpay_billing_period', {
    p_period_id: periodId,
  })

  if (error) {
    throw new Error(`close_clawpay_billing_period failed: ${error.message}`)
  }
  if (!data || typeof data !== 'object') {
    throw new Error('close_clawpay_billing_period returned an unexpected shape')
  }
  return data as CloseBillingPeriodResult
}

// ============================================================================
// Helpers
// ============================================================================

/** USD values are stored with 6 decimals; the dashboard rounds to 2. */
export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
