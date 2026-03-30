/**
 * Social Connectors Service
 * Unified interface for social media integrations
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SocialPlatform,
  SocialAdapter,
  SocialDeliveryResult,
  SocialOutputConfig,
  SocialCredential,
  DeliveryRequest,
} from './types'
import { twitterAdapter } from './twitter'
import { discordAdapter } from './discord'
import { telegramAdapter } from './telegram'
import { decryptWebhookSecret } from '../../lib/webhook-crypto'

// Adapter registry
const adapters: Map<SocialPlatform, SocialAdapter> = new Map([
  ['twitter', twitterAdapter],
  ['discord', discordAdapter],
  ['telegram', telegramAdapter],
])

/**
 * Get adapter for a platform
 */
export function getAdapter(platform: SocialPlatform): SocialAdapter | undefined {
  return adapters.get(platform)
}

/**
 * Get all supported platforms
 */
export function getSupportedPlatforms(): SocialPlatform[] {
  return Array.from(adapters.keys())
}

/**
 * Map tool_type to social platform
 */
export function toolTypeToPlatform(toolType: string): SocialPlatform | null {
  const mapping: Record<string, SocialPlatform> = {
    twitter_api: 'twitter',
    discord_bot: 'discord',
    telegram_bot: 'telegram',
  }
  return mapping[toolType] || null
}

/**
 * Map social platform to tool_type
 */
export function platformToToolType(platform: SocialPlatform): string {
  const mapping: Record<SocialPlatform, string> = {
    twitter: 'twitter_api',
    discord: 'discord_bot',
    telegram: 'telegram_bot',
  }
  return mapping[platform]
}

/**
 * Test a social credential
 */
export async function testSocialCredential(
  platform: SocialPlatform,
  credential: string,
  config?: Record<string, unknown>
): Promise<{
  valid: boolean
  message: string
  details?: Record<string, unknown>
}> {
  const adapter = getAdapter(platform)

  if (!adapter) {
    return {
      valid: false,
      message: `Unsupported platform: ${platform}`,
    }
  }

  return adapter.testCredential(credential, config)
}

interface DeliveryOptions {
  supabase: SupabaseClient
  agentId: string
  agentName?: string
  content: string
  config: SocialOutputConfig
  serverSecret: string // JWT_SECRET for credential decryption
  draftOnly?: boolean // If true, save as draft without sending
}

/**
 * Execute a social delivery
 * Creates a delivery record and attempts to deliver content
 */
export async function executeSocialDelivery(options: DeliveryOptions): Promise<{
  success: boolean
  deliveryId?: string
  result?: SocialDeliveryResult
  error?: string
  isDraft?: boolean
}> {
  const { supabase, agentId, agentName, content, config, serverSecret } = options

  const adapter = getAdapter(config.platform)
  if (!adapter) {
    return {
      success: false,
      error: `Unsupported platform: ${config.platform}`,
    }
  }

  // Fetch credential from database
  const { data: credentialData, error: credError } = await supabase
    .from('tool_credentials')
    .select('id, credential_encrypted, credential_iv, config')
    .eq('id', config.credentialId)
    .eq('is_active', true)
    .single()

  if (credError || !credentialData) {
    return {
      success: false,
      error: `Credential not found or inactive: ${config.credentialId}`,
    }
  }

  // Decrypt credential using shared crypto library
  let decryptedCredential: string
  try {
    decryptedCredential = await decryptWebhookSecret(
      credentialData.credential_encrypted,
      credentialData.credential_iv,
      serverSecret
    )
  } catch (err) {
    return {
      success: false,
      error: 'Failed to decrypt credential',
    }
  }

  // Create delivery record
  const { data: delivery, error: insertError } = await supabase
    .from('social_deliveries')
    .insert({
      agent_id: agentId,
      credential_id: config.credentialId,
      platform: config.platform,
      content: content,
      delivery_config: {
        twitterConfig: config.twitterConfig,
        discordConfig: config.discordConfig,
        telegramConfig: config.telegramConfig,
      },
    })
    .select('id')
    .single()

  if (insertError || !delivery) {
    return {
      success: false,
      error: `Failed to create delivery record: ${insertError?.message}`,
    }
  }

  const deliveryId = delivery.id

  // Draft mode: save without sending
  if (options.draftOnly) {
    await supabase.from('social_deliveries').update({ status: 'draft' }).eq('id', deliveryId)

    return { success: true, deliveryId, isDraft: true }
  }

  // Build credential object for adapter
  const credential: SocialCredential = {
    id: credentialData.id,
    platform: config.platform,
    credential: decryptedCredential,
    config: credentialData.config || {},
  }

  // Build request
  const request: DeliveryRequest = {
    content,
    credential,
    config,
    agentId,
    agentName,
  }

  // Execute delivery
  const result = await adapter.deliver(request)

  // Update delivery record with result
  if (result.success) {
    await supabase.rpc('complete_social_delivery', {
      p_delivery_id: deliveryId,
      p_external_id: result.externalId || null,
      p_external_url: result.externalUrl || null,
      p_latency_ms: result.latencyMs,
    })
  } else {
    await supabase.rpc('fail_social_delivery', {
      p_delivery_id: deliveryId,
      p_error_code: result.errorCode || 'UNKNOWN',
      p_error_message: result.errorMessage || 'Unknown error',
      p_retry_after_seconds: result.retryAfterSeconds || null,
    })
  }

  // Update credential usage
  await supabase.rpc('increment_credential_usage', {
    p_credential_id: config.credentialId,
  })

  return {
    success: result.success,
    deliveryId,
    result,
  }
}

/**
 * Get delivery statistics for an agent
 */
export async function getDeliveryStats(
  supabase: SupabaseClient,
  agentId: string
): Promise<
  {
    platform: string
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    pendingDeliveries: number
    avgLatencyMs: number | null
    lastDeliveryAt: string | null
  }[]
> {
  const { data, error } = await supabase.rpc('get_social_delivery_stats', {
    p_agent_id: agentId,
  })

  if (error || !data) {
    return []
  }

  return data.map(
    (row: {
      platform: string
      total_deliveries: number
      successful_deliveries: number
      failed_deliveries: number
      pending_deliveries: number
      avg_latency_ms: number | null
      last_delivery_at: string | null
    }) => ({
      platform: row.platform,
      totalDeliveries: row.total_deliveries,
      successfulDeliveries: row.successful_deliveries,
      failedDeliveries: row.failed_deliveries,
      pendingDeliveries: row.pending_deliveries,
      avgLatencyMs: row.avg_latency_ms,
      lastDeliveryAt: row.last_delivery_at,
    })
  )
}

// Re-export types
export type {
  SocialPlatform,
  SocialDeliveryResult,
  SocialOutputConfig,
  SocialCredential,
  TwitterConfig,
  DiscordConfig,
  TelegramConfig,
} from './types'
