/**
 * Telegram Adapter
 * Sends messages to Telegram chats via Bot API
 */

import type { SocialAdapter, DeliveryRequest, SocialDeliveryResult } from './types'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

interface TelegramMessageResponse {
  ok: boolean
  result?: {
    message_id: number
    chat: {
      id: number
      type: string
      title?: string
      username?: string
    }
    date: number
    text?: string
  }
  error_code?: number
  description?: string
  parameters?: {
    retry_after?: number
  }
}

interface TelegramBotInfo {
  ok: boolean
  result?: {
    id: number
    is_bot: boolean
    first_name: string
    username: string
    can_join_groups: boolean
  }
  error_code?: number
  description?: string
}

export const telegramAdapter: SocialAdapter = {
  platform: 'telegram',

  async deliver(request: DeliveryRequest): Promise<SocialDeliveryResult> {
    const startTime = Date.now()

    try {
      const { content, credential, config } = request
      const telegramConfig = config.telegramConfig

      if (!telegramConfig?.chatId) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          errorCode: 'MISSING_CONFIG',
          errorMessage: 'Telegram chat ID is required',
        }
      }

      const body: Record<string, unknown> = {
        chat_id: telegramConfig.chatId,
        text: content,
      }

      if (telegramConfig.parseMode) {
        body.parse_mode = telegramConfig.parseMode
      }

      if (telegramConfig.disableNotification) {
        body.disable_notification = true
      }

      if (telegramConfig.disableWebPagePreview) {
        body.disable_web_page_preview = true
      }

      const response = await fetch(`${TELEGRAM_API_BASE}/bot${credential.credential}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const latencyMs = Date.now() - startTime
      const data = (await response.json()) as TelegramMessageResponse

      if (response.status === 429 || data.error_code === 429) {
        const retryAfter = data.parameters?.retry_after || 60
        return {
          success: false,
          latencyMs,
          errorCode: 'RATE_LIMITED',
          errorMessage: 'Telegram rate limit exceeded',
          retryAfterSeconds: retryAfter,
        }
      }

      if (!data.ok || !data.result) {
        return {
          success: false,
          latencyMs,
          errorCode: data.error_code ? `TELEGRAM_${data.error_code}` : 'UNKNOWN_ERROR',
          errorMessage: data.description || 'Telegram API error',
        }
      }

      // Build external URL
      const chatId = data.result.chat.id
      const messageId = data.result.message_id
      const chatUsername = data.result.chat.username

      let externalUrl: string | undefined
      if (chatUsername) {
        externalUrl = `https://t.me/${chatUsername}/${messageId}`
      }

      return {
        success: true,
        externalId: `${chatId}_${messageId}`,
        externalUrl,
        latencyMs,
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

  async testCredential(credential: string): Promise<{
    valid: boolean
    message: string
    details?: Record<string, unknown>
  }> {
    try {
      const response = await fetch(`${TELEGRAM_API_BASE}/bot${credential}/getMe`)

      const data = (await response.json()) as TelegramBotInfo

      if (!data.ok || !data.result) {
        return {
          valid: false,
          message: data.description || 'Invalid Telegram bot token',
        }
      }

      return {
        valid: true,
        message: `Connected as @${data.result.username}`,
        details: {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
          canJoinGroups: data.result.can_join_groups,
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
