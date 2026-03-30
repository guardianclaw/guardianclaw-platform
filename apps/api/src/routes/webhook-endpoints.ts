/**
 * Webhook Endpoint Routes
 *
 * Manages outbound webhook delivery endpoints.
 * Allows users to configure where agent responses are delivered.
 *
 * Routes:
 * - POST   /agents/:agentId/endpoints              Create endpoint
 * - GET    /agents/:agentId/endpoints              List endpoints
 * - GET    /agents/:agentId/endpoints/:id          Get endpoint details
 * - PATCH  /agents/:agentId/endpoints/:id          Update endpoint
 * - DELETE /agents/:agentId/endpoints/:id          Delete endpoint
 * - POST   /agents/:agentId/endpoints/:id/test     Test delivery
 * - POST   /agents/:agentId/endpoints/:id/regenerate  Regenerate secret
 * - GET    /agents/:agentId/deliveries             List delivery history
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { generateWebhookSecret } from '../lib/webhook-signature'
import { encryptNewWebhookSecret } from '../lib/webhook-crypto'
import { deliverImmediately, DELIVERY_EVENT_TYPES } from '../services/webhook-delivery'

// ============================================
// TYPES
// ============================================

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  API_BASE_URL?: string
}

type Variables = {
  wallet: string
  plan: string
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

const urlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        // Allow HTTP only in development/testing
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      } catch {
        return false
      }
    },
    { message: 'URL must be a valid HTTP or HTTPS URL' }
  )

const headersSchema = z.record(z.string()).refine(
  (headers) => {
    // Prevent dangerous headers
    const forbidden = ['host', 'content-length', 'transfer-encoding']
    return !Object.keys(headers).some((k) => forbidden.includes(k.toLowerCase()))
  },
  { message: 'Cannot override protected headers (Host, Content-Length, Transfer-Encoding)' }
)

const createEndpointSchema = z.object({
  name: z.string().min(1).max(100).default('Default Endpoint'),
  url: urlSchema,
  headers: headersSchema.default({}),
  retry_count: z.number().int().min(0).max(10).default(3),
  timeout_ms: z.number().int().min(1000).max(120000).default(30000),
  event_types: z.array(z.enum(DELIVERY_EVENT_TYPES)).default([]),
})

const updateEndpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: urlSchema.optional(),
  headers: headersSchema.optional(),
  is_active: z.boolean().optional(),
  retry_count: z.number().int().min(0).max(10).optional(),
  timeout_ms: z.number().int().min(1000).max(120000).optional(),
  event_types: z.array(z.enum(DELIVERY_EVENT_TYPES)).optional(),
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verify agent ownership for a wallet address.
 */
async function verifyAgentOwnership(
  supabase: SupabaseClient,
  agentId: string,
  wallet: string
): Promise<{ agent: { id: string } | null; error?: string }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return { agent: null, error: 'Agent not found or access denied' }
  }

  return { agent }
}

// ============================================
// ROUTES
// ============================================

export const webhookEndpointRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * POST /agents/:agentId/endpoints - Create a new endpoint
 */
webhookEndpointRoutes.post(
  '/agents/:agentId/endpoints',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { agent, error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError || !agent) {
      return c.json({ error: agentError }, 404)
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = createEndpointSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    const { name, url, headers, retry_count, timeout_ms, event_types } = parsed.data

    // Check endpoint limit (max 10 active endpoints per agent)
    const { count } = await supabase
      .from('webhook_endpoints')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('is_active', true)

    if ((count || 0) >= 10) {
      return c.json(
        { error: 'Maximum 10 active endpoints per agent. Delete unused endpoints first.' },
        403
      )
    }

    // Generate secret and encrypt for storage
    const secret = generateWebhookSecret()
    const { encrypted, iv, prefix } = await encryptNewWebhookSecret(secret, c.env.JWT_SECRET)

    // Insert endpoint record
    const { data: endpoint, error: insertError } = await supabase
      .from('webhook_endpoints')
      .insert({
        agent_id: agentId,
        name,
        url,
        secret_encrypted: encrypted,
        secret_iv: iv,
        secret_prefix: prefix,
        headers,
        retry_count,
        timeout_ms,
        event_types,
        is_active: true,
      })
      .select(
        `
        id,
        name,
        url,
        secret_prefix,
        headers,
        is_active,
        retry_count,
        timeout_ms,
        event_types,
        created_at
      `
      )
      .single()

    if (insertError || !endpoint) {
      console.error('Endpoint creation error:', insertError)
      return c.json({ error: 'Failed to create endpoint' }, 500)
    }

    return c.json({
      success: true,
      endpoint: {
        ...endpoint,
        secret: secret, // Only shown once!
      },
      message: 'Endpoint created. Save the secret - it will only be shown once.',
    })
  }
)

/**
 * GET /agents/:agentId/endpoints - List endpoints for an agent
 */
webhookEndpointRoutes.get(
  '/agents/:agentId/endpoints',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Get endpoints
    const { data: endpoints, error } = await supabase
      .from('webhook_endpoints')
      .select(
        `
        id,
        name,
        url,
        secret_prefix,
        headers,
        is_active,
        retry_count,
        timeout_ms,
        event_types,
        delivery_count,
        success_count,
        failure_count,
        last_delivery_at,
        last_success_at,
        last_failure_at,
        created_at,
        updated_at
      `
      )
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Endpoint list error:', error)
      return c.json({ error: 'Failed to list endpoints' }, 500)
    }

    return c.json({
      endpoints: endpoints || [],
      count: endpoints?.length || 0,
    })
  }
)

/**
 * GET /agents/:agentId/endpoints/:id - Get endpoint details
 */
webhookEndpointRoutes.get(
  '/agents/:agentId/endpoints/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const endpointId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Get endpoint
    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .select(
        `
        id,
        name,
        url,
        secret_prefix,
        headers,
        is_active,
        retry_count,
        timeout_ms,
        event_types,
        delivery_count,
        success_count,
        failure_count,
        last_delivery_at,
        last_success_at,
        last_failure_at,
        created_at,
        updated_at
      `
      )
      .eq('id', endpointId)
      .eq('agent_id', agentId)
      .single()

    if (error || !endpoint) {
      return c.json({ error: 'Endpoint not found' }, 404)
    }

    return c.json({ endpoint })
  }
)

/**
 * PATCH /agents/:agentId/endpoints/:id - Update endpoint
 */
webhookEndpointRoutes.patch(
  '/agents/:agentId/endpoints/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const endpointId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = updateEndpointSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    // Update endpoint
    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .update(parsed.data)
      .eq('id', endpointId)
      .eq('agent_id', agentId)
      .select(
        `
        id,
        name,
        url,
        secret_prefix,
        headers,
        is_active,
        retry_count,
        timeout_ms,
        event_types,
        updated_at
      `
      )
      .single()

    if (error || !endpoint) {
      return c.json({ error: 'Endpoint not found or update failed' }, 404)
    }

    return c.json({
      success: true,
      endpoint,
    })
  }
)

/**
 * DELETE /agents/:agentId/endpoints/:id - Delete endpoint
 */
webhookEndpointRoutes.delete(
  '/agents/:agentId/endpoints/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const endpointId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Delete endpoint (cascade will delete associated deliveries)
    const { error } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', endpointId)
      .eq('agent_id', agentId)

    if (error) {
      console.error('Endpoint deletion error:', error)
      return c.json({ error: 'Failed to delete endpoint' }, 500)
    }

    return c.json({
      success: true,
      message: 'Endpoint deleted',
    })
  }
)

/**
 * POST /agents/:agentId/endpoints/:id/test - Test delivery to endpoint
 */
webhookEndpointRoutes.post(
  '/agents/:agentId/endpoints/:id/test',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const endpointId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Verify endpoint exists and belongs to agent
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('id')
      .eq('id', endpointId)
      .eq('agent_id', agentId)
      .single()

    if (endpointError || !endpoint) {
      return c.json({ error: 'Endpoint not found' }, 404)
    }

    // Execute test delivery
    const result = await deliverImmediately(supabase, endpointId, agentId, c.env.JWT_SECRET)

    if (result.success) {
      return c.json({
        success: true,
        message: 'Test delivery successful',
        status: result.status,
        response_time_ms: result.responseTimeMs,
        delivery_id: result.deliveryId,
      })
    }

    return c.json(
      {
        success: false,
        message: 'Test delivery failed',
        error_code: result.errorCode,
        error_message: result.errorMessage,
        status: result.status,
        response_time_ms: result.responseTimeMs,
        delivery_id: result.deliveryId,
      },
      502
    ) // Bad Gateway for upstream failures
  }
)

/**
 * POST /agents/:agentId/endpoints/:id/regenerate - Regenerate endpoint secret
 */
webhookEndpointRoutes.post(
  '/agents/:agentId/endpoints/:id/regenerate',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const endpointId = c.req.param('id')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Generate new secret and encrypt for storage
    const secret = generateWebhookSecret()
    const { encrypted, iv, prefix } = await encryptNewWebhookSecret(secret, c.env.JWT_SECRET)

    // Update endpoint with new secret
    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .update({
        secret_encrypted: encrypted,
        secret_iv: iv,
        secret_prefix: prefix,
      })
      .eq('id', endpointId)
      .eq('agent_id', agentId)
      .select('id, name, secret_prefix')
      .single()

    if (error || !endpoint) {
      return c.json({ error: 'Endpoint not found or update failed' }, 404)
    }

    return c.json({
      success: true,
      endpoint: {
        id: endpoint.id,
        name: endpoint.name,
        secret: secret, // Only shown once!
        secret_prefix: endpoint.secret_prefix,
      },
      message: 'Secret regenerated. Save the new secret - it will only be shown once.',
    })
  }
)

/**
 * GET /agents/:agentId/deliveries - List delivery history
 */
webhookEndpointRoutes.get(
  '/agents/:agentId/deliveries',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('agentId')
    const wallet = c.get('wallet')

    // Parse query parameters
    const url = new URL(c.req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const status = url.searchParams.get('status')
    const endpointId = url.searchParams.get('endpoint_id')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify agent ownership
    const { error: agentError } = await verifyAgentOwnership(supabase, agentId, wallet)
    if (agentError) {
      return c.json({ error: agentError }, 404)
    }

    // Build query
    let query = supabase
      .from('webhook_deliveries')
      .select(
        `
        id,
        endpoint_id,
        event_type,
        status,
        attempts,
        max_attempts,
        response_status,
        response_time_ms,
        error_code,
        error_message,
        next_attempt_at,
        created_at,
        completed_at,
        webhook_endpoints (
          name,
          url
        )
      `,
        { count: 'exact' }
      )
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (endpointId) {
      query = query.eq('endpoint_id', endpointId)
    }

    const { data: deliveries, error, count } = await query

    if (error) {
      console.error('Delivery list error:', error)
      return c.json({ error: 'Failed to list deliveries' }, 500)
    }

    // Format response
    const formattedDeliveries = (deliveries || []).map((d) => {
      const endpointData = d.webhook_endpoints as unknown
      const endpoint = endpointData as { name: string; url: string } | null
      return {
        id: d.id,
        endpoint_id: d.endpoint_id,
        endpoint_name: endpoint?.name,
        endpoint_url: endpoint?.url,
        event_type: d.event_type,
        status: d.status,
        attempts: d.attempts,
        max_attempts: d.max_attempts,
        response_status: d.response_status,
        response_time_ms: d.response_time_ms,
        error_code: d.error_code,
        error_message: d.error_message,
        next_attempt_at: d.next_attempt_at,
        created_at: d.created_at,
        completed_at: d.completed_at,
      }
    })

    return c.json({
      deliveries: formattedDeliveries,
      count: formattedDeliveries.length,
      total: count || 0,
      limit,
      offset,
    })
  }
)
