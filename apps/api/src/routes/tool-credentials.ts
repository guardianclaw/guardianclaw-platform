/**
 * Tool Credentials Routes
 *
 * Manages encrypted storage for external service API keys.
 * Credentials are encrypted server-side with AES-256-GCM.
 *
 * Supported tool types:
 * - serper: Serper.dev API key for web search
 * - openai: OpenAI API key for LLM (BYOK)
 * - custom_api: Generic API keys for custom integrations
 *
 * Routes:
 * - POST   /tool-credentials              Create credential
 * - GET    /tool-credentials              List credentials
 * - GET    /tool-credentials/:id          Get credential details
 * - PATCH  /tool-credentials/:id          Update credential
 * - DELETE /tool-credentials/:id          Delete credential
 * - POST   /tool-credentials/:id/test     Test credential
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { encryptWebhookSecret, decryptWebhookSecret } from '../lib/webhook-crypto'
import { checkUrlOrLog } from '../lib/ssrf-guard'
import { createSecureLogger } from '../lib/secure-logger'
import { getUserClient } from '../lib/supabase-client'

// ============================================
// TYPES
// ============================================

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
}

type Variables = {
  wallet: string
  plan: string
}

// Tool types supported
const TOOL_TYPES = [
  'serper',
  'openai',
  'custom_api',
  'twitter_api',
  'discord_bot',
  'telegram_bot',
] as const
type ToolType = (typeof TOOL_TYPES)[number]

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createCredentialSchema = z.object({
  tool_type: z.enum(TOOL_TYPES),
  name: z.string().min(1).max(100).default('Default'),
  credential: z.string().min(1).max(500),
  config: z.record(z.unknown()).default({}),
})

const updateCredentialSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  credential: z.string().min(1).max(500).optional(),
  config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get credential preview (last 4 characters).
 */
function getCredentialPreview(credential: string): string {
  if (credential.length <= 4) {
    return '****'
  }
  return '****' + credential.slice(-4)
}

/**
 * Test a credential by making a simple API call.
 */
async function testCredential(
  toolType: ToolType,
  credential: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; error?: string; latency_ms?: number }> {
  const startTime = Date.now()

  try {
    switch (toolType) {
      case 'serper': {
        // Test Serper API with a simple query
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': credential,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: 'test',
            num: 1,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          return {
            success: false,
            error: `Serper API error: ${response.status} - ${errorText}`,
            latency_ms: Date.now() - startTime,
          }
        }

        return {
          success: true,
          latency_ms: Date.now() - startTime,
        }
      }

      case 'openai': {
        // Test OpenAI API with models endpoint (doesn't cost tokens)
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credential}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return {
            success: false,
            error: `OpenAI API error: ${response.status} - ${(errorData as { error?: { message?: string } }).error?.message || 'Unknown error'}`,
            latency_ms: Date.now() - startTime,
          }
        }

        return {
          success: true,
          latency_ms: Date.now() - startTime,
        }
      }

      case 'custom_api': {
        // For custom APIs, just verify the credential is not empty
        // Real testing would require knowing the endpoint
        const baseUrl = config.base_url as string | undefined
        if (!baseUrl) {
          return {
            success: true,
            latency_ms: Date.now() - startTime,
          }
        }

        // SSRF guard: base_url is user-supplied and we're about to forward a
        // bearer credential to it.
        const logger = createSecureLogger()
        const urlCheck = await checkUrlOrLog(
          baseUrl,
          { surface: 'tool-credentials.test.custom_api' },
          logger
        )
        if (!urlCheck.valid) {
          return {
            success: false,
            error: urlCheck.error || 'base_url is not allowed',
            latency_ms: Date.now() - startTime,
          }
        }

        // If base_url is configured, try a simple HEAD request
        try {
          const response = await fetch(baseUrl, {
            method: 'HEAD',
            headers: {
              Authorization: `Bearer ${credential}`,
            },
          })

          // Accept any response (even 401/403 means the server is reachable)
          return {
            success: response.status < 500,
            latency_ms: Date.now() - startTime,
          }
        } catch (err) {
          return {
            success: false,
            error: 'Failed to connect to custom API endpoint',
            latency_ms: Date.now() - startTime,
          }
        }
      }

      case 'twitter_api': {
        // Test Twitter API with /users/me endpoint
        const response = await fetch('https://api.twitter.com/2/users/me', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credential}`,
          },
        })

        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid or expired Twitter Bearer Token',
            latency_ms: Date.now() - startTime,
          }
        }

        if (!response.ok) {
          return {
            success: false,
            error: `Twitter API error: ${response.status}`,
            latency_ms: Date.now() - startTime,
          }
        }

        return {
          success: true,
          latency_ms: Date.now() - startTime,
        }
      }

      case 'discord_bot': {
        // Check if webhook URL or bot token. The substring check is not a
        // sufficient SSRF defense (e.g. `http://internal/?x=discord.com/api/webhooks`
        // would slip through), so re-validate via the SSRF guard before fetch.
        if (credential.includes('discord.com/api/webhooks')) {
          const logger = createSecureLogger()
          const urlCheck = await checkUrlOrLog(
            credential,
            { surface: 'tool-credentials.test.discord_webhook' },
            logger
          )
          if (!urlCheck.valid) {
            return {
              success: false,
              error: urlCheck.error || 'Discord webhook URL is not allowed',
              latency_ms: Date.now() - startTime,
            }
          }
          const response = await fetch(credential, { method: 'GET' })
          return {
            success: response.ok,
            error: response.ok ? undefined : 'Invalid Discord webhook URL',
            latency_ms: Date.now() - startTime,
          }
        }

        // Test Discord Bot token
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          method: 'GET',
          headers: {
            Authorization: `Bot ${credential}`,
          },
        })

        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid Discord bot token',
            latency_ms: Date.now() - startTime,
          }
        }

        return {
          success: response.ok,
          error: response.ok ? undefined : `Discord API error: ${response.status}`,
          latency_ms: Date.now() - startTime,
        }
      }

      case 'telegram_bot': {
        // Test Telegram Bot token
        const response = await fetch(`https://api.telegram.org/bot${credential}/getMe`)
        const data = (await response.json().catch(() => ({ ok: false }))) as {
          ok: boolean
          description?: string
        }

        if (!data.ok) {
          return {
            success: false,
            error: data.description || 'Invalid Telegram bot token',
            latency_ms: Date.now() - startTime,
          }
        }

        return {
          success: true,
          latency_ms: Date.now() - startTime,
        }
      }

      default:
        return {
          success: false,
          error: `Unknown tool type: ${toolType}`,
          latency_ms: Date.now() - startTime,
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency_ms: Date.now() - startTime,
    }
  }
}

// ============================================
// ROUTES
// ============================================

export const toolCredentialRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * POST /tool-credentials - Create a new credential
 */
toolCredentialRoutes.post(
  '/tool-credentials',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const wallet = c.get('wallet')

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = createCredentialSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    const { tool_type, name, credential, config } = parsed.data
    const supabase = await getUserClient(c.env, wallet)

    // Check if credential with same name already exists
    const { data: existing } = await supabase
      .from('tool_credentials')
      .select('id')
      .eq('wallet_address', wallet)
      .eq('tool_type', tool_type)
      .eq('name', name)
      .single()

    if (existing) {
      return c.json(
        {
          error: `Credential "${name}" for ${tool_type} already exists. Use a different name or update the existing one.`,
        },
        409
      )
    }

    // Encrypt the credential
    const { encrypted, iv } = await encryptWebhookSecret(credential, c.env.JWT_SECRET)
    const preview = getCredentialPreview(credential)

    // Insert credential
    const { data: newCredential, error } = await supabase
      .from('tool_credentials')
      .insert({
        wallet_address: wallet,
        tool_type,
        name,
        credential_encrypted: encrypted,
        credential_iv: iv,
        credential_preview: preview,
        config,
        is_active: true,
      })
      .select(
        `
        id,
        tool_type,
        name,
        credential_preview,
        config,
        is_active,
        created_at
      `
      )
      .single()

    if (error || !newCredential) {
      console.error('Credential creation error:', error)
      return c.json({ error: 'Failed to create credential' }, 500)
    }

    return c.json({
      success: true,
      credential: newCredential,
      message: 'Credential stored securely. The API key has been encrypted.',
    })
  }
)

/**
 * GET /tool-credentials - List credentials
 */
toolCredentialRoutes.get(
  '/tool-credentials',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const wallet = c.get('wallet')
    const url = new URL(c.req.url)
    const toolType = url.searchParams.get('tool_type')

    const supabase = await getUserClient(c.env, wallet)

    // Build query
    let query = supabase
      .from('tool_credentials')
      .select(
        `
        id,
        tool_type,
        name,
        credential_preview,
        config,
        is_active,
        last_used_at,
        usage_count,
        created_at,
        updated_at
      `
      )
      .eq('wallet_address', wallet)
      .order('tool_type')
      .order('name')

    // Filter by tool type if specified
    if (toolType && TOOL_TYPES.includes(toolType as ToolType)) {
      query = query.eq('tool_type', toolType)
    }

    const { data: credentials, error } = await query

    if (error) {
      console.error('Credential list error:', error)
      return c.json({ error: 'Failed to list credentials' }, 500)
    }

    return c.json({
      credentials: credentials || [],
      count: credentials?.length || 0,
    })
  }
)

/**
 * GET /tool-credentials/:id - Get credential details
 */
toolCredentialRoutes.get(
  '/tool-credentials/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const wallet = c.get('wallet')
    const credentialId = c.req.param('id')

    const supabase = await getUserClient(c.env, wallet)

    const { data: credential, error } = await supabase
      .from('tool_credentials')
      .select(
        `
        id,
        tool_type,
        name,
        credential_preview,
        config,
        is_active,
        last_used_at,
        usage_count,
        created_at,
        updated_at
      `
      )
      .eq('id', credentialId)
      .eq('wallet_address', wallet)
      .single()

    if (error || !credential) {
      return c.json({ error: 'Credential not found' }, 404)
    }

    return c.json({ credential })
  }
)

/**
 * PATCH /tool-credentials/:id - Update credential
 */
toolCredentialRoutes.patch(
  '/tool-credentials/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const wallet = c.get('wallet')
    const credentialId = c.req.param('id')

    // Parse and validate request body
    const body = await c.req.json().catch(() => ({}))
    const parsed = updateCredentialSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    const supabase = await getUserClient(c.env, wallet)

    // Verify ownership
    const { data: existing } = await supabase
      .from('tool_credentials')
      .select('id')
      .eq('id', credentialId)
      .eq('wallet_address', wallet)
      .single()

    if (!existing) {
      return c.json({ error: 'Credential not found' }, 404)
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (parsed.data.name !== undefined) {
      updates.name = parsed.data.name
    }
    if (parsed.data.config !== undefined) {
      updates.config = parsed.data.config
    }
    if (parsed.data.is_active !== undefined) {
      updates.is_active = parsed.data.is_active
    }

    // If credential is being updated, re-encrypt
    if (parsed.data.credential) {
      const { encrypted, iv } = await encryptWebhookSecret(parsed.data.credential, c.env.JWT_SECRET)
      updates.credential_encrypted = encrypted
      updates.credential_iv = iv
      updates.credential_preview = getCredentialPreview(parsed.data.credential)
    }

    // Update credential
    const { data: credential, error } = await supabase
      .from('tool_credentials')
      .update(updates)
      .eq('id', credentialId)
      .eq('wallet_address', wallet)
      .select(
        `
        id,
        tool_type,
        name,
        credential_preview,
        config,
        is_active,
        updated_at
      `
      )
      .single()

    if (error || !credential) {
      return c.json({ error: 'Failed to update credential' }, 500)
    }

    return c.json({
      success: true,
      credential,
    })
  }
)

/**
 * DELETE /tool-credentials/:id - Delete credential
 */
toolCredentialRoutes.delete(
  '/tool-credentials/:id',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const wallet = c.get('wallet')
    const credentialId = c.req.param('id')

    const supabase = await getUserClient(c.env, wallet)

    const { error } = await supabase
      .from('tool_credentials')
      .delete()
      .eq('id', credentialId)
      .eq('wallet_address', wallet)

    if (error) {
      console.error('Credential deletion error:', error)
      return c.json({ error: 'Failed to delete credential' }, 500)
    }

    return c.json({
      success: true,
      message: 'Credential deleted',
    })
  }
)

/**
 * POST /tool-credentials/:id/test - Test credential
 */
toolCredentialRoutes.post(
  '/tool-credentials/:id/test',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const wallet = c.get('wallet')
    const credentialId = c.req.param('id')

    const supabase = await getUserClient(c.env, wallet)

    // Get credential
    const { data: credentialData, error: fetchError } = await supabase
      .from('tool_credentials')
      .select('tool_type, credential_encrypted, credential_iv, config')
      .eq('id', credentialId)
      .eq('wallet_address', wallet)
      .single()

    if (fetchError || !credentialData) {
      return c.json({ error: 'Credential not found' }, 404)
    }

    // Decrypt credential
    let decryptedCredential: string
    try {
      decryptedCredential = await decryptWebhookSecret(
        credentialData.credential_encrypted,
        credentialData.credential_iv,
        c.env.JWT_SECRET
      )
    } catch (err) {
      return c.json({ error: 'Failed to decrypt credential' }, 500)
    }

    // Test credential
    const result = await testCredential(
      credentialData.tool_type as ToolType,
      decryptedCredential,
      credentialData.config as Record<string, unknown>
    )

    if (result.success) {
      return c.json({
        success: true,
        message: 'Credential test successful',
        latency_ms: result.latency_ms,
      })
    }

    return c.json(
      {
        success: false,
        message: 'Credential test failed',
        error: result.error,
        latency_ms: result.latency_ms,
      },
      400
    )
  }
)

// ============================================
// INTERNAL HELPER (for tool execution)
// ============================================

/**
 * Get decrypted credential by tool type.
 * Returns the first active credential of the specified type.
 * Use when you need any credential of a type (e.g., default serper key).
 */
interface CredentialRpcRow {
  credential_id: string
  credential_encrypted: string
  credential_iv: string
  config: Record<string, unknown>
  tool_type: string
}

export async function getDecryptedCredential(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  walletAddress: string,
  toolType: ToolType,
  serverSecret: string
): Promise<{ credential: string; config: Record<string, unknown> } | null> {
  const { data, error } = await supabase.rpc('get_active_credential', {
    p_wallet_address: walletAddress,
    p_tool_type: toolType,
  } as never)

  const rows = data as CredentialRpcRow[] | null

  if (error || !rows || rows.length === 0) {
    return null
  }

  const row = rows[0]

  try {
    const credential = await decryptWebhookSecret(
      row.credential_encrypted,
      row.credential_iv,
      serverSecret
    )

    // Update usage counter (fire and forget)
    void supabase.rpc('increment_credential_usage', {
      p_credential_id: row.credential_id,
    } as never)

    return {
      credential,
      config: row.config as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

/**
 * Get decrypted credential by specific ID.
 * Verifies wallet ownership before returning.
 * Use when you need a specific credential (e.g., from flow node config).
 */
export async function getDecryptedCredentialById(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  walletAddress: string,
  credentialId: string,
  serverSecret: string
): Promise<{ credential: string; toolType: string; config: Record<string, unknown> } | null> {
  const { data, error } = await supabase.rpc('get_credential_by_id', {
    p_wallet_address: walletAddress,
    p_credential_id: credentialId,
  } as never)

  const rows = data as CredentialRpcRow[] | null

  if (error || !rows || rows.length === 0) {
    return null
  }

  const row = rows[0]

  try {
    const credential = await decryptWebhookSecret(
      row.credential_encrypted,
      row.credential_iv,
      serverSecret
    )

    // Update usage counter (fire and forget)
    void supabase.rpc('increment_credential_usage', {
      p_credential_id: row.credential_id,
    } as never)

    return {
      credential,
      toolType: row.tool_type,
      config: row.config as Record<string, unknown>,
    }
  } catch {
    return null
  }
}
