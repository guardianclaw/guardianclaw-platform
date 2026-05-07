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
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { createSecureLogger, hashWallet } from '../lib/secure-logger'
import { getRequestId, getClientIP } from '../middleware/logging'
import { getUserClient } from '../lib/supabase-client'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
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

  // Read-only export: every query is wallet-scoped. RLS clamps each table
  // to the caller's rows, so a forgotten predicate cannot leak another
  // wallet's data.
  const supabase = await getUserClient(c.env, wallet)

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

  // The full cascade lives behind the SECURITY DEFINER RPC `purge_user_data`
  // (Frente B.2 migration 20260429000000). The RPC validates the JWT
  // wallet_address claim against the parameter, then runs the ten ordered
  // mutations + the audit insert in a single Postgres transaction. We get
  // atomicity for free and never need service-role on this path again.
  const supabase = await getUserClient(c.env, wallet)

  try {
    await logger.security(
      'data_deletion_requested',
      { action: 'deletion_initiated' },
      clientIP,
      wallet,
      requestId
    )

    const walletHash = await hashWallet(wallet)
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

    const { data, error } = await supabase.rpc('purge_user_data', {
      p_wallet: wallet,
      p_wallet_hash: walletHash,
      p_request_id: requestId,
      p_ip_hash: ipHash,
    })

    if (error) {
      await logger.error(
        'Data deletion failed',
        { error: error.message },
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

    const result = (data ?? {}) as { deleted?: string[]; retained?: string[] }
    const deletedCategories = result.deleted ?? []
    const retainedCategories = result.retained ?? ['subscriptions', 'profile_core']

    await logger.security(
      'data_deletion_requested',
      {
        action: 'deletion_completed',
        deleted_categories: deletedCategories,
        retained_categories: retainedCategories,
        errors_count: 0,
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

  // Single-row read of the caller's own profile — RLS-enforceable.
  const supabase = await getUserClient(c.env, wallet)

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
