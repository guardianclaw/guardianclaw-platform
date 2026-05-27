/**
 * ClawPay Alerts Routes (Sprint 2)
 *
 * Wallet-scoped CRUD for `clawpay_alerts` + delivery history view + a manual
 * test-trigger endpoint.
 *
 * Notification target is a webhook URL. Each write passes through the SSRF
 * guard before being stored to prevent private-network / metadata-service
 * exfiltration. HMAC signing of delivered payloads is intentionally deferred
 * to Sprint 2 Phase F (audit pipeline integration) — the schema already has
 * a `notification_secret_hash` column reserved for it.
 *
 * Routes:
 *   GET    /clawpay/alerts                       List alerts
 *   POST   /clawpay/alerts                       Create alert (SSRF-checked)
 *   GET    /clawpay/alerts/:id                   Get one alert
 *   PATCH  /clawpay/alerts/:id                   Update alert
 *   DELETE /clawpay/alerts/:id                   Delete alert (CASCADEs deliveries)
 *   POST   /clawpay/alerts/:id/test              Fire a one-off test delivery
 *   GET    /clawpay/alerts/:id/deliveries        Delivery history (paginated)
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getUserClient } from '../lib/supabase-client'
import { checkUrlOrLog } from '../lib/ssrf-guard'
import { createSecureLogger } from '../lib/secure-logger'

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

// Trigger condition is intentionally flexible JSON — the alert engine
// interprets it. We only enforce shape (object with a `kind` string) here;
// deeper validation lives wherever the engine is implemented.
const conditionSchema = z
  .object({
    kind: z.string().min(1).max(64),
  })
  .passthrough()

const urlSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v), {
    message: 'notification_target must be an http:// or https:// URL',
  })

const createAlertSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  agent_id: uuidSchema.nullable().optional(),
  condition: conditionSchema,
  notification_target: urlSchema,
  cooldown_seconds: z.number().int().min(0).max(86_400).optional().default(60),
  metadata: z.record(z.unknown()).optional(),
})

const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  agent_id: uuidSchema.nullable().optional(),
  condition: conditionSchema.optional(),
  notification_target: urlSchema.optional(),
  cooldown_seconds: z.number().int().min(0).max(86_400).optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const listQuerySchema = z.object({
  agent_id: uuidSchema.optional(),
  active: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(200).default(100),
  offset: z.coerce.number().min(0).max(10_000).default(0),
})

const deliveriesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).max(10_000).default(0),
})

// ============================================================================
// Helpers
// ============================================================================

async function verifyAgentOwnership(
  supabase: Awaited<ReturnType<typeof getUserClient>>,
  wallet: string,
  agentId: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  if (!agentId) return { ok: true }
  const idCheck = uuidSchema.safeParse(agentId)
  if (!idCheck.success) return { ok: false, status: 400, error: 'Invalid agent_id format' }

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
  if (!data) return { ok: false, status: 404, error: 'Agent not found' }
  return { ok: true }
}

async function validateNotificationTarget(
  url: string,
  env: Bindings,
  surface: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const logger = createSecureLogger({ IP_HASH_SECRET: env.IP_HASH_SECRET })
  const check = await checkUrlOrLog(url, { surface }, logger)
  if (!check.valid) {
    return { ok: false, error: check.error || 'Notification target is not allowed' }
  }
  return { ok: true }
}

// ============================================================================
// Routes
// ============================================================================

export const clawpayAlertsRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpayAlertsRoutes.use('*', authMiddleware)
clawpayAlertsRoutes.use('*', walletRateLimitMiddleware())

/**
 * GET /clawpay/alerts
 */
clawpayAlertsRoutes.get('/alerts', async (c) => {
  const wallet = c.get('wallet')

  const parsed = listQuerySchema.safeParse({
    agent_id: c.req.query('agent_id'),
    active: c.req.query('active'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
  }
  const { agent_id, active, limit, offset } = parsed.data

  const supabase = await getUserClient(c.env, wallet)

  let query = supabase
    .from('clawpay_alerts')
    .select('*', { count: 'exact' })
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (agent_id) query = query.eq('agent_id', agent_id)
  if (active !== undefined) query = query.eq('active', active)

  const { data, error, count } = await query

  if (error) {
    console.error('List alerts error:', error)
    return c.json({ error: 'Failed to list alerts' }, 500)
  }

  return c.json({
    alerts: data ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  })
})

/**
 * POST /clawpay/alerts
 */
clawpayAlertsRoutes.post('/alerts', async (c) => {
  const wallet = c.get('wallet')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = createAlertSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)
  }

  const ssrf = await validateNotificationTarget(
    parsed.data.notification_target,
    c.env,
    'clawpay-alerts.create'
  )
  if (!ssrf.ok) return c.json({ error: ssrf.error }, 400)

  const supabase = await getUserClient(c.env, wallet)

  const ownership = await verifyAgentOwnership(supabase, wallet, parsed.data.agent_id)
  if (!ownership.ok) return c.json({ error: ownership.error }, ownership.status)

  const { data, error } = await supabase
    .from('clawpay_alerts')
    .insert({
      wallet_address: wallet,
      agent_id: parsed.data.agent_id ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      condition: parsed.data.condition,
      notification_target: parsed.data.notification_target,
      cooldown_seconds: parsed.data.cooldown_seconds,
      metadata: parsed.data.metadata ?? {},
    })
    .select()
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return c.json({ error: 'An alert with that name already exists for this wallet' }, 409)
    }
    console.error('Create alert error:', error)
    return c.json({ error: 'Failed to create alert' }, 500)
  }

  return c.json({ alert: data }, 201)
})

/**
 * GET /clawpay/alerts/:id
 */
clawpayAlertsRoutes.get('/alerts/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) return c.json({ error: 'Invalid alert ID format' }, 400)

  const supabase = await getUserClient(c.env, wallet)
  const { data, error } = await supabase
    .from('clawpay_alerts')
    .select('*')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    console.error('Get alert error:', error)
    return c.json({ error: 'Failed to fetch alert' }, 500)
  }
  if (!data) return c.json({ error: 'Alert not found' }, 404)

  return c.json({ alert: data })
})

/**
 * PATCH /clawpay/alerts/:id
 */
clawpayAlertsRoutes.patch('/alerts/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) return c.json({ error: 'Invalid alert ID format' }, 400)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = updateAlertSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)
  }
  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: 'Empty update — provide at least one field' }, 400)
  }

  if (parsed.data.notification_target) {
    const ssrf = await validateNotificationTarget(
      parsed.data.notification_target,
      c.env,
      'clawpay-alerts.update'
    )
    if (!ssrf.ok) return c.json({ error: ssrf.error }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  if (parsed.data.agent_id !== undefined) {
    const ownership = await verifyAgentOwnership(supabase, wallet, parsed.data.agent_id)
    if (!ownership.ok) return c.json({ error: ownership.error }, ownership.status)
  }

  const { data, error } = await supabase
    .from('clawpay_alerts')
    .update(parsed.data)
    .eq('id', id)
    .eq('wallet_address', wallet)
    .select()
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return c.json({ error: 'Update would collide with an existing alert name' }, 409)
    }
    console.error('Update alert error:', error)
    return c.json({ error: 'Failed to update alert' }, 500)
  }
  if (!data) return c.json({ error: 'Alert not found' }, 404)

  return c.json({ alert: data })
})

/**
 * DELETE /clawpay/alerts/:id
 *
 * Hard delete. CASCADEs delete to clawpay_alert_deliveries via the FK in the
 * migration. Use PATCH active=false if you only want to disable.
 */
clawpayAlertsRoutes.delete('/alerts/:id', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) return c.json({ error: 'Invalid alert ID format' }, 400)

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('clawpay_alerts')
    .delete()
    .eq('id', id)
    .eq('wallet_address', wallet)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Delete alert error:', error)
    return c.json({ error: 'Failed to delete alert' }, 500)
  }
  if (!data) return c.json({ error: 'Alert not found' }, 404)

  return c.json({ success: true, id: data.id })
})

/**
 * POST /clawpay/alerts/:id/test
 *
 * Fires a one-off webhook to the alert's notification_target and records the
 * outcome in clawpay_alert_deliveries. Useful when configuring a new alert to
 * confirm the destination is reachable and trusted.
 *
 * The fetch is fenced by an AbortController on a 10-second timeout. The
 * response body is read up to 1KB and stored as a snippet (full body never
 * persisted — an adversarial listener cannot fill the table).
 */
clawpayAlertsRoutes.post('/alerts/:id/test', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) return c.json({ error: 'Invalid alert ID format' }, 400)

  const supabase = await getUserClient(c.env, wallet)

  const { data: alert, error: fetchError } = await supabase
    .from('clawpay_alerts')
    .select('id, notification_target, active, name')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (fetchError) {
    console.error('Test alert fetch error:', fetchError)
    return c.json({ error: 'Failed to load alert' }, 500)
  }
  if (!alert) return c.json({ error: 'Alert not found' }, 404)

  // Re-validate SSRF: a rule may have been created before a guard tightening,
  // or a hostname's resolved IP could now point at private space.
  const ssrf = await validateNotificationTarget(
    alert.notification_target,
    c.env,
    'clawpay-alerts.test'
  )
  if (!ssrf.ok) {
    // Still log the attempt so the dashboard reflects the failure.
    await supabase.from('clawpay_alert_deliveries').insert({
      alert_id: alert.id,
      wallet_address: wallet,
      status: 'failed',
      error: ssrf.error,
      attempt: 1,
    })
    return c.json({ error: ssrf.error }, 400)
  }

  const payload = {
    event_type: 'clawpay.alert.test',
    alert_id: alert.id,
    alert_name: alert.name,
    timestamp: new Date().toISOString(),
    message: 'Test delivery from GuardianClaw ClawPay',
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let httpStatus: number | null = null
  let responseSnippet: string | null = null
  let errorText: string | null = null
  let status: 'delivered' | 'failed' = 'failed'

  try {
    const res = await fetch(alert.notification_target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GuardianClaw-ClawPay/1.0 (alert-test)',
        'X-GuardianClaw-Event': 'clawpay.alert.test',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    httpStatus = res.status
    // Read up to 1KB of the body. Anything beyond is truncated.
    const buf = await res.arrayBuffer()
    const slice = buf.byteLength > 1024 ? buf.slice(0, 1024) : buf
    responseSnippet = new TextDecoder('utf-8', { fatal: false }).decode(slice)
    status = res.ok ? 'delivered' : 'failed'
  } catch (err) {
    errorText = err instanceof Error ? err.message : String(err)
  } finally {
    clearTimeout(timeout)
  }

  const { data: delivery, error: deliveryError } = await supabase
    .from('clawpay_alert_deliveries')
    .insert({
      alert_id: alert.id,
      wallet_address: wallet,
      status,
      http_status: httpStatus,
      response_body_snippet: responseSnippet,
      error: errorText,
      attempt: 1,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (deliveryError) {
    console.error('Test delivery record error:', deliveryError)
    return c.json({ error: 'Webhook fired but delivery record failed' }, 500)
  }

  return c.json(
    {
      delivery,
      tested: true,
      http_status: httpStatus,
      status,
    },
    status === 'delivered' ? 200 : 502
  )
})

/**
 * GET /clawpay/alerts/:id/deliveries
 */
clawpayAlertsRoutes.get('/alerts/:id/deliveries', async (c) => {
  const wallet = c.get('wallet')
  const id = c.req.param('id')

  const idCheck = uuidSchema.safeParse(id)
  if (!idCheck.success) return c.json({ error: 'Invalid alert ID format' }, 400)

  const parsed = deliveriesQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!parsed.success) {
    return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
  }
  const { limit, offset } = parsed.data

  const supabase = await getUserClient(c.env, wallet)

  // Defense-in-depth: confirm the alert belongs to the caller before listing
  // deliveries. RLS already enforces this via wallet_address but the explicit
  // check produces a clearer 404 than an empty list.
  const { data: alert, error: alertError } = await supabase
    .from('clawpay_alerts')
    .select('id')
    .eq('id', id)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (alertError) {
    console.error('Deliveries — alert lookup error:', alertError)
    return c.json({ error: 'Failed to load alert' }, 500)
  }
  if (!alert) return c.json({ error: 'Alert not found' }, 404)

  const { data, error, count } = await supabase
    .from('clawpay_alert_deliveries')
    .select('*', { count: 'exact' })
    .eq('alert_id', id)
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('List deliveries error:', error)
    return c.json({ error: 'Failed to list deliveries' }, 500)
  }

  return c.json({
    deliveries: data ?? [],
    pagination: { limit, offset, total: count ?? 0 },
  })
})
