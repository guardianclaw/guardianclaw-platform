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
import { getCookie } from 'hono/cookie'
import { getJWTManager } from '../lib/jwt-manager'
import { createTokenRevocationList } from '../lib/token-revocation'
import { createSessionSecurityManager } from '../lib/session-security'
import { hashWallet, createSecureLogger } from '../lib/secure-logger'

const SESSION_COOKIE_NAME = 'claw_session'

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

  // Bearer header takes priority over cookie (SDK/API clients use header)
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  const token = bearerToken || cookieToken

  if (!token) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401)
  }

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

    // Suspicious activity detection with blocking
    if (payload.ipHash && c.env.IP_HASH_SECRET) {
      const currentIpHash = await hashIP(getClientIP(c.req), c.env.IP_HASH_SECRET)

      if (currentIpHash !== payload.ipHash) {
        const sessionSecurity = createSessionSecurityManager(
          c.env.RATE_LIMIT_KV || null,
          c.env.IP_HASH_SECRET
        )
        const walletHash = await hashWallet(payload.sub)

        const suspiciousResult = await sessionSecurity.detectSuspiciousActivity(
          walletHash,
          currentIpHash,
          payload.ipHash
        )

        if (suspiciousResult.action === 'block') {
          const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
          await logger.security(
            'session_blocked',
            { reasons: suspiciousResult.reasons },
            getClientIP(c.req),
            payload.sub
          )
          return c.json(
            {
              error: 'Session blocked due to suspicious activity. Please re-authenticate.',
              code: 'SESSION_SUSPICIOUS',
            },
            401
          )
        }

        if (suspiciousResult.action === 'challenge') {
          const logger = createSecureLogger({ IP_HASH_SECRET: c.env.IP_HASH_SECRET })
          await logger.security(
            'suspicious_activity',
            { reasons: suspiciousResult.reasons },
            getClientIP(c.req),
            payload.sub
          )
        }
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

  // Accept Bearer header (priority) or cookie
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  const token = bearerToken || cookieToken

  // No token - continue without user context
  if (!token) {
    await next()
    return
  }

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
