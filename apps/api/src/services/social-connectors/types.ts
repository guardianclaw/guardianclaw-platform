/**
 * Social Connectors Types
 * Type definitions for social platform integrations
 */

export type SocialPlatform = 'twitter' | 'discord' | 'telegram'

export interface SocialDeliveryResult {
  success: boolean
  externalId?: string
  externalUrl?: string
  latencyMs: number
  errorCode?: string
  errorMessage?: string
  retryAfterSeconds?: number
}

export interface SocialCredential {
  id: string
  platform: SocialPlatform
  credential: string
  config: Record<string, unknown>
}

export interface TwitterConfig {
  includeMetadata?: boolean
}

export interface DiscordConfig {
  channelId?: string
  webhookUrl?: string
  embedFormat?: boolean
  embedColor?: number
  username?: string
  avatarUrl?: string
}

export interface TelegramConfig {
  chatId: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disableNotification?: boolean
  disableWebPagePreview?: boolean
}

export interface SocialOutputConfig {
  platform: SocialPlatform
  credentialId: string
  autoSend?: boolean // default: false (require confirmation before sending)
  twitterConfig?: TwitterConfig
  discordConfig?: DiscordConfig
  telegramConfig?: TelegramConfig
}

export interface DeliveryRequest {
  content: string
  credential: SocialCredential
  config: SocialOutputConfig
  agentId: string
  agentName?: string
}

export interface SocialAdapter {
  platform: SocialPlatform
  deliver(request: DeliveryRequest): Promise<SocialDeliveryResult>
  testCredential(
    credential: string,
    config?: Record<string, unknown>
  ): Promise<{
    valid: boolean
    message: string
    details?: Record<string, unknown>
  }>
}
