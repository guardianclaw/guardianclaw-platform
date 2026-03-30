/**
 * Discord Adapter
 * Sends messages to Discord channels via webhook or bot API
 */

import type { SocialAdapter, DeliveryRequest, SocialDeliveryResult, DiscordConfig } from './types'

const DISCORD_API_BASE = 'https://discord.com/api/v10'

interface DiscordMessageResponse {
  id: string
  channel_id: string
  content?: string
  embeds?: Array<{
    title?: string
    description?: string
  }>
}

interface DiscordWebhookResponse {
  id: string
  token: string
}

interface DiscordBotUser {
  id: string
  username: string
  discriminator: string
}

interface DiscordEmbed {
  title?: string
  description: string
  color?: number
  timestamp?: string
  footer?: {
    text: string
  }
}

function buildEmbed(content: string, config: DiscordConfig, agentName?: string): DiscordEmbed {
  return {
    description: content,
    color: config.embedColor || 0x7c3aed, // GuardianClaw purple
    timestamp: new Date().toISOString(),
    footer: agentName ? { text: `via ${agentName}` } : undefined,
  }
}

export const discordAdapter: SocialAdapter = {
  platform: 'discord',

  async deliver(request: DeliveryRequest): Promise<SocialDeliveryResult> {
    const startTime = Date.now()

    try {
      const { content, credential, config, agentName } = request
      const discordConfig = config.discordConfig || {}

      // Determine if using webhook or bot token
      const isWebhook = discordConfig.webhookUrl || credential.credential.includes('/')

      if (isWebhook) {
        return await deliverViaWebhook(
          content,
          credential.credential,
          discordConfig,
          agentName,
          startTime
        )
      } else {
        return await deliverViaBot(
          content,
          credential.credential,
          discordConfig,
          agentName,
          startTime
        )
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime
      return {
        success: false,
        latencyMs,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  async testCredential(
    credential: string,
    _config?: Record<string, unknown>
  ): Promise<{
    valid: boolean
    message: string
    details?: Record<string, unknown>
  }> {
    try {
      // Check if webhook URL
      if (credential.includes('discord.com/api/webhooks')) {
        const response = await fetch(credential, {
          method: 'GET',
        })

        if (!response.ok) {
          return {
            valid: false,
            message: 'Invalid webhook URL',
          }
        }

        const data = (await response.json()) as DiscordWebhookResponse

        return {
          valid: true,
          message: 'Webhook connection verified',
          details: {
            id: data.id,
            type: 'webhook',
          },
        }
      }

      // Bot token
      const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
        headers: {
          Authorization: `Bot ${credential}`,
        },
      })

      if (response.status === 401) {
        return {
          valid: false,
          message: 'Invalid Discord bot token',
        }
      }

      if (!response.ok) {
        return {
          valid: false,
          message: `Discord API error: ${response.statusText}`,
        }
      }

      const data = (await response.json()) as DiscordBotUser

      return {
        valid: true,
        message: `Connected as ${data.username}#${data.discriminator}`,
        details: {
          id: data.id,
          username: data.username,
          type: 'bot',
        },
      }
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  },
}

async function deliverViaWebhook(
  content: string,
  webhookUrl: string,
  config: DiscordConfig,
  agentName: string | undefined,
  startTime: number
): Promise<SocialDeliveryResult> {
  const body: Record<string, unknown> = {}

  if (config.embedFormat) {
    body.embeds = [buildEmbed(content, config, agentName)]
  } else {
    body.content = content
  }

  if (config.username) {
    body.username = config.username
  }

  if (config.avatarUrl) {
    body.avatar_url = config.avatarUrl
  }

  const response = await fetch(`${webhookUrl}?wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const latencyMs = Date.now() - startTime

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    return {
      success: false,
      latencyMs,
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Discord rate limit exceeded',
      retryAfterSeconds: retryAfter ? parseInt(retryAfter) : 60,
    }
  }

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      latencyMs,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `Discord webhook error: ${response.statusText}. ${errorText}`,
    }
  }

  const data = (await response.json()) as DiscordMessageResponse

  return {
    success: true,
    externalId: data.id,
    externalUrl: `https://discord.com/channels/@me/${data.channel_id}/${data.id}`,
    latencyMs,
  }
}

async function deliverViaBot(
  content: string,
  botToken: string,
  config: DiscordConfig,
  agentName: string | undefined,
  startTime: number
): Promise<SocialDeliveryResult> {
  if (!config.channelId) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      errorCode: 'MISSING_CONFIG',
      errorMessage: 'Discord channel ID is required for bot delivery',
    }
  }

  const body: Record<string, unknown> = {}

  if (config.embedFormat) {
    body.embeds = [buildEmbed(content, config, agentName)]
  } else {
    body.content = content
  }

  const response = await fetch(`${DISCORD_API_BASE}/channels/${config.channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const latencyMs = Date.now() - startTime

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    return {
      success: false,
      latencyMs,
      errorCode: 'RATE_LIMITED',
      errorMessage: 'Discord rate limit exceeded',
      retryAfterSeconds: retryAfter ? parseInt(retryAfter) : 60,
    }
  }

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      latencyMs,
      errorCode: `HTTP_${response.status}`,
      errorMessage: `Discord bot error: ${response.statusText}. ${errorText}`,
    }
  }

  const data = (await response.json()) as DiscordMessageResponse

  return {
    success: true,
    externalId: data.id,
    externalUrl: `https://discord.com/channels/@me/${data.channel_id}/${data.id}`,
    latencyMs,
  }
}
