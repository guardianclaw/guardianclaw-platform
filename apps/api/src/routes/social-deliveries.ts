/**
 * Social Deliveries Routes
 *
 * Endpoints for managing draft social deliveries.
 * Allows listing drafts and approving them for actual delivery.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import {
  executeSocialDelivery,
  type SocialOutputConfig,
  type SocialPlatform,
} from '../services/social-connectors'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const socialDeliveriesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware
socialDeliveriesRoutes.use('*', authMiddleware)
socialDeliveriesRoutes.use('*', walletRateLimitMiddleware())

// Validation
const uuidSchema = z.string().uuid('Invalid UUID format')

/**
 * GET /social-deliveries
 * List social deliveries (defaults to drafts)
 */
socialDeliveriesRoutes.get('/', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.query('agent_id')
  const status = c.req.query('status') || 'draft'

  if (!agentId) {
    return c.json({ error: 'agent_id query parameter is required' }, 400)
  }

  const idParse = uuidSchema.safeParse(agentId)
  if (!idParse.success) {
    return c.json({ error: 'Invalid agent_id format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentErr || !agent) {
    return c.json({ error: 'Agent not found or not owned' }, 404)
  }

  // Fetch deliveries
  const { data: deliveries, error: fetchErr } = await supabase
    .from('social_deliveries')
    .select('id, agent_id, credential_id, platform, content, delivery_config, status, created_at')
    .eq('agent_id', agentId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (fetchErr) {
    return c.json({ error: 'Failed to fetch deliveries' }, 500)
  }

  return c.json({ deliveries: deliveries || [] })
})

/**
 * POST /social-deliveries/:id/approve
 * Approve a draft delivery and send it
 */
socialDeliveriesRoutes.post('/:id/approve', async (c) => {
  const wallet = c.get('wallet')
  const deliveryId = c.req.param('id')

  const idParse = uuidSchema.safeParse(deliveryId)
  if (!idParse.success) {
    return c.json({ error: 'Invalid delivery ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // RPC enforces ownership and state transition atomically (mig 20260426000000).
  // No revert path needed: if the caller does not own the agent the RPC simply
  // returns success=false without touching the row.
  const { data: approveResult, error: rpcError } = await supabase.rpc('approve_social_delivery', {
    p_delivery_id: deliveryId,
    p_wallet_address: wallet,
  })

  if (rpcError) {
    return c.json({ error: 'Failed to approve delivery', details: rpcError.message }, 500)
  }

  const result = approveResult as {
    success: boolean
    error?: string
    agent_id?: string
    agent_name?: string
    credential_id?: string
    platform?: string
    content?: string
    delivery_config?: Record<string, unknown>
  }

  if (!result.success) {
    return c.json(
      { error: result.error || 'Delivery not found, not in draft, or not owned' },
      404
    )
  }

  // Build config from stored delivery_config
  const deliveryConfig = result.delivery_config || {}
  const platform = result.platform as SocialPlatform
  const config: SocialOutputConfig = {
    platform,
    credentialId: result.credential_id || '',
    autoSend: true, // Approved = send immediately
    twitterConfig: deliveryConfig.twitterConfig as SocialOutputConfig['twitterConfig'],
    discordConfig: deliveryConfig.discordConfig as SocialOutputConfig['discordConfig'],
    telegramConfig: deliveryConfig.telegramConfig as SocialOutputConfig['telegramConfig'],
  }

  // Execute the actual delivery (record already exists and is set to 'pending')
  try {
    const deliveryResult = await executeSocialDelivery({
      supabase,
      agentId: result.agent_id!,
      agentName: result.agent_name,
      content: result.content || '',
      config,
      serverSecret: c.env.JWT_SECRET,
    })

    return c.json({
      success: deliveryResult.success,
      deliveryId,
      externalId: deliveryResult.result?.externalId,
      externalUrl: deliveryResult.result?.externalUrl,
      error: deliveryResult.error,
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Delivery failed',
      },
      500
    )
  }
})
