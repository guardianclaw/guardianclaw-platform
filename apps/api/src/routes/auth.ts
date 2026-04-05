/**
 * Authentication Routes
 *
 * Implements wallet-based authentication per SECURITY_SPEC Section 2.
 *
 * Security Features:
 * - ES256 JWT signing (with HS256 fallback for legacy tokens)
 * - Session limits (max 5 concurrent sessions per wallet)
 * - Failed auth attempt tracking with lockout
 * - Suspicious activity detection
 * - Token revocation support
 * - Nonce single-use enforcement (5 minute TTL)
 *
 * Reference: SECURITY_SPEC.md Section 2, 3, and 9.2
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import * as ed25519 from '@noble/ed25519'
import bs58 from 'bs58'
import { setCookie } from 'hono/cookie'
import { createSecureLogger, hashWallet } from '../lib/secure-logger'
import { getJWTManager } from '../lib/jwt-manager'
import { createTokenRevocationList } from '../lib/token-revocation'
import { createSessionSecurityManager, SESSION_LIMITS } from '../lib/session-security'

// Cookie config for session token
const SESSION_COOKIE_NAME = 'claw_session'
const COOKIE_MAX_AGE = 3600 // 1 hour

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  JWT_ES256_PRIVATE_KEY?: string
  JWT_ES256_PUBLIC_KEY?: string
  IP_HASH_SECRET?: string
  RATE_LIMIT_KV?: KVNamespace
}

export const authRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * Extract client IP from request headers.
 */
function getClientIP(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

// Validation schemas
const _nonceRequestSchema = z.object({
  wallet: z.string().min(32).max(44),
})

const verifyRequestSchema = z.object({
  wallet: z.string().min(32).max(44),
  signature: z.string(),
  nonce: z.string().uuid(),
  message: z.string(),
})

// GET /auth/nonce?wallet=xxx
authRoutes.get('/nonce', async (c) => {
  const secureLogger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
  const clientIP = getClientIP(c)
  const wallet = c.req.query('wallet')

  if (!wallet || wallet.length < 32) {
    await secureLogger.security('auth_failure', { reason: 'invalid_wallet_address' }, clientIP)
    return c.json({ error: 'Invalid wallet address' }, 400)
  }

  // Check if wallet is locked out
  const sessionSecurity = createSessionSecurityManager(
    c.env.RATE_LIMIT_KV || null,
    c.env.IP_HASH_SECRET || ''
  )
  const walletHash = await hashWallet(wallet)
  const lockoutStatus = await sessionSecurity.isLockedOut(walletHash)

  if (lockoutStatus.locked) {
    const retryAfterSeconds = Math.ceil((lockoutStatus.remainingMs || 0) / 1000)
    await secureLogger.security('auth_blocked', { reason: 'account_locked' }, clientIP, wallet)
    return c.json(
      {
        error: 'Account temporarily locked due to too many failed attempts',
        retry_after: retryAfterSeconds,
      },
      429,
      { 'Retry-After': retryAfterSeconds.toString() }
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Generate nonce and timestamp
  const nonce = crypto.randomUUID()
  const issuedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Create message to sign (with domain binding per ADR-001)
  const message = createAuthMessage(wallet, nonce, issuedAt)

  // Create or update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address' })

  if (profileError) {
    await secureLogger.error('Profile upsert failed', { error: profileError.message })
    return c.json({ error: 'Failed to create profile' }, 500)
  }

  // Check session count before creating new session
  const { count: sessionCount } = await supabase
    .from('auth_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .is('signature', null)
    .gt('expires_at', new Date().toISOString())

  // Clean up old pending sessions if too many
  if (sessionCount && sessionCount >= 10) {
    await supabase
      .from('auth_sessions')
      .delete()
      .eq('wallet_address', wallet)
      .is('signature', null)
      .lt('expires_at', new Date().toISOString())
  }

  // Store session with nonce
  const { error: sessionError } = await supabase.from('auth_sessions').insert({
    wallet_address: wallet,
    nonce,
    expires_at: expiresAt.toISOString(),
  })

  if (sessionError) {
    await secureLogger.error('Session insert failed', { error: sessionError.message })
    return c.json({ error: 'Failed to create session' }, 500)
  }

  return c.json({
    nonce,
    message,
    expires_at: expiresAt.toISOString(),
  })
})

// POST /auth/verify
authRoutes.post('/verify', async (c) => {
  const secureLogger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
  const clientIP = getClientIP(c)
  const sessionSecurity = createSessionSecurityManager(
    c.env.RATE_LIMIT_KV || null,
    c.env.IP_HASH_SECRET || ''
  )

  const body = await c.req.json()
  const parsed = verifyRequestSchema.safeParse(body)

  if (!parsed.success) {
    await secureLogger.security('auth_failure', { reason: 'invalid_request' }, clientIP)
    return c.json({ error: 'Invalid request' }, 400)
  }

  const { wallet, signature, nonce, message } = parsed.data
  const walletHash = await hashWallet(wallet)

  // Check lockout status
  const lockoutStatus = await sessionSecurity.isLockedOut(walletHash)
  if (lockoutStatus.locked) {
    const retryAfterSeconds = Math.ceil((lockoutStatus.remainingMs || 0) / 1000)
    return c.json(
      {
        error: 'Account temporarily locked',
        retry_after: retryAfterSeconds,
      },
      429,
      { 'Retry-After': retryAfterSeconds.toString() }
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Find session with nonce (single-use enforcement)
  const { data: session } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('wallet_address', wallet)
    .eq('nonce', nonce)
    .is('signature', null) // Nonce not yet used
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) {
    // Record failed attempt
    const ipHash = await hashIP(clientIP, c.env.IP_HASH_SECRET || '')
    const { isLocked } = await sessionSecurity.recordFailedAttempt(walletHash, ipHash)

    await secureLogger.security(
      'auth_failure',
      { reason: 'invalid_or_expired_nonce', locked: isLocked },
      clientIP,
      wallet
    )

    if (isLocked) {
      return c.json(
        {
          error: 'Account locked due to too many failed attempts',
          retry_after: Math.ceil(SESSION_LIMITS.LOCKOUT_DURATION_MS / 1000),
        },
        429
      )
    }

    return c.json({ error: 'Invalid or expired nonce' }, 401)
  }

  // Validate message contains correct nonce and wallet
  if (!message.includes(nonce) || !message.includes(wallet)) {
    const ipHash = await hashIP(clientIP, c.env.IP_HASH_SECRET || '')
    await sessionSecurity.recordFailedAttempt(walletHash, ipHash)
    await secureLogger.security('auth_failure', { reason: 'message_tampering' }, clientIP, wallet)
    return c.json({ error: 'Message does not match nonce or wallet' }, 401)
  }

  // Verify Ed25519 signature
  const isValid = await verifySignature(wallet, signature, message)

  if (!isValid) {
    const ipHash = await hashIP(clientIP, c.env.IP_HASH_SECRET || '')
    await sessionSecurity.recordFailedAttempt(walletHash, ipHash)
    await secureLogger.security(
      'invalid_signature',
      { reason: 'signature_verification_failed' },
      clientIP,
      wallet
    )
    return c.json({ error: 'Invalid signature' }, 401)
  }

  // Check active session count (enforce limit)
  const { count: activeSessionCount } = await supabase
    .from('auth_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .not('signature', 'is', null)
    .gt('expires_at', new Date().toISOString())

  if (activeSessionCount && activeSessionCount >= SESSION_LIMITS.MAX_CONCURRENT_SESSIONS) {
    // Revoke oldest session to make room
    const { data: oldestSession } = await supabase
      .from('auth_sessions')
      .select('id')
      .eq('wallet_address', wallet)
      .not('signature', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (oldestSession) {
      await supabase.from('auth_sessions').delete().eq('id', oldestSession.id)
    }
  }

  // Clear failed attempts on successful auth
  await sessionSecurity.clearFailedAttempts(walletHash)

  // Get user's plan from database
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('wallet_address', wallet)
    .single()

  // Check if plan has expired
  const isExpired = profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()
  const userPlan = isExpired ? 'free' : profile?.plan || 'free'

  // Create JWT with ES256 (or fallback to HS256)
  const jwtManager = await getJWTManager({
    JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
    JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
    JWT_SECRET: c.env.JWT_SECRET,
  })

  // Hash IP for storage in token (for suspicious activity detection)
  const ipHash = await hashIP(clientIP, c.env.IP_HASH_SECRET || '')

  const {
    token,
    jti: _jti,
    expiresAt,
  } = await jwtManager.createToken({
    sub: wallet,
    plan: userPlan,
    sessionId: session.id,
    ipHash,
  })

  // Update session with signature and token info
  const tokenHash = await hashToken(token)
  await supabase
    .from('auth_sessions')
    .update({
      signature,
      token_hash: tokenHash,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', session.id)

  // Record IP for tracking
  await sessionSecurity.recordIP(walletHash, ipHash)

  // Log successful authentication
  await secureLogger.security(
    'auth_success',
    {
      plan: userPlan,
      algorithm: jwtManager.hasES256() ? 'ES256' : 'HS256',
    },
    clientIP,
    wallet
  )

  // Set httpOnly cookie for browser clients
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    domain: '.guardianclaw.org',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  // Keep token in body for backward compat (SDK/API clients)
  return c.json({
    token,
    expires_at: new Date(expiresAt).toISOString(),
    wallet,
  })
})

// POST /auth/logout
authRoutes.post('/logout', async (c) => {
  const secureLogger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
  const clientIP = getClientIP(c)
  const authHeader = c.req.header('Authorization')

  // Accept token from Bearer header or cookie
  const { getCookie } = await import('hono/cookie')
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!bearerToken && !cookieToken) {
    return c.json({ error: 'Missing token' }, 401)
  }

  const token = bearerToken || cookieToken!

  try {
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    const result = await jwtManager.verifyToken(token)

    if (!result.valid || !result.payload) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    // Revoke the token
    const revocationList = createTokenRevocationList(c.env.RATE_LIMIT_KV || null)
    const walletHash = await hashWallet(result.payload.sub)

    if (result.payload.jti && result.payload.exp) {
      await revocationList.revokeToken(
        result.payload.jti,
        result.payload.exp * 1000,
        'user_logout',
        walletHash
      )
    }

    // Delete session from database
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    if (result.payload.sessionId) {
      await supabase.from('auth_sessions').delete().eq('id', result.payload.sessionId)
    }

    await secureLogger.security(
      'session_revoked',
      { reason: 'user_logout' },
      clientIP,
      result.payload.sub
    )

    // Clear session cookie
    setCookie(c, SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      domain: '.guardianclaw.org',
      path: '/',
      maxAge: 0,
    })

    return c.json({ success: true, message: 'Logged out successfully' })
  } catch {
    return c.json({ error: 'Logout failed' }, 500)
  }
})

// POST /auth/logout-all
authRoutes.post('/logout-all', async (c) => {
  const secureLogger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
  const clientIP = getClientIP(c)
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing token' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    const result = await jwtManager.verifyToken(token)

    if (!result.valid || !result.payload) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    const wallet = result.payload.sub
    const walletHash = await hashWallet(wallet)

    // Revoke all tokens for this wallet
    const revocationList = createTokenRevocationList(c.env.RATE_LIMIT_KV || null)
    await revocationList.revokeAllForWallet(walletHash, 'user_logout_all')

    // Delete all sessions from database
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
    await supabase.from('auth_sessions').delete().eq('wallet_address', wallet)

    await secureLogger.security(
      'session_revoked',
      { reason: 'user_logout_all', limits: 'all_sessions' },
      clientIP,
      wallet
    )

    // Clear session cookie
    setCookie(c, SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      domain: '.guardianclaw.org',
      path: '/',
      maxAge: 0,
    })

    return c.json({ success: true, message: 'All sessions logged out' })
  } catch {
    return c.json({ error: 'Logout failed' }, 500)
  }
})

// GET /auth/me
authRoutes.get('/me', async (c) => {
  const secureLogger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
  const clientIP = getClientIP(c)
  const authHeader = c.req.header('Authorization')

  // Accept token from Bearer header (priority) or cookie
  const { getCookie } = await import('hono/cookie')
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!bearerToken && !cookieToken) {
    await secureLogger.security('auth_failure', { reason: 'missing_token' }, clientIP)
    return c.json({ error: 'Missing token' }, 401)
  }

  const token = bearerToken || cookieToken!

  try {
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    const result = await jwtManager.verifyToken(token)

    if (!result.valid || !result.payload) {
      await secureLogger.security('auth_failure', { reason: 'invalid_token' }, clientIP)
      return c.json({ error: result.error || 'Invalid token' }, 401)
    }

    // Check if token is revoked
    const revocationList = createTokenRevocationList(c.env.RATE_LIMIT_KV || null)

    if (result.payload.jti) {
      const isRevoked = await revocationList.isRevoked(result.payload.jti)
      if (isRevoked) {
        return c.json({ error: 'Token has been revoked' }, 401)
      }
    }

    // Check wallet-level revocation
    const walletHash = await hashWallet(result.payload.sub)
    if (result.payload.iat) {
      const isWalletRevoked = await revocationList.isWalletRevoked(
        walletHash,
        result.payload.iat * 1000
      )
      if (isWalletRevoked) {
        return c.json({ error: 'Session has been revoked' }, 401)
      }
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', result.payload.sub)
      .single()

    return c.json({
      wallet: result.payload.sub,
      profile,
    })
  } catch {
    await secureLogger.security('auth_failure', { reason: 'token_verification_error' }, clientIP)
    return c.json({ error: 'Invalid token' }, 401)
  }
})

// GET /auth/sessions
authRoutes.get('/sessions', async (c) => {
  const authHeader = c.req.header('Authorization')

  // Accept token from Bearer header (priority) or cookie
  const { getCookie } = await import('hono/cookie')
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!bearerToken && !cookieToken) {
    return c.json({ error: 'Missing token' }, 401)
  }

  const token = bearerToken || cookieToken!

  try {
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    const result = await jwtManager.verifyToken(token)

    if (!result.valid || !result.payload) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    const { data: sessions } = await supabase
      .from('auth_sessions')
      .select('id, created_at, last_used_at')
      .eq('wallet_address', result.payload.sub)
      .not('signature', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .order('last_used_at', { ascending: false })

    return c.json({
      sessions:
        sessions?.map((s) => ({
          id: s.id,
          created_at: s.created_at,
          last_used_at: s.last_used_at,
          is_current: s.id === result.payload?.sessionId,
        })) || [],
      limit: SESSION_LIMITS.MAX_CONCURRENT_SESSIONS,
    })
  } catch {
    return c.json({ error: 'Failed to get sessions' }, 500)
  }
})

// Helper: Create auth message with domain binding
function createAuthMessage(wallet: string, nonce: string, issuedAt: string): string {
  return `GuardianClaw Platform Authentication

Domain: guardianclaw.org
Wallet: ${wallet}
Nonce: ${nonce}
Issued At: ${issuedAt}
Chain ID: mainnet-beta

By signing this message, you:
1. Verify ownership of this wallet
2. Authorize authentication to guardianclaw.org
3. Accept this session valid until expiration`
}

// Helper: Hash token for storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Helper: Hash IP for tracking
async function hashIP(ip: string, secret: string): Promise<string> {
  const dailySalt = new Date().toISOString().split('T')[0]
  const data = `${ip}:${dailySalt}:${secret}`
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16)
}

// Helper: Verify Solana wallet signature
async function verifySignature(
  wallet: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    const publicKey = bs58.decode(wallet)
    const signatureBytes = bs58.decode(signature)
    const messageBytes = new TextEncoder().encode(message)

    return await ed25519.verifyAsync(signatureBytes, messageBytes, publicKey)
  } catch {
    return false
  }
}
