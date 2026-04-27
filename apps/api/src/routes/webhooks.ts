/**
 * Webhook Routes
 *
 * Manages webhook triggers for external system integration.
 * Allows external systems (Discord, Telegram, Slack, custom apps)
 * to trigger agent execution via HTTP POST with HMAC signature.
 *
 * Routes:
 * - POST   /agents/:agentId/webhooks          Create webhook
 * - GET    /agents/:agentId/webhooks          List webhooks
 * - GET    /agents/:agentId/webhooks/:id      Get webhook details
 * - PATCH  /agents/:agentId/webhooks/:id      Update webhook
 * - DELETE /agents/:agentId/webhooks/:id      Delete webhook
 * - POST   /agents/:agentId/webhooks/:id/regenerate  Regenerate secret
 *
 * Public (no JWT auth, uses HMAC):
 * - POST   /webhooks/:webhookId/trigger       Trigger agent execution
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getServiceClient, getUserClient } from '../lib/supabase-client'
import {
  generateWebhookSecret,
  verifyWebhookSignature,
  parseWebhookHeaders,
  validateAllowedIP,
  WEBHOOK_HEADERS,
} from '../lib/webhook-signature'
import { encryptNewWebhookSecret, decryptWebhookSecret } from '../lib/webhook-crypto'
import { createSecureLogger } from '../lib/secure-logger'
import { createRateLimiter } from '../lib/rate-limiter'
import { execute, extractAnalyticsFields, type ExecutionOptions } from '../services/execution'
import { logExecution } from '../services/execution-logger'
import { queueDeliveriesForAgent, type DeliveryEventType } from '../services/webhook-delivery'

// ============================================
// TYPES
// ============================================

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
  MODAL_RUNTIME_URL?: string
  OPENAI_API_KEY?: string
  API_BASE_URL?: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100).default('Default Webhook'),
  rate_limit: z.number().int().min(1).max(1000).default(60),
  allowed_ips: z.array(z.string()).max(50).default([]),
  pass_metadata: z.boolean().default(true),
})

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
  rate_limit: z.number().int().min(1).max(1000).optional(),
  allowed_ips: z.array(z.string()).max(50).optional(),
  pass_metadata: z.boolean().optional(),
})

const triggerWebhookSchema = z.object({
  message: z.string().min(1).max(10000),
  metadata: z.record(z.unknown()).optional(),
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP from request headers (Cloudflare-aware).
 */
function getClientIP(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Verify agent ownership for a wallet address.
 */
async function verifyAgentOwnership(
  supabase: SupabaseClient,
  agentId: string,
  wallet: string
): Promise<{ agent: unknown; error?: string }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, wallet_address, status, flow, config, claw_config')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return { agent: null, error: 'Agent not found or access denied' }
  }

  return { agent }
}

// ============================================
// AUTHENTICATED ROUTES (Webhook Management)
// ============================================

export const webhookRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * POST /agents/:agentId/webhooks - Create a new webhook
 */
webhookRoutes.post(
  '/agents/:agentId/webhooks',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const wallet = c.get('wallet')

    const supabase = await getUserClient(c.env, wallet)

    // Verify agent ownership
    const { agent: _agent, error: agentError } = await verifyAgentOwnership(
      supabase,
      agentId,
      wallet
    )
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = createWebhookSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    const { name, rate_limit, allowed_ips, pass_metadata } = parsed.data

    // Check webhook limit (max 10 active webhooks per agent)
    const { count } = await supabase
      .from('webhooks')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('is_active', true)

    if ((count || 0) >= 10) {
      return c.json(
        { error: 'Maximum 10 active webhooks per agent. Delete unused webhooks first.' },
        403
      )
    }

    // Generate webhook secret and encrypt for storage
    const secret = generateWebhookSecret()
    const { encrypted, iv, prefix } = await encryptNewWebhookSecret(secret, c.env.JWT_SECRET)

    // Insert webhook record
    const { data: webhook, error: insertError } = await supabase
      .from('webhooks')
      .insert({
        agent_id: agentId,
        name,
        secret_encrypted: encrypted,
        secret_iv: iv,
        secret_prefix: prefix,
        rate_limit,
        allowed_ips,
        pass_metadata,
        is_active: true,
      })
      .select(
        'id, name, secret_prefix, is_active, rate_limit, allowed_ips, pass_metadata, created_at'
      )
      .single()

    if (insertError || !webhook) {
      console.error('Webhook creation error:', insertError)
      return c.json({ error: 'Failed to create webhook' }, 500)
    }

    // Build trigger URL
    const apiBaseUrl = c.env.API_BASE_URL || 'https://api.guardianclaw.org'
    const triggerUrl = `${apiBaseUrl}/webhooks/${webhook.id}/trigger`

    return c.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        trigger_url: triggerUrl,
        secret: secret, // Only shown once!
        secret_prefix: webhook.secret_prefix,
        is_active: webhook.is_active,
        rate_limit: webhook.rate_limit,
        allowed_ips: webhook.allowed_ips,
        pass_metadata: webhook.pass_metadata,
        created_at: webhook.created_at,
      },
      message: 'Webhook created. Save the secret - it will only be shown once.',
    })
  }
)

/**
 * GET /agents/:agentId/webhooks - List webhooks for an agent
 */
webhookRoutes.get(
  '/agents/:agentId/webhooks',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const wallet = c.get('wallet')

    const supabase = await getUserClient(c.env, wallet)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Get webhooks
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select(
        `
        id,
        name,
        secret_prefix,
        is_active,
        rate_limit,
        allowed_ips,
        pass_metadata,
        trigger_count,
        last_triggered_at,
        last_error_at,
        created_at,
        updated_at
      `
      )
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Webhook list error:', error)
      return c.json({ error: 'Failed to list webhooks' }, 500)
    }

    // Build trigger URLs
    const apiBaseUrl = c.env.API_BASE_URL || 'https://api.guardianclaw.org'
    const webhooksWithUrls = (webhooks || []).map((wh) => ({
      ...wh,
      trigger_url: `${apiBaseUrl}/webhooks/${wh.id}/trigger`,
    }))

    return c.json({
      webhooks: webhooksWithUrls,
      count: webhooksWithUrls.length,
    })
  }
)

/**
 * GET /agents/:agentId/webhooks/:id - Get webhook details
 */
webhookRoutes.get(
  '/agents/:agentId/webhooks/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const webhookId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = await getUserClient(c.env, wallet)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Get webhook
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select(
        `
        id,
        name,
        secret_prefix,
        is_active,
        rate_limit,
        allowed_ips,
        pass_metadata,
        trigger_count,
        last_triggered_at,
        last_error_at,
        created_at,
        updated_at
      `
      )
      .eq('id', webhookId)
      .eq('agent_id', agentId)
      .single()

    if (error || !webhook) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    // Build trigger URL
    const apiBaseUrl = c.env.API_BASE_URL || 'https://api.guardianclaw.org'

    return c.json({
      webhook: {
        ...webhook,
        trigger_url: `${apiBaseUrl}/webhooks/${webhook.id}/trigger`,
      },
    })
  }
)

/**
 * PATCH /agents/:agentId/webhooks/:id - Update webhook
 */
webhookRoutes.patch(
  '/agents/:agentId/webhooks/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const webhookId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = await getUserClient(c.env, wallet)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = updateWebhookSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    // Update webhook
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .update(parsed.data)
      .eq('id', webhookId)
      .eq('agent_id', agentId)
      .select(
        `
        id,
        name,
        secret_prefix,
        is_active,
        rate_limit,
        allowed_ips,
        pass_metadata,
        updated_at
      `
      )
      .single()

    if (error || !webhook) {
      return c.json({ error: 'Webhook not found or update failed' }, 404)
    }

    return c.json({
      success: true,
      webhook,
    })
  }
)

/**
 * DELETE /agents/:agentId/webhooks/:id - Delete webhook
 */
webhookRoutes.delete(
  '/agents/:agentId/webhooks/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const webhookId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = await getUserClient(c.env, wallet)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Delete webhook
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('agent_id', agentId)

    if (error) {
      console.error('Webhook deletion error:', error)
      return c.json({ error: 'Failed to delete webhook' }, 500)
    }

    return c.json({
      success: true,
      message: 'Webhook deleted',
    })
  }
)

/**
 * POST /agents/:agentId/webhooks/:id/regenerate - Regenerate webhook secret
 */
webhookRoutes.post(
  '/agents/:agentId/webhooks/:id/regenerate',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const webhookId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = await getUserClient(c.env, wallet)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Generate new secret and encrypt for storage
    const secret = generateWebhookSecret()
    const { encrypted, iv, prefix } = await encryptNewWebhookSecret(secret, c.env.JWT_SECRET)

    // Update webhook with new secret and track rotation
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .update({
        secret_encrypted: encrypted,
        secret_iv: iv,
        secret_prefix: prefix,
        rotated_at: new Date().toISOString(),
      })
      .eq('id', webhookId)
      .eq('agent_id', agentId)
      .select('id, name, secret_prefix')
      .single()

    if (error || !webhook) {
      return c.json({ error: 'Webhook not found or update failed' }, 404)
    }

    return c.json({
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        secret: secret, // Only shown once!
        secret_prefix: webhook.secret_prefix,
      },
      message: 'Secret regenerated. Save the new secret - it will only be shown once.',
    })
  }
)

// ============================================
// PUBLIC ROUTES (Webhook Trigger)
// ============================================

export const webhookTriggerRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * POST /webhooks/:webhookId/trigger - Public webhook trigger
 *
 * Authentication: HMAC-SHA256 signature (not JWT)
 * Headers required:
 * - X-Webhook-Signature: sha256=<signature>
 * - X-Webhook-Timestamp: <unix_timestamp>
 */
webhookTriggerRoutes.post('/:webhookId/trigger', async (c) => {
  const webhookId = c.req.param('webhookId')
  const clientIP = getClientIP(c.req.raw.headers)
  const startTime = Date.now()

  // Public endpoint authenticated by HMAC signature, not by a user JWT.
  // No wallet context exists here, so the user-scoped RLS path doesn't apply
  // — service-role is the right boundary for this surface.
  const supabase = getServiceClient(c.env)
  const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })

  // 1. Get raw body for signature verification
  const rawBody = await c.req.text()

  // 2. Parse signature headers
  const headerData = parseWebhookHeaders(c.req.raw.headers)
  if (!headerData) {
    await logger.security('webhook_trigger_missing_headers', { webhookId }, clientIP)
    return c.json(
      {
        error: 'Missing webhook signature headers',
        hint: `Required headers: ${WEBHOOK_HEADERS.SIGNATURE}, ${WEBHOOK_HEADERS.TIMESTAMP}`,
      },
      401
    )
  }

  const { signature, timestamp } = headerData

  // 3. Get webhook and its encrypted secret
  const { data: webhook, error: webhookError } = await supabase
    .from('webhooks')
    .select(
      `
      id,
      agent_id,
      secret_encrypted,
      secret_iv,
      is_active,
      rate_limit,
      allowed_ips,
      pass_metadata,
      agents (
        id,
        wallet_address,
        flow,
        config,
        claw_config,
        status
      )
    `
    )
    .eq('id', webhookId)
    .single()

  if (webhookError || !webhook) {
    await logger.security('webhook_trigger_not_found', { webhookId }, clientIP)
    return c.json({ error: 'Webhook not found' }, 404)
  }

  if (!webhook.is_active) {
    return c.json({ error: 'Webhook is disabled' }, 403)
  }

  // Type assertion for the joined agent data
  const agent = webhook.agents as unknown as {
    id: string
    wallet_address: string
    flow: { nodes?: unknown[]; edges?: unknown[] }
    config: Record<string, unknown>
    claw_config: { protection_level?: string; gates?: Record<string, boolean> }
    status: string
  }

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  if (agent.status === 'archived') {
    return c.json(
      {
        error: 'Agent archived',
        message: 'This agent has been archived and cannot receive webhooks.',
      },
      410
    )
  }

  if (agent.status === 'draft') {
    return c.json(
      {
        error: 'Agent not deployed',
        message: 'This agent is still in draft mode. Deploy it to enable webhook triggers.',
        code: 'AGENT_NOT_DEPLOYED',
      },
      422
    )
  }

  // 4. Validate IP whitelist
  if (!validateAllowedIP(clientIP, webhook.allowed_ips || [])) {
    await logger.security('webhook_trigger_ip_denied', { webhookId, clientIP }, clientIP)
    return c.json({ error: 'IP address not allowed' }, 403)
  }

  // 5. Per-webhook rate limiting
  // Each webhook has its own configurable rate limit (requests per minute)
  const rateLimiter = createRateLimiter(c.env.RATE_LIMIT_KV || null, 'webhook:')
  const rateLimitKey = `trigger:${webhookId}`
  const webhookRateLimit = webhook.rate_limit || 60 // Default: 60 req/min
  const rateLimitResult = await rateLimiter.checkLimit(rateLimitKey, webhookRateLimit, 60_000)

  // Always set rate limit headers (tier-1 API standard)
  c.header('X-RateLimit-Limit', webhookRateLimit.toString())
  c.header('X-RateLimit-Remaining', Math.max(0, rateLimitResult.remaining).toString())
  c.header('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetAt / 1000).toString())

  if (!rateLimitResult.allowed) {
    c.header('Retry-After', (rateLimitResult.retryAfter || 60).toString())
    await logger.security(
      'webhook_trigger_rate_limited',
      {
        webhookId,
        limit: webhookRateLimit,
      },
      clientIP
    )
    return c.json(
      {
        error: 'Rate limit exceeded for this webhook',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: webhookRateLimit,
        retry_after: rateLimitResult.retryAfter,
      },
      429
    )
  }

  // 6. Decrypt the stored secret
  let webhookSecret: string
  try {
    webhookSecret = await decryptWebhookSecret(
      webhook.secret_encrypted,
      webhook.secret_iv,
      c.env.JWT_SECRET
    )
  } catch (decryptError) {
    await logger.security('webhook_trigger_decrypt_failed', { webhookId }, clientIP)
    console.error('Webhook secret decryption failed:', decryptError)
    return c.json({ error: 'Internal server error' }, 500)
  }

  // 7. Verify HMAC signature
  const verificationResult = await verifyWebhookSignature(
    rawBody,
    signature,
    webhookSecret,
    timestamp
  )

  if (!verificationResult.valid) {
    await logger.security(
      'webhook_trigger_signature_invalid',
      {
        webhookId,
        error: verificationResult.code,
      },
      clientIP
    )
    return c.json(
      {
        error: 'Signature verification failed',
        code: verificationResult.code,
        details: verificationResult.error,
      },
      401
    )
  }

  // 8. Parse and validate body
  let parsedBody: { message: string; metadata?: Record<string, unknown> }
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const bodyValidation = triggerWebhookSchema.safeParse(parsedBody)
  if (!bodyValidation.success) {
    return c.json({ error: 'Invalid request body', details: bodyValidation.error.flatten() }, 400)
  }

  const { message, metadata } = bodyValidation.data

  // 9. Execute agent
  const executionOptions: ExecutionOptions = {
    modalEndpoint: c.env.MODAL_RUNTIME_URL,
    openaiKey: c.env.OPENAI_API_KEY,
    flow: agent.flow,
    message,
    clawConfig: agent.claw_config,
    llmConfig: agent.config as { model?: string; temperature?: number; maxTokens?: number },
    // Provide credentials context for tool execution
    toolCredentials: {
      supabase,
      walletAddress: agent.wallet_address,
      serverSecret: c.env.JWT_SECRET,
    },
    // Provide context for social media delivery
    socialContext: {
      supabase,
      agentId: agent.id,
      agentName: undefined, // Agent name not available in webhook context
      serverSecret: c.env.JWT_SECRET,
    },
  }

  try {
    const result = await execute(executionOptions)
    const latencyMs = Date.now() - startTime
    const executionId = crypto.randomUUID()

    // 10. Update webhook statistics
    await supabase.rpc('increment_webhook_trigger', { p_webhook_id: webhookId })

    // 11. Log event with v2 analytics fields (metadata only)
    result.latency_ms = latencyMs
    const analyticsFields = extractAnalyticsFields(agent.id, 'webhook_trigger', result, {
      inputTokensEstimate: Math.ceil(message.length / 4),
      outputTokensEstimate: result.response ? Math.ceil(result.response.length / 4) : 0,
    })
    await supabase.from('agent_events').insert(analyticsFields)

    // 11.1 Log execution with trace for debugging (non-blocking)
    logExecution({
      supabase,
      agentId: agent.id,
      eventSource: 'webhook',
      inputText: message,
      result,
      requestId: executionId,
    }).catch((err) => console.error('Failed to log execution:', err))

    // 12. Queue deliveries to configured endpoints
    // Non-blocking: fire and forget (delivery happens async)
    const eventType: DeliveryEventType = result.blocked ? 'agent.blocked' : 'agent.response'
    queueDeliveriesForAgent(
      supabase,
      c.env.JWT_SECRET,
      agent.id,
      eventType,
      {
        response: result.response || undefined,
        blocked: result.blocked,
        gate: result.gate,
        reason: result.reason,
        latency_ms: latencyMs,
        metadata: webhook.pass_metadata ? metadata : undefined,
      },
      executionId
    ).catch((err) => {
      // Log but don't fail the request
      console.error('Failed to queue deliveries:', err)
    })

    // 13. Return result
    return c.json({
      success: !result.blocked,
      execution_id: executionId,
      response: result.response,
      blocked: result.blocked,
      gate: result.gate,
      reason: result.reason,
      latency_ms: latencyMs,
      metadata: webhook.pass_metadata ? metadata : undefined,
    })
  } catch (error) {
    // Update error statistics
    await supabase.rpc('record_webhook_error', { p_webhook_id: webhookId })

    await logger.security(
      'webhook_trigger_error',
      {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      clientIP
    )

    // Queue error delivery to endpoints
    queueDeliveriesForAgent(supabase, c.env.JWT_SECRET, agent.id, 'agent.error', {
      error: 'Agent execution failed',
    }).catch(() => {
      // Ignore delivery errors during error handling
    })

    return c.json({ error: 'Agent execution failed' }, 500)
  }
})

/**
 * GET /webhooks/:webhookId/health - Public health check
 */
webhookTriggerRoutes.get('/:webhookId/health', async (c) => {
  const webhookId = c.req.param('webhookId')

  // Public health check; same justification as the trigger handler above.
  const supabase = getServiceClient(c.env)

  const { data: webhook, error } = await supabase
    .from('webhooks')
    .select('id, is_active, agent_id')
    .eq('id', webhookId)
    .single()

  if (error || !webhook) {
    return c.json({ status: 'not_found' }, 404)
  }

  if (!webhook.is_active) {
    return c.json({ status: 'disabled' }, 200)
  }

  return c.json({
    status: 'healthy',
    webhook_id: webhook.id,
    agent_id: webhook.agent_id,
  })
})
