/**
 * User Routes — GDPR Compliance Endpoints
 *
 * Implements SECURITY_SPEC Section 10:
 * - GET /user/export — Right to Data Portability (Article 20)
 * - DELETE /user/data — Right to Erasure (Article 17)
 *
 * Security:
 * - Authenticated only (wallet-based auth)
 * - Rate limited (10/min per wallet)
 * - Security audit logging for all operations
 * - Immutable deletion audit trail
 */

import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { createSecureLogger, hashWallet } from '../lib/secure-logger'
import { getRequestId, getClientIP } from '../middleware/logging'

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

export const userRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes
userRoutes.use('*', authMiddleware)
// Strict rate limiting for data operations (10/min per wallet)
userRoutes.use('*', walletRateLimitMiddleware(10))

/**
 * GET /user/export
 *
 * Right to Data Portability (GDPR Article 20)
 * Returns all user data in machine-readable JSON format.
 *
 * Returns:
 * - Profile data
 * - Agents and configurations
 * - Subscriptions/payment records
 * - LLM keys metadata (NOT decrypted - user has them locally)
 */
userRoutes.get('/export', async (c) => {
  const wallet = c.get('wallet')
  const requestId = getRequestId(c)
  const clientIP = getClientIP(c)
  const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    // Log security event
    await logger.security(
      'data_export_requested',
      { action: 'export_initiated' },
      clientIP,
      wallet,
      requestId
    )

    // Fetch all user data in parallel
    const [profileResult, agentsResult, subscriptionsResult, llmKeysResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'wallet_address, display_name, avatar_url, plan, plan_expires_at, created_at, updated_at'
        )
        .eq('wallet_address', wallet)
        .single(),
      supabase
        .from('agents')
        .select(
          'id, name, description, icon, framework, flow, config, claw_config, status, version, created_at, updated_at'
        )
        .eq('wallet_address', wallet)
        .order('created_at', { ascending: false }),
      supabase
        .from('subscriptions')
        .select(
          'id, plan, payment_token, amount_lamports, tx_signature, period_start, period_end, status, created_at'
        )
        .eq('wallet_address', wallet)
        .order('created_at', { ascending: false }),
      supabase
        .from('llm_keys')
        .select('id, provider, name, key_preview, created_at')
        .eq('wallet_address', wallet)
        .order('created_at', { ascending: false }),
    ])

    // Build export data
    const exportData = {
      exported_at: new Date().toISOString(),
      format: 'application/json',
      wallet_address: wallet,
      data: {
        profile: profileResult.data || null,
        agents: agentsResult.data || [],
        subscriptions: subscriptionsResult.data || [],
        // Only include metadata for LLM keys - actual keys are encrypted client-side
        llm_keys: (llmKeysResult.data || []).map((key) => ({
          id: key.id,
          provider: key.provider,
          name: key.name,
          key_preview: key.key_preview,
          created_at: key.created_at,
          // Note: ciphertext/iv/salt not included - user decrypts locally
        })),
      },
      notes: {
        llm_keys:
          'LLM API keys are encrypted client-side. Only metadata is exported. Decrypt locally with your wallet.',
        retention: 'This export was generated from data stored per our data retention policy.',
      },
    }

    // Set headers for file download
    const filename = `claw-export-${wallet.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`

    return c.json(exportData, 200, {
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
  } catch (error) {
    await logger.error(
      'Data export failed',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      clientIP
    )

    return c.json(
      {
        error: 'Failed to export data',
        code: 'EXPORT_FAILED',
        ...(requestId && { requestId }),
      },
      500
    )
  }
})

/**
 * DELETE /user/data
 *
 * Right to Erasure (GDPR Article 17)
 * Deletes user data with proper audit trail.
 *
 * What gets DELETED:
 * - LLM keys (encrypted blobs)
 * - Agents and deployments
 * - Agent events and usage data
 * - API keys for deployed agents
 *
 * What gets RETAINED (legal requirement):
 * - Payment/subscription records (7 years for tax compliance)
 * - Deletion audit trail (proof of compliance)
 *
 * Note: Profile is soft-deleted (status='deleted') to maintain
 * foreign key integrity with retained payment records.
 */
userRoutes.delete('/data', async (c) => {
  const wallet = c.get('wallet')
  const requestId = getRequestId(c)
  const clientIP = getClientIP(c)
  const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    // Log security event - deletion initiated
    await logger.security(
      'data_deletion_requested',
      { action: 'deletion_initiated' },
      clientIP,
      wallet,
      requestId
    )

    // Hash wallet for audit log (original wallet deleted)
    const walletHash = await hashWallet(wallet)

    // Track what we're deleting
    const deletedCategories: string[] = []
    const retainedCategories: string[] = []
    const errors: string[] = []

    // 1. Delete LLM keys (encrypted blobs)
    const llmKeysResult = await supabase
      .from('llm_keys')
      .delete()
      .eq('wallet_address', wallet)
      .select('id')

    if (llmKeysResult.error) {
      errors.push(`llm_keys: ${llmKeysResult.error.message}`)
    } else {
      deletedCategories.push('llm_keys')
    }

    // 2. Get agent IDs for cascading deletes
    const agentsQuery = await supabase.from('agents').select('id').eq('wallet_address', wallet)

    const agentIds = (agentsQuery.data || []).map((a) => a.id)

    // 3. Delete agent events (if any agents existed)
    if (agentIds.length > 0) {
      const eventsResult = await supabase
        .from('agent_events')
        .delete()
        .in('agent_id', agentIds)
        .select('id')

      if (!eventsResult.error) {
        deletedCategories.push('agent_events')
      }

      // 4. Delete usage daily stats
      const usageResult = await supabase
        .from('usage_daily')
        .delete()
        .eq('wallet_address', wallet)
        .select('id')

      if (!usageResult.error) {
        deletedCategories.push('usage_daily')
      }

      // 5. Delete API keys (for deployed agents)
      const apiKeysResult = await supabase
        .from('api_keys')
        .delete()
        .in('agent_id', agentIds)
        .select('id')

      if (!apiKeysResult.error) {
        deletedCategories.push('api_keys')
      }

      // 6. Delete deployments
      const deploymentsResult = await supabase
        .from('deployments')
        .delete()
        .in('agent_id', agentIds)
        .select('id')

      if (!deploymentsResult.error) {
        deletedCategories.push('deployments')
      }
    }

    // 7. Delete agents
    const agentsResult = await supabase
      .from('agents')
      .delete()
      .eq('wallet_address', wallet)
      .select('id')

    if (agentsResult.error) {
      errors.push(`agents: ${agentsResult.error.message}`)
    } else {
      deletedCategories.push('agents')
    }

    // 8. Delete auth sessions
    const sessionsResult = await supabase
      .from('auth_sessions')
      .delete()
      .eq('wallet_address', wallet)
      .select('id')

    if (!sessionsResult.error) {
      deletedCategories.push('auth_sessions')
    }

    // 9. Delete votes (governance)
    const votesResult = await supabase
      .from('votes')
      .delete()
      .eq('wallet_address', wallet)
      .select('id')

    if (!votesResult.error) {
      deletedCategories.push('votes')
    }

    // 10. Soft-delete profile (retain for payment records integrity)
    const profileResult = await supabase
      .from('profiles')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        display_name: null,
        avatar_url: null,
      })
      .eq('wallet_address', wallet)
      .select('wallet_address')

    if (!profileResult.error) {
      deletedCategories.push('profile_optional_fields')
    }

    // Document retained data
    retainedCategories.push('subscriptions') // 7 years tax compliance
    retainedCategories.push('profile_core') // FK integrity with subscriptions

    // 11. Create immutable deletion audit trail
    // Hash IP for audit log
    const ipHash = clientIP
      ? await (async () => {
          const dailySalt = new Date().toISOString().split('T')[0]
          const data = `${clientIP}:${dailySalt}:${c.env.IP_HASH_SECRET || 'default'}`
          const encoder = new TextEncoder()
          const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
          return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .substring(0, 16)
        })()
      : null

    await supabase.from('deletion_audit_log').insert({
      wallet_hash: walletHash,
      deletion_date: new Date().toISOString(),
      data_categories: deletedCategories,
      retained_categories: retainedCategories,
      retention_reason: 'tax_compliance_7_years',
      request_ip_hash: ipHash,
      request_id: requestId,
    })

    // Log security event - deletion completed
    await logger.security(
      'data_deletion_requested',
      {
        action: 'deletion_completed',
        deleted_categories: deletedCategories,
        retained_categories: retainedCategories,
        errors_count: errors.length,
      },
      clientIP,
      wallet,
      requestId
    )

    return c.json({
      success: true,
      message: 'Data deletion completed',
      deleted: deletedCategories,
      retained: retainedCategories.map((cat) => {
        if (cat === 'subscriptions') {
          return `${cat} (legal requirement: 7 years tax compliance)`
        }
        if (cat === 'profile_core') {
          return `${cat} (FK integrity with retained payment records)`
        }
        return cat
      }),
      retention_policy: {
        subscriptions: '7 years (tax compliance)',
        deletion_audit: '7 years (GDPR proof of compliance)',
      },
      completion_date: new Date().toISOString(),
      ...(errors.length > 0 && { warnings: errors }),
    })
  } catch (error) {
    await logger.error(
      'Data deletion failed',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      clientIP
    )

    return c.json(
      {
        error: 'Failed to delete data',
        code: 'DELETION_FAILED',
        message: 'Please try again or contact support',
        ...(requestId && { requestId }),
      },
      500
    )
  }
})

/**
 * GET /user/profile
 *
 * Returns basic profile information for the authenticated user.
 * Useful for settings page display.
 */
userRoutes.get('/profile', async (c) => {
  const wallet = c.get('wallet')
  const requestId = getRequestId(c)

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_address, display_name, avatar_url, plan, plan_expires_at, status, created_at')
    .eq('wallet_address', wallet)
    .single()

  if (error || !data) {
    return c.json(
      {
        error: 'Profile not found',
        code: 'NOT_FOUND',
        ...(requestId && { requestId }),
      },
      404
    )
  }

  return c.json({
    profile: {
      wallet_address: data.wallet_address,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      plan: data.plan,
      plan_expires_at: data.plan_expires_at,
      status: data.status || 'active',
      created_at: data.created_at,
    },
  })
})
