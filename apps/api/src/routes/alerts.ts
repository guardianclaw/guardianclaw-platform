/**
 * Agent Alert Rules Routes
 *
 * Provides CRUD endpoints for managing per-agent alert rules and viewing alert history.
 * Alert rules allow users to define thresholds for monitoring specific agent behavior.
 *
 * NOTE: These are DISTINCT from admin-level alert_rules (platform-wide monitoring).
 * This module uses agent_alert_rules and agent_alert_history tables.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { checkUrlOrLog } from '../lib/ssrf-guard'
import { createSecureLogger } from '../lib/secure-logger'
import { getUserClient } from '../lib/supabase-client'

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

export const alertsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware
alertsRoutes.use('*', authMiddleware)
alertsRoutes.use('*', walletRateLimitMiddleware())

// Validation schemas
const uuidSchema = z.string().uuid('Invalid UUID format')

const ruleTypeSchema = z.enum([
  'error_rate',
  'latency_p95',
  'latency_p99',
  'block_rate',
  'success_rate',
  'request_volume',
])

const comparisonSchema = z.enum(['gt', 'gte', 'lt', 'lte', 'eq'])

const severitySchema = z.enum(['info', 'warning', 'critical'])

const notificationChannelSchema = z.enum(['webhook', 'slack'])

const createAlertSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rule_type: ruleTypeSchema,
  threshold: z.number().min(0),
  window_minutes: z.number().int().min(1).max(1440).default(60),
  comparison: comparisonSchema.default('gt'),
  notification_channel: notificationChannelSchema,
  notification_target: z.string().min(1).max(500),
  cooldown_minutes: z.number().int().min(0).max(1440).default(60),
  consecutive_threshold: z.number().int().min(1).default(1),
  severity: severitySchema.default('warning'),
})

const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  threshold: z.number().min(0).optional(),
  window_minutes: z.number().int().min(1).max(1440).optional(),
  comparison: comparisonSchema.optional(),
  notification_channel: notificationChannelSchema.optional(),
  notification_target: z.string().min(1).max(500).optional(),
  cooldown_minutes: z.number().int().min(0).max(1440).optional(),
  consecutive_threshold: z.number().int().min(1).optional(),
  severity: severitySchema.optional(),
  is_active: z.boolean().optional(),
})

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).max(10000).default(0),
})

/**
 * GET /agents/:agentId/alerts
 * List all alert rules for an agent
 */
alertsRoutes.get('/:agentId/alerts', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get all alert rules for this agent
  const { data: rules, error: rulesError } = await supabase
    .from('agent_alert_rules')
    .select('*')
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })

  if (rulesError) {
    console.error('Failed to get alert rules:', rulesError)
    return c.json({ error: 'Failed to fetch alert rules' }, 500)
  }

  return c.json({ rules: rules || [] })
})

/**
 * POST /agents/:agentId/alerts
 * Create a new alert rule
 */
alertsRoutes.post('/:agentId/alerts', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  // Parse and validate body
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const bodyResult = createAlertSchema.safeParse(body)
  if (!bodyResult.success) {
    return c.json({ error: 'Invalid request body', details: bodyResult.error.flatten() }, 400)
  }

  // SSRF guard: notification_target is the destination of an outbound POST
  // for both webhook and slack channels. Block private/loopback/metadata.
  {
    const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
    const urlCheck = await checkUrlOrLog(
      bodyResult.data.notification_target,
      { surface: 'alerts.create' },
      logger
    )
    if (!urlCheck.valid) {
      return c.json({ error: urlCheck.error || 'Notification target is not allowed' }, 400)
    }
  }

  const supabase = await getUserClient(c.env, wallet)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Check existing rules count (limit to 10 per agent for free tier)
  const { count, error: countError } = await supabase
    .from('agent_alert_rules')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)

  if (!countError && (count || 0) >= 10) {
    return c.json({ error: 'Maximum alert rules limit reached (10 per agent)' }, 400)
  }

  // Create the alert rule
  const { data: rule, error: createError } = await supabase
    .from('agent_alert_rules')
    .insert({
      agent_id: agentId,
      wallet_address: wallet,
      ...bodyResult.data,
    })
    .select()
    .single()

  if (createError) {
    console.error('Failed to create alert rule:', createError)
    return c.json({ error: 'Failed to create alert rule' }, 500)
  }

  return c.json({ rule }, 201)
})

/**
 * GET /agents/:agentId/alerts/:alertId
 * Get a single alert rule
 */
alertsRoutes.get('/:agentId/alerts/:alertId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const alertId = c.req.param('alertId')

  // Validate UUIDs
  const agentIdResult = uuidSchema.safeParse(agentId)
  const alertIdResult = uuidSchema.safeParse(alertId)
  if (!agentIdResult.success || !alertIdResult.success) {
    return c.json({ error: 'Invalid ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Get the alert rule (ownership verified via wallet_address)
  const { data: rule, error: ruleError } = await supabase
    .from('agent_alert_rules')
    .select('*')
    .eq('id', alertId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (ruleError || !rule) {
    return c.json({ error: 'Alert rule not found' }, 404)
  }

  return c.json({ rule })
})

/**
 * PATCH /agents/:agentId/alerts/:alertId
 * Update an alert rule
 */
alertsRoutes.patch('/:agentId/alerts/:alertId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const alertId = c.req.param('alertId')

  // Validate UUIDs
  const agentIdResult = uuidSchema.safeParse(agentId)
  const alertIdResult = uuidSchema.safeParse(alertId)
  if (!agentIdResult.success || !alertIdResult.success) {
    return c.json({ error: 'Invalid ID format' }, 400)
  }

  // Parse and validate body
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const bodyResult = updateAlertSchema.safeParse(body)
  if (!bodyResult.success) {
    return c.json({ error: 'Invalid request body', details: bodyResult.error.flatten() }, 400)
  }

  // Check if there are any updates
  if (Object.keys(bodyResult.data).length === 0) {
    return c.json({ error: 'No updates provided' }, 400)
  }

  // SSRF guard on notification_target update (when caller is changing it)
  if (bodyResult.data.notification_target !== undefined) {
    const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
    const urlCheck = await checkUrlOrLog(
      bodyResult.data.notification_target,
      { surface: 'alerts.update' },
      logger
    )
    if (!urlCheck.valid) {
      return c.json({ error: urlCheck.error || 'Notification target is not allowed' }, 400)
    }
  }

  const supabase = await getUserClient(c.env, wallet)

  // Update the alert rule
  const { data: rule, error: updateError } = await supabase
    .from('agent_alert_rules')
    .update(bodyResult.data)
    .eq('id', alertId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .select()
    .single()

  if (updateError) {
    if (updateError.code === 'PGRST116') {
      return c.json({ error: 'Alert rule not found' }, 404)
    }
    console.error('Failed to update alert rule:', updateError)
    return c.json({ error: 'Failed to update alert rule' }, 500)
  }

  return c.json({ rule })
})

/**
 * DELETE /agents/:agentId/alerts/:alertId
 * Delete an alert rule
 */
alertsRoutes.delete('/:agentId/alerts/:alertId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const alertId = c.req.param('alertId')

  // Validate UUIDs
  const agentIdResult = uuidSchema.safeParse(agentId)
  const alertIdResult = uuidSchema.safeParse(alertId)
  if (!agentIdResult.success || !alertIdResult.success) {
    return c.json({ error: 'Invalid ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Delete the alert rule (cascade will delete history)
  const { error: deleteError } = await supabase
    .from('agent_alert_rules')
    .delete()
    .eq('id', alertId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)

  if (deleteError) {
    console.error('Failed to delete alert rule:', deleteError)
    return c.json({ error: 'Failed to delete alert rule' }, 500)
  }

  return c.json({ success: true })
})

/**
 * GET /agents/:agentId/alerts/:alertId/history
 * Get alert trigger history
 */
alertsRoutes.get('/:agentId/alerts/:alertId/history', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const alertId = c.req.param('alertId')

  // Validate UUIDs
  const agentIdResult = uuidSchema.safeParse(agentId)
  const alertIdResult = uuidSchema.safeParse(alertId)
  if (!agentIdResult.success || !alertIdResult.success) {
    return c.json({ error: 'Invalid ID format' }, 400)
  }

  // Parse query params
  const queryResult = historyQuerySchema.safeParse(c.req.query())
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, 400)
  }

  const { limit, offset } = queryResult.data

  const supabase = await getUserClient(c.env, wallet)

  // First verify ownership via alert_rules
  const { data: rule, error: ruleError } = await supabase
    .from('agent_alert_rules')
    .select('id')
    .eq('id', alertId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (ruleError || !rule) {
    return c.json({ error: 'Alert rule not found' }, 404)
  }

  // Get history
  const {
    data: history,
    error: historyError,
    count,
  } = await supabase
    .from('agent_alert_history')
    .select('*', { count: 'exact' })
    .eq('alert_rule_id', alertId)
    .order('triggered_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (historyError) {
    console.error('Failed to get alert history:', historyError)
    return c.json({ error: 'Failed to fetch alert history' }, 500)
  }

  return c.json({
    history: history || [],
    total: count || 0,
    limit,
    offset,
  })
})

/**
 * POST /agents/:agentId/alerts/:alertId/test
 * Test an alert rule by sending a test notification
 */
alertsRoutes.post('/:agentId/alerts/:alertId/test', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const alertId = c.req.param('alertId')

  // Validate UUIDs
  const agentIdResult = uuidSchema.safeParse(agentId)
  const alertIdResult = uuidSchema.safeParse(alertId)
  if (!agentIdResult.success || !alertIdResult.success) {
    return c.json({ error: 'Invalid ID format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Get the alert rule
  const { data: rule, error: ruleError } = await supabase
    .from('agent_alert_rules')
    .select('*')
    .eq('id', alertId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (ruleError || !rule) {
    return c.json({ error: 'Alert rule not found' }, 404)
  }

  // SSRF guard: even though notification_target was set by the user via
  // create/update earlier, re-validate at every fetch boundary so a row
  // mutated outside the schema layer cannot drive an internal request.
  const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
  const urlCheck = await checkUrlOrLog(
    rule.notification_target,
    { surface: 'alerts.test' },
    logger
  )
  if (!urlCheck.valid) {
    return c.json(
      {
        success: false,
        error: urlCheck.error || 'Notification target is not allowed',
        notification_channel: rule.notification_channel,
        notification_target: '[hidden]',
      },
      400
    )
  }

  // Send test notification based on channel
  let success = false
  let error: string | null = null

  try {
    if (rule.notification_channel === 'webhook') {
      const response = await fetch(rule.notification_target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'alert_test',
          alert_id: alertId,
          agent_id: agentId,
          rule_name: rule.name,
          message: 'This is a test notification from GuardianClaw',
          timestamp: new Date().toISOString(),
        }),
      })
      success = response.ok
      if (!success) {
        error = `Webhook returned status ${response.status}`
      }
    } else if (rule.notification_channel === 'slack') {
      const response = await fetch(rule.notification_target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🧪 *Test Alert* - ${rule.name}\nThis is a test notification from GuardianClaw.\nAgent: \`${agentId}\``,
        }),
      })
      success = response.ok
      if (!success) {
        error = `Slack webhook returned status ${response.status}`
      }
    }
  } catch (err) {
    success = false
    error = err instanceof Error ? err.message : 'Unknown error'
  }

  return c.json({
    success,
    error,
    notification_channel: rule.notification_channel,
    notification_target: '[hidden]',
  })
})
