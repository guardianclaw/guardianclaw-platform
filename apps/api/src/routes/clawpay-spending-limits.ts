/**
 * ClawPay Spending Limits Routes (Sprint 2)
 *
 * Wallet-scoped CRUD for `clawpay_spending_limits`. A limit is a configurable
 * USD cap on payments approved by the ClawPay LimitsGate over a rolling
 * window (hourly / daily / weekly / monthly / lifetime).
 *
 * Slot identity is (wallet, agent_id, name, period) — the dashboard treats
 * an update on the same slot as editing an existing rule rather than
 * stacking duplicates. The migration enforces this with a partial unique
 * index on active rows.
 *
 * Routes:
 *   GET    /clawpay/spending-limits           List all limits for the caller
 *   POST   /clawpay/spending-limits           Create a new limit
 *   GET    /clawpay/spending-limits/:id       Get one limit
 *   PATCH  /clawpay/spending-limits/:id       Update a limit
 *   DELETE /clawpay/spending-limits/:id       Soft-delete (active=false)
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

// ============================================================================
// Validation schemas
// ============================================================================

const uuidSchema = z.string().uuid('Invalid UUID format')

const periodSchema = z.enum(['hourly', 'daily', 'weekly', 'monthly', 'lifetime'])

// limit_usd uses up to 6 decimals (matches numeric(18,6) in the migration),
// capped at $1M to bound a single-record blast radius even if the dashboard
// is misused. Operators can raise the cap by editing this enum if needed.
const limitUsdSchema = z
  .number()
  .positive('limit_usd must be positive')
  .max(1_000_000, 'limit_usd cap is $1,000,000 per single rule')
  .multipleOf(0.000001, 'limit_usd resolution is 6 decimals')

const createLimitSchema = z.object({
  name: z.string().min(1).max(100),
  period: periodSchema,
  limit_usd: limitUsdSchema,
  agent_id: uuidSchema.nullable().optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const updateLimitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  period: periodSchema.optional(),
  limit_usd: limitUsdSchema.optional(),
  description: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
})

const listQuerySchema = z.object({
  agent_id: uuidSchema.optional(),
  // include_inactive=true shows soft-deleted rules too. Default is active-only
  // to mirror the validator's working set.
  include_inactive: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().min(1).max(200).default(100),
  offset: z.coerce.number().min(0).max(10_000).default(0),
})

// ============================================================================
// Helpers
// ============================================================================

/**
 * Verify the caller owns the agent (or accept null for wallet-wide limits).
 * Defense-in-depth on top of RLS — the wallet_address column is enforced by
 * jwt_wallet_address() at the DB layer.
 */
async function verifyAgentOwnership(
  supabase: Awaited<ReturnType<typeof getUserClient>>,
  wallet: string,
  agentId: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  if (!agentId) return { ok: true } // wallet-wide limit, no agent check needed

  const idCheck = uuidSchema.safeParse(agentId)
  if (!idCheck.success) {
    return { ok: false, status: 400, error: 'Invalid agent_id format' }
  }

  const { data, error } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    console.error('Agent ownership check failed:', error)
    return { ok: false, status: 404, error: 'Agent not found' }
  }
  if (!data) {
    return { ok: false, status: 404, error: 'Agent not found' }
  }
  return { ok: true }
}

// ============================================================================
// Routes
// ============================================================================

export const clawpaySpendingLimitsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpaySpendingLimitsRoutes.use('*', authMiddleware)
clawpaySpendingLimitsRoutes.use('*', walletRateLimitMiddleware())

/**
 * GET /clawpay/spending-limits — list limits for the caller's wallet.
 */
clawpaySpendingLimitsRoutes.get('/spending-limits', async (c) => {
  const wallet = c.get('wallet')

  const queryResult = listQuerySchema.safeParse({
    agent_id: c.req.query('agent_id'),
    include_inactive: c.req.query('include_inactive'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query', details: queryResult.error.flatten() }, 400)
  }
  const { agent_id, include_inactive, limit, offset } = queryResult.data

  const supabase = await getUserClient(c.env, wallet)

  let query = supabase
    .from('clawpay_spending_limits')
    .select('*', { count: 'exact' })
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (agent_id) query = query.eq('agent_id', agent_id)
  if (!include_inactive) query = query.eq('active', true)

  const { data, error, count } = await query

  if (error) {
    console.error('List spending limits error:', error)
    return c.json({ error: 'Failed to list spending limits' }, 500)
  }

  return c.json({
    limits: data ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  })
})

/**
 * POST /clawpay/spending-limits — create a new limit.
 */
clawpaySpendingLimitsRoutes.post('/spending-limits', async (c) => {
  const wallet = c.get('wallet')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = createLimitSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const ownership = await verifyAgentOwnership(supabase, wallet, parsed.data.agent_id)
  if (!ownership.ok) {
    return c.json({ error: ownership.error }, ownership.status)
  }

  const { data, error } = await supabase
    .from('clawpay_spending_limits')
    .insert({
      wallet_address: wallet,
      agent_id: parsed.data.agent_id ?? null,
      name: parsed.data.name,
      period: parsed.data.period,
      limit_usd: parsed.data.limit_usd,
      description: parsed.data.description ?? null,
      metadata: parsed.data.metadata ?? {},
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation on the partial active-slot index.
    if ((error as { code?: string }).code === '23505') {
      return c.json(
        {
          error: 'A limit with that (agent_id, name, period) is already active',
          hint: 'PATCH the existing limit instead of creating a duplicate, or use a different name/period.',
        },
        409
      )
    }
    console.error('Create spending limit error:', error)
    return c.json({ error: 'Failed to create spending limit' }, 500)
  }

  return c.json({ limit: data }, 201)
})

/**
 * GET /clawpay/spending-limits/:id — fetch one limit.
 */
clawpaySpendingLimitsRoutes.get('/spending-limits/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) {
    return c.json({ error: 'Invalid limit ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('clawpay_spending_limits')
    .select('*')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    console.error('Get spending limit error:', error)
    return c.json({ error: 'Failed to fetch spending limit' }, 500)
  }
  if (!data) {
    return c.json({ error: 'Spending limit not found' }, 404)
  }

  return c.json({ limit: data })
})

/**
 * PATCH /clawpay/spending-limits/:id — partial update.
 */
clawpaySpendingLimitsRoutes.patch('/spending-limits/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) {
    return c.json({ error: 'Invalid limit ID format' }, 400)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = updateLimitSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)
  }
  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: 'Empty update — provide at least one field' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('clawpay_spending_limits')
    .update(parsed.data)
    .eq('id', id)
    .eq('wallet_address', wallet)
    .select()
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return c.json(
        {
          error:
            'Update would collide with another active limit on the same (agent_id, name, period) slot',
        },
        409
      )
    }
    console.error('Update spending limit error:', error)
    return c.json({ error: 'Failed to update spending limit' }, 500)
  }
  if (!data) {
    return c.json({ error: 'Spending limit not found' }, 404)
  }

  return c.json({ limit: data })
})

/**
 * DELETE /clawpay/spending-limits/:id — soft-delete (active=false).
 *
 * We keep the row so historical audit_events that reference this limit can
 * still resolve its config. Operators who genuinely need a hard delete can
 * use the admin route (not exposed in Sprint 2).
 */
clawpaySpendingLimitsRoutes.delete('/spending-limits/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) {
    return c.json({ error: 'Invalid limit ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('clawpay_spending_limits')
    .update({ active: false })
    .eq('id', id)
    .eq('wallet_address', wallet)
    .eq('active', true) // idempotent on already-soft-deleted rows
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Soft-delete spending limit error:', error)
    return c.json({ error: 'Failed to delete spending limit' }, 500)
  }
  if (!data) {
    return c.json({ error: 'Spending limit not found or already inactive' }, 404)
  }

  return c.json({ success: true, id: data.id })
})
