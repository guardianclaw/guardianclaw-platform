/**
 * ClawPay case-study export (Sprint 6).
 *
 * Generates a structured, anonymizable JSON report that a design partner
 * can hand to their security or finance team as evidence of what ClawPay
 * blocked over a chosen window. The output is versioned via `schema_version`
 * so downstream consumers (a future PDF renderer, a Notion exporter, etc.)
 * can detect breaking changes.
 *
 * Anonymization (`?anonymize=true`, default true):
 *   - Wallet addresses → `agent_<8-char-hash>`
 *   - Recipient / endpoint values in drainer_intel hits → truncated.
 *   - Tx signatures and customer IDs are dropped.
 *
 * The intent is: a partner can drop the JSON into a public case study
 * without exposing their own wallet or any third party's customer IDs.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getUserClient } from '../lib/supabase-client'

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

const CASE_STUDY_SCHEMA_VERSION = 1

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

// ============================================================================
// Validation
// ============================================================================

const isoDateSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Must be an ISO-8601 timestamp',
})

const exportQuerySchema = z.object({
  occurred_after: isoDateSchema.optional(),
  occurred_before: isoDateSchema.optional(),
  // Hand-rolled boolean parse because `z.coerce.boolean()` treats the
  // literal string "false" as truthy (only empty / undefined map to false).
  // The dashboard explicitly passes "true" / "false".
  anonymize: z
    .enum(['true', 'false'])
    .optional()
    .default('true')
    .transform((v) => v === 'true'),
  // Cap the sample size — the JSON is hand-reviewable, not a data dump.
  sample_limit: z.coerce.number().min(0).max(200).optional().default(20),
})

// ============================================================================
// Helpers
// ============================================================================

/**
 * Deterministic 8-char hash of a string. Not cryptographic — just enough
 * to anonymize while keeping the same input mapping consistently across
 * the report (a recurring drainer address appears with the same hash
 * everywhere it shows up).
 */
async function shortHash(input: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input))
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < 4; i++) {
    const b = bytes[i]!
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

interface DrainerHitShape {
  source?: string
  source_ref?: string
  severity?: string
  scope?: string
  value?: string
}

interface ReportEventSample {
  id: string
  occurred_at: string
  provider: string | null
  event_kind: string
  risk_level: string
  amount_usd: number | null
  endpoint_label: string | null
  pay_to_label: string | null
  drainer_intel: Array<{
    source: string | null
    severity: string | null
    scope: string | null
  }>
  simulation_status: string | null
  simulation_provider: string | null
}

interface ReportShape {
  schema_version: number
  generated_at: string
  agent_id: string
  window: {
    occurred_after: string | null
    occurred_before: string | null
  }
  totals: {
    blocked_event_count: number
    blocked_value_usd: number
    approved_event_count: number
    confirmation_required_event_count: number
    distinct_drainer_sources: number
  }
  drainer_breakdown: Array<{
    source: string
    hit_count: number
    blocked_value_usd: number
  }>
  simulation_outcomes: Record<string, number>
  sample_blocked_events: ReportEventSample[]
  anonymized: boolean
}

// ============================================================================
// Route
// ============================================================================

export const clawpayCaseStudyRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpayCaseStudyRoutes.use('*', authMiddleware)
clawpayCaseStudyRoutes.use('*', walletRateLimitMiddleware())

clawpayCaseStudyRoutes.get('/case-study/export', async (c) => {
  const wallet = c.get('wallet')

  const parsed = exportQuerySchema.safeParse({
    occurred_after: c.req.query('occurred_after'),
    occurred_before: c.req.query('occurred_before'),
    anonymize: c.req.query('anonymize'),
    sample_limit: c.req.query('sample_limit'),
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
  }
  const { occurred_after, occurred_before, anonymize, sample_limit } = parsed.data

  const supabase = await getUserClient(c.env, wallet)

  let query = supabase
    .from('clawpay_audit_events')
    .select(
      'id,occurred_at,provider,event_kind,risk_level,endpoint,network,asset,pay_to,amount_usd,drainer_intel,reasoning,simulation'
    )
    .eq('wallet_address', wallet)
    .order('occurred_at', { ascending: false })
    .limit(10_000) // hard cap on rows processed per request

  if (occurred_after) {
    query = query.gte('occurred_at', new Date(occurred_after).toISOString())
  }
  if (occurred_before) {
    query = query.lte('occurred_at', new Date(occurred_before).toISOString())
  }

  const { data, error } = await query
  if (error) {
    console.error('case-study export error:', error)
    return c.json({ error: 'Failed to load audit events' }, 500)
  }

  const events = (data ?? []) as AuditEventRow[]
  const report = await buildReport({
    events,
    wallet,
    anonymize,
    sampleLimit: sample_limit,
    occurredAfter: occurred_after ?? null,
    occurredBefore: occurred_before ?? null,
  })

  return c.json(report)
})

// ============================================================================
// Pure report builder (split out for testability)
// ============================================================================

export interface BuildReportArgs {
  events: AuditEventRow[]
  wallet: string
  anonymize: boolean
  sampleLimit: number
  occurredAfter: string | null
  occurredBefore: string | null
}

export async function buildReport(args: BuildReportArgs): Promise<ReportShape> {
  const { events, wallet, anonymize, sampleLimit } = args

  const agentId = anonymize ? `agent_${await shortHash(wallet)}` : wallet

  let blockedCount = 0
  let blockedValue = 0
  let approvedCount = 0
  let confirmationRequiredCount = 0
  const drainerCounts = new Map<string, { count: number; blocked_value_usd: number }>()
  const simulationOutcomes: Record<string, number> = {}

  for (const event of events) {
    if (event.event_kind === 'payment_blocked') {
      blockedCount += 1
      if (typeof event.amount_usd === 'number') {
        blockedValue += event.amount_usd
      }
      const hits = Array.isArray(event.drainer_intel)
        ? (event.drainer_intel as DrainerHitShape[])
        : []
      for (const hit of hits) {
        const source = hit.source ?? 'unknown'
        const entry = drainerCounts.get(source) ?? { count: 0, blocked_value_usd: 0 }
        entry.count += 1
        if (typeof event.amount_usd === 'number') {
          // Attribute the blocked USD to every contributing source (the
          // sum across sources may exceed total blocked when a single
          // event hit multiple sources — that's fine, the breakdown is
          // informational, not double-counting).
          entry.blocked_value_usd += event.amount_usd
        }
        drainerCounts.set(source, entry)
      }
    } else if (event.event_kind === 'payment_approved') {
      approvedCount += 1
    } else if (event.event_kind === 'payment_confirmation_required') {
      confirmationRequiredCount += 1
    }

    const simStatus = event.simulation?.status ?? null
    if (simStatus) {
      simulationOutcomes[simStatus] = (simulationOutcomes[simStatus] ?? 0) + 1
    }
  }

  const blockedEvents = events.filter((e) => e.event_kind === 'payment_blocked')
  const sliced = blockedEvents.slice(0, sampleLimit)
  const sample: ReportEventSample[] = []
  for (const event of sliced) {
    sample.push(await summarizeEvent(event, anonymize))
  }

  return {
    schema_version: CASE_STUDY_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    agent_id: agentId,
    window: {
      occurred_after: args.occurredAfter,
      occurred_before: args.occurredBefore,
    },
    totals: {
      blocked_event_count: blockedCount,
      blocked_value_usd: round(blockedValue),
      approved_event_count: approvedCount,
      confirmation_required_event_count: confirmationRequiredCount,
      distinct_drainer_sources: drainerCounts.size,
    },
    drainer_breakdown: Array.from(drainerCounts.entries())
      .map(([source, { count, blocked_value_usd }]) => ({
        source,
        hit_count: count,
        blocked_value_usd: round(blocked_value_usd),
      }))
      .sort((a, b) => b.blocked_value_usd - a.blocked_value_usd),
    simulation_outcomes: simulationOutcomes,
    sample_blocked_events: sample,
    anonymized: anonymize,
  }
}

async function summarizeEvent(
  event: AuditEventRow,
  anonymize: boolean
): Promise<ReportEventSample> {
  const endpointLabel = event.endpoint
    ? anonymize
      ? `endpoint_${await shortHash(event.endpoint)}`
      : event.endpoint
    : null
  const payToLabel = event.pay_to
    ? anonymize
      ? `pay_to_${await shortHash(event.pay_to)}`
      : truncateMiddle(event.pay_to)
    : null

  const hits = Array.isArray(event.drainer_intel) ? (event.drainer_intel as DrainerHitShape[]) : []

  return {
    id: event.id,
    occurred_at: event.occurred_at,
    provider: event.provider,
    event_kind: event.event_kind,
    risk_level: event.risk_level,
    amount_usd: typeof event.amount_usd === 'number' ? round(event.amount_usd) : null,
    endpoint_label: endpointLabel,
    pay_to_label: payToLabel,
    drainer_intel: hits.map((h) => ({
      source: h.source ?? null,
      severity: h.severity ?? null,
      scope: h.scope ?? null,
    })),
    simulation_status: event.simulation?.status ?? null,
    simulation_provider: event.simulation?.provider ?? null,
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
