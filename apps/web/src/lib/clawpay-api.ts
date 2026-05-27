/**
 * ClawPay API client — wraps the Hono backend routes under /clawpay/*.
 *
 * Lives separately from the shared `lib/api.ts` to keep the surface focused
 * and to avoid inflating the central module (already 2200+ lines).
 *
 * The base `api<T>()` and `ApiError` are re-exported from `lib/api.ts`, which
 * already handles credentials, 401 token-expiry events, and transient retries.
 */

import { api, ApiError, API_URL } from './api'

// ============================================================================
// Shared types — mirror the Supabase row shapes in migrations
// 20260521010000_clawpay_core.sql and 20260521000000_drainer_intel.sql.
// ============================================================================

export type ClawpayPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'lifetime'

export type ClawpayEventKind =
  | 'payment_approved'
  | 'payment_blocked'
  | 'payment_confirmation_required'
  | 'payment_failed'

export type ClawpayRiskLevel = 'safe' | 'caution' | 'high' | 'critical' | 'blocked'

export type ClawpayAlertStatus = 'pending' | 'delivered' | 'failed' | 'skipped'

/**
 * Payment surface that produced an audit row. New providers will require
 * a backend migration extending the CHECK constraint plus an addition here.
 */
export type ClawpayProvider = 'x402' | 'stripe'

/**
 * Pre-flight simulation outcome (Sprint 4). Mirrors `SimulationStatus` in
 * the Python SDK and the TypeScript validator package.
 */
export type ClawpaySimulationStatus =
  | 'ok'
  | 'unsupported'
  | 'error'
  | 'would_fail'
  | 'suspicious_balance_change'
  | 'suspicious_ownership_change'

export interface SimulationBalanceChange {
  address: string
  delta_usd: number | null
  raw_delta: string | null
  asset: string | null
  direction: 'in' | 'out' | null
}

export interface SimulationOwnershipChange {
  account: string
  old_owner: string | null
  new_owner: string | null
}

/**
 * Wire shape of the SimulationResult payload returned by the SDK and stored
 * in `clawpay_audit_events.simulation` as a JSONB column.
 */
export interface SimulationOutcome {
  status: ClawpaySimulationStatus
  provider: string
  message: string | null
  balance_changes: SimulationBalanceChange[]
  ownership_changes: SimulationOwnershipChange[]
  logs_excerpt: string[]
  duration_ms: number | null
  raw_error: string | null
}

export interface SpendingLimit {
  id: string
  wallet_address: string
  agent_id: string | null
  name: string
  period: ClawpayPeriod
  limit_usd: number
  active: boolean
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateSpendingLimitInput {
  name: string
  period: ClawpayPeriod
  limit_usd: number
  agent_id?: string | null
  description?: string
  metadata?: Record<string, unknown>
}

export interface UpdateSpendingLimitInput {
  name?: string
  period?: ClawpayPeriod
  limit_usd?: number
  description?: string | null
  metadata?: Record<string, unknown>
  active?: boolean
}

export interface DrainerIntelHit {
  kind: 'address' | 'endpoint' | 'pattern'
  value: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  source: string
  source_ref: string | null
  network: string | null
  notes: string | null
  scope: 'recipient' | 'endpoint' | 'endpoint_pattern'
}

export interface AuditEvent {
  id: string
  wallet_address: string
  agent_id: string | null
  provider: ClawpayProvider
  event_kind: ClawpayEventKind
  endpoint: string | null
  network: string | null
  asset: string | null
  pay_to: string | null
  amount_usd: number | null
  decision: string
  risk_level: ClawpayRiskLevel
  gates: Record<string, { passed: boolean; reason: string | null; details?: unknown }>
  drainer_intel: DrainerIntelHit[]
  /** Sprint 4 — pre-flight simulation outcome, when configured. */
  simulation: SimulationOutcome | null
  reasoning: string | null
  tx_signature: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export interface AlertCondition {
  kind: string
  [key: string]: unknown
}

export interface Alert {
  id: string
  wallet_address: string
  agent_id: string | null
  name: string
  description: string | null
  condition: AlertCondition
  notification_target: string
  notification_secret_hash: string | null
  active: boolean
  cooldown_seconds: number
  last_triggered_at: string | null
  trigger_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateAlertInput {
  name: string
  condition: AlertCondition
  notification_target: string
  description?: string
  agent_id?: string | null
  cooldown_seconds?: number
  metadata?: Record<string, unknown>
}

export interface UpdateAlertInput {
  name?: string
  description?: string | null
  agent_id?: string | null
  condition?: AlertCondition
  notification_target?: string
  cooldown_seconds?: number
  active?: boolean
  metadata?: Record<string, unknown>
}

export interface AlertDelivery {
  id: string
  alert_id: string
  audit_event_id: string | null
  wallet_address: string
  status: ClawpayAlertStatus
  http_status: number | null
  response_body_snippet: string | null
  error: string | null
  attempt: number
  delivered_at: string | null
  created_at: string
}

export interface Paginated<T, Key extends string> {
  pagination: { limit: number; offset: number; total: number }
  // Marker so each endpoint has a distinct concrete key, e.g. { limits: [], pagination: ... }.
  // The generic is satisfied by adding the Key index in the route-specific type below.
  // Implementations cast through these per-endpoint shapes.
}

export interface SpendingLimitsList {
  limits: SpendingLimit[]
  pagination: { limit: number; offset: number; total: number }
}

export interface AuditEventsList {
  events: AuditEvent[]
  pagination: { limit: number; offset: number; total: number }
}

export interface AlertsList {
  alerts: Alert[]
  pagination: { limit: number; offset: number; total: number }
}

export interface DeliveriesList {
  deliveries: AlertDelivery[]
  pagination: { limit: number; offset: number; total: number }
}

export interface TestDeliveryResult {
  delivery: AlertDelivery
  tested: boolean
  http_status: number | null
  status: ClawpayAlertStatus
}

// ============================================================================
// Filter helpers
// ============================================================================

export interface SpendingLimitsQuery {
  agent_id?: string
  include_inactive?: boolean
  limit?: number
  offset?: number
}

export interface AuditEventsQuery {
  agent_id?: string
  event_kind?: ClawpayEventKind
  risk_level?: ClawpayRiskLevel
  provider?: ClawpayProvider
  simulation_status?: ClawpaySimulationStatus
  occurred_after?: string
  occurred_before?: string
  limit?: number
  offset?: number
}

export interface AlertsQuery {
  agent_id?: string
  active?: boolean
  limit?: number
  offset?: number
}

function buildQuery(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue
    }
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

// ============================================================================
// API namespaces
// ============================================================================

export const clawpaySpendingLimitsApi = {
  list: (query: SpendingLimitsQuery = {}) =>
    api<SpendingLimitsList>(`/clawpay/spending-limits${buildQuery(query)}`),

  get: (id: string) => api<{ limit: SpendingLimit }>(`/clawpay/spending-limits/${id}`),

  create: (input: CreateSpendingLimitInput) =>
    api<{ limit: SpendingLimit }>(`/clawpay/spending-limits`, {
      method: 'POST',
      body: input,
    }),

  update: (id: string, input: UpdateSpendingLimitInput) =>
    api<{ limit: SpendingLimit }>(`/clawpay/spending-limits/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    api<{ success: boolean; id: string }>(`/clawpay/spending-limits/${id}`, {
      method: 'DELETE',
    }),
}

export const clawpayAuditApi = {
  list: (query: AuditEventsQuery = {}) =>
    api<AuditEventsList>(`/clawpay/audit-events${buildQuery(query)}`),

  get: (id: string) => api<{ event: AuditEvent }>(`/clawpay/audit-events/${id}`),

  /**
   * Returns a Blob suitable for triggering a download. The browser controls
   * the file save dialog; we just hand it the CSV bytes.
   */
  exportCsv: async (query: AuditEventsQuery = {}): Promise<{ blob: Blob; filename: string }> => {
    const response = await fetch(`${API_URL}/clawpay/audit-events/export.csv${buildQuery(query)}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        (errorData as { error?: string }).error || `Export failed: ${response.status}`,
        (errorData as { details?: unknown }).details
      )
    }
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="([^"]+)"/)
    const filename = match ? match[1] : `clawpay-audit.csv`
    return { blob, filename }
  },
}

export const clawpayAlertsApi = {
  list: (query: AlertsQuery = {}) => api<AlertsList>(`/clawpay/alerts${buildQuery(query)}`),

  get: (id: string) => api<{ alert: Alert }>(`/clawpay/alerts/${id}`),

  create: (input: CreateAlertInput) =>
    api<{ alert: Alert }>(`/clawpay/alerts`, { method: 'POST', body: input }),

  update: (id: string, input: UpdateAlertInput) =>
    api<{ alert: Alert }>(`/clawpay/alerts/${id}`, {
      method: 'PATCH',
      body: input,
    }),

  remove: (id: string) =>
    api<{ success: boolean; id: string }>(`/clawpay/alerts/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Fires a one-off test webhook. The API returns 200 on a 2xx upstream and
   * 502 otherwise — both responses have the same JSON body, so we treat
   * either as a resolved promise and let the caller branch on `status`.
   */
  test: async (id: string): Promise<TestDeliveryResult> => {
    try {
      return await api<TestDeliveryResult>(`/clawpay/alerts/${id}/test`, {
        method: 'POST',
      })
    } catch (err) {
      // The 502 path throws an ApiError; the response body still has the
      // delivery shape, so we surface it instead of letting the error reach
      // the UI as a generic failure. The caller can read `status === 'failed'`.
      if (err instanceof ApiError && err.status === 502) {
        const details = err.details as Partial<TestDeliveryResult> | undefined
        if (details && typeof details === 'object' && 'delivery' in details) {
          return details as TestDeliveryResult
        }
      }
      throw err
    }
  },

  listDeliveries: (id: string, query: { limit?: number; offset?: number } = {}) =>
    api<DeliveriesList>(`/clawpay/alerts/${id}/deliveries${buildQuery(query)}`),
}

// ============================================================================
// Sprint 5 — outcome billing
// ============================================================================

export type ClawpayBillingPlan = 'free' | 'starter' | 'pro' | 'enterprise'

export type ClawpayBillingAccountStatus = 'active' | 'paused' | 'closed'

export type ClawpayBillingPeriodStatus = 'open' | 'closed' | 'invoiced' | 'paid' | 'failed' | 'void'

export interface BillingAccount {
  wallet_address: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: ClawpayBillingPlan
  fee_bps: number
  subscription_fee_usd: number
  status: ClawpayBillingAccountStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BillingPlanConfig {
  subscriptionFeeUsd: number
  feeBps: number
  freeValidations: number
}

export interface BillingAccountResponse {
  account: BillingAccount
  account_configured: boolean
  plan_pricing: Record<ClawpayBillingPlan, BillingPlanConfig>
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
  plan: ClawpayBillingPlan
  account_configured: boolean
}

export interface BillingPeriod {
  id: string
  wallet_address: string
  period_start: string
  period_end: string
  status: ClawpayBillingPeriodStatus
  blocked_value_usd: number
  usage_fee_usd: number
  subscription_fee_usd: number
  total_usd: number
  blocked_event_count: number
  fee_bps_snapshot: number
  plan_snapshot: ClawpayBillingPlan
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

export interface BillingUsageRecord {
  id: string
  billing_period_id: string
  audit_event_id: string | null
  wallet_address: string
  blocked_usd: number
  fee_usd: number
  occurred_at: string
  event_kind: string
  risk_level: string
  provider: string
  created_at: string
}

export interface BillingPeriodsList {
  periods: BillingPeriod[]
  pagination: { limit: number; offset: number; total: number }
}

export interface BillingPeriodDetail {
  period: BillingPeriod
  usage_records: BillingUsageRecord[]
}

export interface CloseBillingPeriodResponse {
  period_id: string
  result: {
    status: 'closed' | 'invoiced' | 'paid'
    blocked_value_usd: number
    blocked_event_count: number
    usage_fee_usd: number
    subscription_fee_usd: number
    total_usd: number
    idempotent: boolean
  }
}

export const clawpayBillingApi = {
  getAccount: () => api<BillingAccountResponse>('/clawpay/billing/account'),
  currentPreview: () =>
    api<{ preview: CurrentPeriodPreview }>('/clawpay/billing/current').then((r) => r.preview),
  listPeriods: (
    query: { status?: ClawpayBillingPeriodStatus; limit?: number; offset?: number } = {}
  ) => api<BillingPeriodsList>(`/clawpay/billing/periods${buildQuery(query)}`),
  getPeriod: (id: string) => api<BillingPeriodDetail>(`/clawpay/billing/periods/${id}`),
  closeCurrentPeriod: () =>
    api<CloseBillingPeriodResponse>('/clawpay/billing/periods/close', {
      method: 'POST',
    }),
}

// ============================================================================
// Sprint 6 — beta invites + notification preferences
// ============================================================================

export interface BetaInviteCheck {
  valid: boolean
  code?: string
  remaining_uses?: number
  expires_at?: string | null
  metadata?: Record<string, unknown>
  reason?: 'malformed_code' | 'unknown_code' | 'expired' | 'exhausted' | 'lookup_failed'
}

export interface BetaInviteRedeemResult {
  redeemed: boolean
  idempotent: boolean
  code?: string
  wallet_address?: string
  redeemed_at?: string
  metadata?: Record<string, unknown>
}

export async function clawpayBetaPublicCheckSafe(code: string): Promise<BetaInviteCheck> {
  try {
    return await api<BetaInviteCheck>(`/clawpay/beta/invites/${encodeURIComponent(code)}`)
  } catch (err) {
    if (err instanceof ApiError) {
      // The route returns 400 / 404 with `{ valid:false, reason }` — preserve
      // the reason so the wizard can show a useful message.
      const details = err.details as { reason?: BetaInviteCheck['reason'] } | undefined
      return { valid: false, reason: details?.reason ?? 'lookup_failed' }
    }
    throw err
  }
}

export async function clawpayBetaRedeemSafe(code: string): Promise<BetaInviteRedeemResult> {
  return api<BetaInviteRedeemResult>(`/clawpay/beta/invites/${encodeURIComponent(code)}/redeem`, {
    method: 'POST',
  })
}

export interface EmailPreferences {
  welcome?: boolean
  period_close?: boolean
  alerts_summary_daily?: boolean
  alerts_critical?: boolean
  product_updates?: boolean
}

export interface EmailSubscription {
  wallet_address: string
  email: string | null
  preferences: EmailPreferences
  unsubscribed_at: string | null
  verified_at: string | null
}

export interface NotificationsPreferencesResponse {
  subscription: EmailSubscription
  configured: boolean
}

export interface UpdateNotificationsInput {
  email?: string
  preferences?: EmailPreferences
  unsubscribed?: boolean
}

export const clawpayNotificationsApi = {
  getPreferences: () => api<NotificationsPreferencesResponse>('/clawpay/notifications/preferences'),
  update: (input: UpdateNotificationsInput) =>
    api<{ subscription: EmailSubscription }>('/clawpay/notifications/preferences', {
      method: 'PATCH',
      body: input,
    }),
  test: () =>
    api<{ delivered: boolean; provider?: string; provider_message_id?: string; reason?: string }>(
      '/clawpay/notifications/test',
      { method: 'POST' }
    ),
}

// Re-export so consumers only import from one module.
export { ApiError }
