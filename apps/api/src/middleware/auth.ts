/**
 * Authentication Middleware
 *
 * Validates JWT tokens and sets user context for protected routes.
 *
 * Security Features:
 * - Supports both ES256 (preferred) and HS256 (legacy) tokens
 * - Checks token revocation list
 * - Checks wallet-level revocation
 * - Detects suspicious activity (IP changes)
 *
 * Reference: SECURITY_SPEC.md Section 2.2
 */

import { createMiddleware } from 'hono/factory'
import { getJWTManager } from '../lib/jwt-manager'
import { createTokenRevocationList } from '../lib/token-revocation'
import { hashWallet, createSecureLogger } from '../lib/secure-logger'

type Env = {
  Bindings: {
    JWT_SECRET: string
    JWT_ES256_PRIVATE_KEY?: string
    JWT_ES256_PUBLIC_KEY?: string
    IP_HASH_SECRET?: string
    RATE_LIMIT_KV?: KVNamespace
  }
  Variables: {
    wallet: string
    plan: string
    sessionId?: string
    jti?: string
  }
}

/**
 * Extract client IP from request headers.
 */
function getClientIP(req: { header: (name: string) => string | undefined }): string {
  return (
    req.header('cf-connecting-ip') ||
    req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Hash IP for comparison.
 */
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

/**
 * Authentication middleware.
 *
 * Validates JWT token and adds wallet/plan to context.
 * Checks token revocation and suspicious activity.
 */
export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    // Initialize JWT manager
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    // Verify token
    const result = await jwtManager.verifyToken(token)

    if (!result.valid || !result.payload) {
      return c.json({ error: result.error || 'Invalid or expired token' }, 401)
    }

    const payload = result.payload

    // Check token revocation
    const revocationList = createTokenRevocationList(c.env.RATE_LIMIT_KV || null)

    if (payload.jti) {
      const isRevoked = await revocationList.isRevoked(payload.jti)
      if (isRevoked) {
        return c.json({ error: 'Token has been revoked' }, 401)
      }
    }

    // Check wallet-level revocation
    if (payload.sub && payload.iat) {
      const walletHash = await hashWallet(payload.sub)
      const isWalletRevoked = await revocationList.isWalletRevoked(walletHash, payload.iat * 1000)
      if (isWalletRevoked) {
        return c.json({ error: 'Session has been revoked' }, 401)
      }
    }

    // Check for suspicious activity (IP change during session)
    if (payload.ipHash && c.env.IP_HASH_SECRET) {
      const currentIpHash = await hashIP(getClientIP(c.req), c.env.IP_HASH_SECRET)

      if (currentIpHash !== payload.ipHash) {
        // IP changed during session - log but don't block (could be VPN, mobile network, etc.)
        const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
        await logger.security(
          'suspicious_activity',
          {
            reason: 'ip_changed_during_session',
            // Don't log actual IPs, just that a change occurred
          },
          getClientIP(c.req),
          payload.sub
        )

        // For now, allow but could implement challenge flow in future
        // The session security module already tracks this for more sophisticated detection
      }
    }

    // Add user info to context
    c.set('wallet', payload.sub)
    c.set('plan', payload.plan || 'free')

    if (payload.sessionId) {
      c.set('sessionId', payload.sessionId)
    }

    if (payload.jti) {
      c.set('jti', payload.jti)
    }

    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
})

/**
 * Optional auth middleware - doesn't fail if no token present.
 *
 * Useful for endpoints that work with or without authentication.
 */
export const optionalAuthMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  // No auth header - continue without user context
  if (!authHeader?.startsWith('Bearer ')) {
    await next()
    return
  }

  const token = authHeader.slice(7)

  try {
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    const result = await jwtManager.verifyToken(token)

    if (result.valid && result.payload) {
      // Check revocation
      const revocationList = createTokenRevocationList(c.env.RATE_LIMIT_KV || null)

      let isRevoked = false
      if (result.payload.jti) {
        isRevoked = await revocationList.isRevoked(result.payload.jti)
      }

      if (!isRevoked && result.payload.sub && result.payload.iat) {
        const walletHash = await hashWallet(result.payload.sub)
        isRevoked = await revocationList.isWalletRevoked(walletHash, result.payload.iat * 1000)
      }

      if (!isRevoked) {
        c.set('wallet', result.payload.sub)
        c.set('plan', result.payload.plan || 'free')

        if (result.payload.sessionId) {
          c.set('sessionId', result.payload.sessionId)
        }

        if (result.payload.jti) {
          c.set('jti', result.payload.jti)
        }
      }
    }
  } catch {
    // Ignore errors for optional auth
  }

  await next()
})
