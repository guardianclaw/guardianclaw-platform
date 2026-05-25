/**
 * ClawPay beta invites + notification preferences (Sprint 6).
 *
 * Three groups of routes, each with different auth posture:
 *
 *  - Public:  GET  /clawpay/beta/invites/:code         check redeemable
 *  - Auth:    POST /clawpay/beta/invites/:code/redeem  attach to wallet
 *             GET  /clawpay/notifications/preferences  read prefs + email
 *             PATCH /clawpay/notifications/preferences update prefs + email
 *             POST /clawpay/notifications/test         send sample welcome
 *
 * Admin invite-generation lives behind the existing /admin namespace and
 * is intentionally *not* exposed on the beta router — keeping the public
 * surface small.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getServiceClient, getUserClient } from '../lib/supabase-client'
import {
  InMemoryEmailProvider,
  ResendEmailProvider,
  sendClawpayEmail,
  type EmailProvider,
} from '../services/clawpay-email'

// ============================================================================
// Types
// ============================================================================

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  CLAWPAY_DASHBOARD_URL?: string
}

type Variables = {
  wallet: string
  plan: string
}

// ============================================================================
// Helpers
// ============================================================================

// Codes are 16 chars from a base32 alphabet (Crockford-ish) to avoid the
// commonly mistyped 1/I/L/0/O. The public check endpoint accepts any
// length within reason; that's the format the admin tooling generates.
const inviteCodeSchema = z
  .string()
  .min(4)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, {
    message: 'invite code may contain only letters, digits, dashes, and underscores',
  })

const emailSchema = z.string().email().max(320)

const preferencesSchema = z
  .object({
    welcome: z.boolean().optional(),
    period_close: z.boolean().optional(),
    alerts_summary_daily: z.boolean().optional(),
    alerts_critical: z.boolean().optional(),
    product_updates: z.boolean().optional(),
  })
  .strict()

const updateNotificationsSchema = z
  .object({
    email: emailSchema.optional(),
    preferences: preferencesSchema.optional(),
    unsubscribed: z.boolean().optional(),
  })
  .refine(
    (v) => v.email !== undefined || v.preferences !== undefined || v.unsubscribed !== undefined,
    { message: 'at least one field must be supplied' }
  )

function selectProvider(env: Bindings): EmailProvider {
  if (env.RESEND_API_KEY) {
    return new ResendEmailProvider({
      apiKey: env.RESEND_API_KEY,
      defaultFrom: env.RESEND_FROM_EMAIL ?? 'ClawPay <hello@guardianclaw.org>',
    })
  }
  return new InMemoryEmailProvider()
}

// ============================================================================
// Public router — invite check (no auth)
// ============================================================================

export const clawpayBetaPublicRoutes = new Hono<{ Bindings: Bindings }>()

clawpayBetaPublicRoutes.get('/beta/invites/:code', async (c) => {
  const code = c.req.param('code')
  const parsed = inviteCodeSchema.safeParse(code)
  if (!parsed.success) {
    return c.json({ valid: false, reason: 'malformed_code' }, 400)
  }

  const supabase = getServiceClient(c.env)
  const { data, error } = await supabase
    .from('clawpay_beta_invites')
    .select('code, max_uses, used_count, expires_at, metadata')
    .eq('code', code)
    .maybeSingle()

  if (error) {
    console.error('beta invite lookup error:', error)
    return c.json({ valid: false, reason: 'lookup_failed' }, 500)
  }
  if (!data) {
    return c.json({ valid: false, reason: 'unknown_code' }, 404)
  }

  const expired = data.expires_at && new Date(data.expires_at) <= new Date()
  const exhausted = data.used_count >= data.max_uses

  return c.json({
    valid: !expired && !exhausted,
    code: data.code,
    remaining_uses: Math.max(0, data.max_uses - data.used_count),
    expires_at: data.expires_at,
    metadata: data.metadata ?? {},
    ...(expired ? { reason: 'expired' as const } : {}),
    ...(exhausted ? { reason: 'exhausted' as const } : {}),
  })
})

// ============================================================================
// Authenticated router — redeem + notifications
// ============================================================================

export const clawpayBetaRoutes = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

clawpayBetaRoutes.use('*', authMiddleware)
clawpayBetaRoutes.use('*', walletRateLimitMiddleware())

/**
 * POST /clawpay/beta/invites/:code/redeem
 *
 * Idempotent via the RPC's unique (code, wallet) constraint. Returns the
 * existing redemption metadata on a second call rather than failing.
 */
clawpayBetaRoutes.post('/beta/invites/:code/redeem', async (c) => {
  const wallet = c.get('wallet')
  const code = c.req.param('code')
  const parsed = inviteCodeSchema.safeParse(code)
  if (!parsed.success) {
    return c.json({ error: 'Invalid invite code format' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase.rpc('redeem_clawpay_beta_invite', {
    p_code: code,
    p_wallet: wallet,
  })

  if (error) {
    console.error('redeem rpc error:', error)
    return c.json({ error: 'Failed to redeem invite' }, 500)
  }

  const result = data as {
    success: boolean
    error?: string
    idempotent?: boolean
    code?: string
    wallet_address?: string
    redeemed_at?: string
    metadata?: Record<string, unknown>
  }

  if (!result.success) {
    const status: 400 | 404 | 410 =
      result.error === 'unknown_code'
        ? 404
        : result.error === 'expired' || result.error === 'exhausted'
          ? 410
          : 400
    return c.json({ error: result.error ?? 'redeem_failed' }, status)
  }

  // Best-effort: fire a confirmation email if the wallet has a registered
  // email. We never block redemption on the email send.
  try {
    const provider = selectProvider(c.env)
    await sendClawpayEmail(
      {
        provider,
        supabase,
        dashboardBaseUrl: c.env.CLAWPAY_DASHBOARD_URL ?? 'https://guardianclaw.org/app/clawpay',
      },
      {
        template: 'beta_invite_redeemed',
        walletAddress: wallet,
        idempotencyKey: `beta-redeemed-${code}-${wallet}`,
        context: {
          walletAddress: wallet,
          code,
          dashboardUrl: c.env.CLAWPAY_DASHBOARD_URL ?? 'https://guardianclaw.org/app/clawpay',
        },
      }
    )
  } catch (err) {
    console.warn('beta-redeemed email send skipped:', err)
  }

  return c.json({
    redeemed: true,
    idempotent: Boolean(result.idempotent),
    code: result.code,
    wallet_address: result.wallet_address,
    redeemed_at: result.redeemed_at,
    metadata: result.metadata ?? {},
  })
})

/**
 * GET /clawpay/notifications/preferences
 *
 * Returns the synthetic default row when no subscription exists, so the
 * dashboard never has to branch on the empty case.
 */
clawpayBetaRoutes.get('/notifications/preferences', async (c) => {
  const wallet = c.get('wallet')
  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('clawpay_email_subscriptions')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    console.error('notifications preferences error:', error)
    return c.json({ error: 'Failed to load preferences' }, 500)
  }

  if (!data) {
    return c.json({
      subscription: {
        wallet_address: wallet,
        email: null,
        preferences: {
          welcome: true,
          period_close: true,
          alerts_summary_daily: false,
          alerts_critical: true,
          product_updates: false,
        },
        unsubscribed_at: null,
        verified_at: null,
      },
      configured: false,
    })
  }

  return c.json({ subscription: data, configured: true })
})

clawpayBetaRoutes.patch('/notifications/preferences', async (c) => {
  const wallet = c.get('wallet')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const parsed = updateNotificationsSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Upsert pattern via two-step (RLS-friendly): try update, fall back to insert.
  const { data: existing, error: existingError } = await supabase
    .from('clawpay_email_subscriptions')
    .select('wallet_address, preferences, email, unsubscribed_at')
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (existingError) {
    console.error('notifications upsert lookup error:', existingError)
    return c.json({ error: 'Failed to load existing preferences' }, 500)
  }

  const mergedPreferences = parsed.data.preferences
    ? {
        ...(typeof existing?.preferences === 'object' && existing?.preferences !== null
          ? existing.preferences
          : {}),
        ...parsed.data.preferences,
      }
    : (existing?.preferences ?? undefined)

  const unsubscribedAt =
    parsed.data.unsubscribed === true
      ? new Date().toISOString()
      : parsed.data.unsubscribed === false
        ? null
        : existing?.unsubscribed_at

  const payload: Record<string, unknown> = {
    wallet_address: wallet,
    ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
    ...(mergedPreferences !== undefined ? { preferences: mergedPreferences } : {}),
    ...(unsubscribedAt !== undefined ? { unsubscribed_at: unsubscribedAt } : {}),
  }

  if (existing) {
    const { data, error } = await supabase
      .from('clawpay_email_subscriptions')
      .update(payload)
      .eq('wallet_address', wallet)
      .select()
      .maybeSingle()
    if (error) {
      console.error('notifications update error:', error)
      return c.json({ error: 'Failed to update preferences' }, 500)
    }
    return c.json({ subscription: data })
  }

  const { data, error } = await supabase
    .from('clawpay_email_subscriptions')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('notifications insert error:', error)
    return c.json({ error: 'Failed to create preferences' }, 500)
  }
  return c.json({ subscription: data }, 201)
})

/**
 * POST /clawpay/notifications/test
 *
 * Sends a sample `welcome` email to the configured address. Useful when
 * setting up a new wallet so the operator can confirm deliverability
 * before the first real period close.
 */
clawpayBetaRoutes.post('/notifications/test', async (c) => {
  const wallet = c.get('wallet')
  const supabase = await getUserClient(c.env, wallet)
  const provider = selectProvider(c.env)

  const outcome = await sendClawpayEmail(
    {
      provider,
      supabase,
      dashboardBaseUrl: c.env.CLAWPAY_DASHBOARD_URL ?? 'https://guardianclaw.org/app/clawpay',
    },
    {
      template: 'welcome',
      walletAddress: wallet,
      idempotencyKey: `test-welcome-${wallet}-${Date.now()}`,
      context: {
        walletAddress: wallet,
        dashboardUrl: c.env.CLAWPAY_DASHBOARD_URL ?? 'https://guardianclaw.org/app/clawpay',
      },
    }
  )

  if (!outcome.delivered) {
    const status: 422 | 502 =
      outcome.reason === 'no_email_on_file' || outcome.reason === 'skipped_unsubscribed' ? 422 : 502
    return c.json({ delivered: false, reason: outcome.reason, error: outcome.error }, status)
  }
  return c.json({
    delivered: true,
    provider: provider.name,
    provider_message_id: outcome.providerMessageId,
  })
})
