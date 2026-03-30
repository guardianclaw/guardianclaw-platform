/**
 * Twitter/X Adapter
 * Posts content to Twitter/X using API v2
 */

import type { SocialAdapter, DeliveryRequest, SocialDeliveryResult } from './types'

const TWITTER_API_BASE = 'https://api.twitter.com/2'

interface TwitterTweetResponse {
  data?: {
    id: string
    text: string
  }
  errors?: Array<{
    code: number
    message: string
  }>
}

interface TwitterMeResponse {
  data?: {
    id: string
    name: string
    username: string
  }
  errors?: Array<{
    code: number
    message: string
  }>
}

export const twitterAdapter: SocialAdapter = {
  platform: 'twitter',

  async deliver(request: DeliveryRequest): Promise<SocialDeliveryResult> {
    const startTime = Date.now()

    try {
      const { content, credential } = request

      // Truncate content to Twitter's limit (280 characters)
      const tweetText = content.length > 280 ? content.substring(0, 277) + '...' : content

      const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential.credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: tweetText,
        }),
      })

      const latencyMs = Date.now() - startTime

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('x-rate-limit-reset')
        const retryAfterSeconds = retryAfter
          ? Math.max(0, parseInt(retryAfter) - Math.floor(Date.now() / 1000))
          : 900 // Default 15 minutes

        return {
          success: false,
          latencyMs,
          errorCode: 'RATE_LIMITED',
          errorMessage: 'Twitter API rate limit exceeded',
          retryAfterSeconds,
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          latencyMs,
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Twitter API error: ${response.statusText}. ${errorText}`,
        }
      }

      const data = (await response.json()) as TwitterTweetResponse

      if (data.errors && data.errors.length > 0) {
        return {
          success: false,
          latencyMs,
          errorCode: `TWITTER_${data.errors[0].code}`,
          errorMessage: data.errors[0].message,
        }
      }

      if (!data.data) {
        return {
          success: false,
          latencyMs,
          errorCode: 'INVALID_RESPONSE',
          errorMessage: 'Twitter API returned no data',
        }
      }

      // Get username for URL construction
      const meResponse = await fetch(`${TWITTER_API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${credential.credential}`,
        },
      })

      let externalUrl: string | undefined

      if (meResponse.ok) {
        const meData = (await meResponse.json()) as TwitterMeResponse
        if (meData.data?.username) {
          externalUrl = `https://twitter.com/${meData.data.username}/status/${data.data.id}`
        }
      }

      return {
        success: true,
        externalId: data.data.id,
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
      const response = await fetch(`${TWITTER_API_BASE}/users/me`, {
        headers: {
          Authorization: `Bearer ${credential}`,
        },
      })

      if (response.status === 401) {
        return {
          valid: false,
          message: 'Invalid or expired Twitter Bearer Token',
        }
      }

      if (!response.ok) {
        return {
          valid: false,
          message: `Twitter API error: ${response.statusText}`,
        }
      }

      const data = (await response.json()) as TwitterMeResponse

      if (data.errors && data.errors.length > 0) {
        return {
          valid: false,
          message: data.errors[0].message,
        }
      }

      if (!data.data) {
        return {
          valid: false,
          message: 'Could not retrieve user information',
        }
      }

      return {
        valid: true,
        message: `Connected as @${data.data.username}`,
        details: {
          id: data.data.id,
          name: data.data.name,
          username: data.data.username,
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
