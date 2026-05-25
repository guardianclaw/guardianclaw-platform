/**
 * ClawPay Audit Events Routes (Sprint 2)
 *
 * Read-only access to the `clawpay_audit_events` table. The table is
 * append-only and RLS-scoped to the caller's wallet; this route never writes
 * to it. Writes happen via the SDK audit sink (service_role).
 *
 * Routes:
 *   GET  /clawpay/audit-events                List events (paginated, filterable)
 *   GET  /clawpay/audit-events/:id            Get one event
 *   GET  /clawpay/audit-events/export.csv     Download CSV of filtered events
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

interface AuditEventRow {
  id: string
  wallet_address: string
  agent_id: string | null
  provider: string
  event_kind: string
  endpoint: string | null
  network: string | null
  asset: string | null
  pay_to: string | null
  amount_usd: number | null
  decision: string
  risk_level: string
  gates: Record<string, unknown>
  drainer_intel: unknown[]
  // Sprint 4 — provider-agnostic pre-flight simulation outcome, populated
  // when the SDK was configured with a SimulationProvider. NULL otherwise.
  simulation: Record<string, unknown> | null
  reasoning: string | null
  tx_signature: string | null
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}

// ============================================================================
// Validation schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid UUID format')

const eventKindSchema = z.enum([
  'payment_approved',
  'payment_blocked',
  'payment_confirmation_required',
  'payment_failed',
])

const riskLevelSchema = z.enum(['safe', 'caution', 'high', 'critical', 'blocked'])

// Sprint 3: providers (extends the CHECK in migration 20260521020000).
const providerSchema = z.enum(['x402', 'stripe'])

// Sprint 4: simulation outcomes (mirrors SimulationStatus in the SDK).
const simulationStatusSchema = z.enum([
  'ok',
  'unsupported',
  'error',
  'would_fail',
  'suspicious_balance_change',
  'suspicious_ownership_change',
])

// ISO-8601 date-time. We accept the lenient ISO 8601 superset that
// `Date(string)` parses and re-serialize before passing to PostgREST.
const isoDateSchema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Must be an ISO-8601 timestamp',
})

const listQuerySchema = z.object({
  agent_id: uuidSchema.optional(),
  event_kind: eventKindSchema.optional(),
  risk_level: riskLevelSchema.optional(),
  provider: providerSchema.optional(),
  simulation_status: simulationStatusSchema.optional(),
  occurred_after: isoDateSchema.optional(),
  occurred_before: isoDateSchema.optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).max(50_000).default(0),
})

const exportQuerySchema = listQuerySchema.extend({
  // CSV export caps higher than the dashboard list — operators occasionally
  // want a wider slice for offline analysis.
  limit: z.coerce.number().min(1).max(10_000).default(1_000),
})

// ============================================================================
// Helpers
// ============================================================================

function applyFilters<
  Q extends {
    eq: (col: string, val: unknown) => Q
    gte: (col: string, val: unknown) => Q
    lte: (col: string, val: unknown) => Q
  },
>(
  query: Q,
  filters: {
    agent_id?: string
    event_kind?: string
    risk_level?: string
    provider?: string
    simulation_status?: string
    occurred_after?: string
    occurred_before?: string
  }
): Q {
  if (filters.agent_id) query = query.eq('agent_id', filters.agent_id)
  if (filters.event_kind) query = query.eq('event_kind', filters.event_kind)
  if (filters.risk_level) query = query.eq('risk_level', filters.risk_level)
  if (filters.provider) query = query.eq('provider', filters.provider)
  // PostgREST jsonb path lookup — exercises the functional index from
  // migration 20260521030000.
  if (filters.simulation_status) {
    query = query.eq('simulation->>status', filters.simulation_status)
  }
  if (filters.occurred_after) {
    query = query.gte('occurred_at', new Date(filters.occurred_after).toISOString())
  }
  if (filters.occurred_before) {
    query = query.lte('occurred_at', new Date(filters.occurred_before).toISOString())
  }
  return query
}

/**
 * CSV escape: wrap in quotes and double any internal quote. Returns '' for
 * null/undefined to keep the column count stable.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s: string
  if (typeof value === 'object') {
    try {
      s = JSON.stringify(value)
    } catch {
      s = String(value)
    }
  } else {
    s = String(value)
  }
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const CSV_HEADERS = [
  'id',
  'occurred_at',
  'provider',
  'event_kind',
  'decision',
  'risk_level',
  'endpoint',
  'network',
  'asset',
  'pay_to',
  'amount_usd',
  'agent_id',
  'tx_signature',
  'simulation_status',
  'reasoning',
  'drainer_intel',
  'simulation',
  'gates',
] as const

function rowToCsv(row: AuditEventRow): string {
  // Surface the simulation status as its own column for quick scanning,
  // and keep the full simulation payload as a JSON cell for forensic use.
  const simulationStatus =
    row.simulation && typeof row.simulation === 'object'
      ? ((row.simulation['status'] as string | undefined) ?? '')
      : ''

  return [
    csvCell(row.id),
    csvCell(row.occurred_at),
    csvCell(row.provider),
    csvCell(row.event_kind),
    csvCell(row.decision),
    csvCell(row.risk_level),
    csvCell(row.endpoint),
    csvCell(row.network),
    csvCell(row.asset),
    csvCell(row.pay_to),
    csvCell(row.amount_usd),
    csvCell(row.agent_id),
    csvCell(row.tx_signature),
    csvCell(simulationStatus),
    csvCell(row.reasoning),
    csvCell(row.drainer_intel),
    csvCell(row.simulation),
    csvCell(row.gates),
  ].join(',')
}

// ============================================================================
// Routes
// ============================================================================

export const clawpayAuditEventsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpayAuditEventsRoutes.use('*', authMiddleware)
clawpayAuditEventsRoutes.use('*', walletRateLimitMiddleware())

/**
 * GET /clawpay/audit-events — paginated list with filters.
 */
clawpayAuditEventsRoutes.get('/audit-events', async (c) => {
  const wallet = c.get('wallet')

  const parsed = listQuerySchema.safeParse({
    agent_id: c.req.query('agent_id'),
    event_kind: c.req.query('event_kind'),
    risk_level: c.req.query('risk_level'),
    provider: c.req.query('provider'),
    simulation_status: c.req.query('simulation_status'),
    occurred_after: c.req.query('occurred_after'),
    occurred_before: c.req.query('occurred_before'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
  }
  const { limit, offset, ...filters } = parsed.data

  const supabase = await getUserClient(c.env, wallet)

  let query = supabase
    .from('clawpay_audit_events')
    .select('*', { count: 'exact' })
    .eq('wallet_address', wallet)
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  query = applyFilters(query, filters) as typeof query

  const { data, error, count } = await query

  if (error) {
    console.error('List audit events error:', error)
    return c.json({ error: 'Failed to list audit events' }, 500)
  }

  return c.json({
    events: data ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  })
})

/**
 * GET /clawpay/audit-events/export.csv — CSV download of filtered events.
 * Streams up to 10,000 rows in one response — large enough for analyst use
 * but bounded so a wallet with millions of events doesn't fill memory.
 */
clawpayAuditEventsRoutes.get('/audit-events/export.csv', async (c) => {
  const wallet = c.get('wallet')

  const parsed = exportQuerySchema.safeParse({
    agent_id: c.req.query('agent_id'),
    event_kind: c.req.query('event_kind'),
    risk_level: c.req.query('risk_level'),
    provider: c.req.query('provider'),
    simulation_status: c.req.query('simulation_status'),
    occurred_after: c.req.query('occurred_after'),
    occurred_before: c.req.query('occurred_before'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
  }
  const { limit, offset, ...filters } = parsed.data

  const supabase = await getUserClient(c.env, wallet)

  let query = supabase
    .from('clawpay_audit_events')
    .select('*')
    .eq('wallet_address', wallet)
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  query = applyFilters(query, filters) as typeof query

  const { data, error } = await query

  if (error) {
    console.error('Export audit events error:', error)
    return c.json({ error: 'Failed to export audit events' }, 500)
  }

  const rows = (data ?? []) as AuditEventRow[]
  const csv = [CSV_HEADERS.join(','), ...rows.map(rowToCsv)].join('\n')

  const filename = `clawpay-audit-${new Date().toISOString().slice(0, 10)}.csv`
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})

/**
 * GET /clawpay/audit-events/:id — single event.
 */
clawpayAuditEventsRoutes.get('/audit-events/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) {
    return c.json({ error: 'Invalid event ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('clawpay_audit_events')
    .select('*')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    console.error('Get audit event error:', error)
    return c.json({ error: 'Failed to fetch audit event' }, 500)
  }
  if (!data) {
    return c.json({ error: 'Audit event not found' }, 404)
  }

  return c.json({ event: data })
})
