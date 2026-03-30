/**
 * Rate Limiting Middleware
 *
 * Multi-tier rate limiting per SECURITY_SPEC Section 3.1.2.
 *
 * Tiers applied in order:
 * 1. Global (per IP) - Always applied
 * 2. Endpoint-specific (per IP + endpoint) - Applied when more restrictive
 * 3. Per-wallet - Applied only for authenticated requests
 *
 * Headers are ALWAYS included in responses (tier-1 API standard):
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining in window
 * - X-RateLimit-Reset: Unix timestamp when window resets
 * - Retry-After: Seconds until retry (only on 429)
 */

import type { Context, MiddlewareHandler, Next } from 'hono'
import { createRateLimiter } from '../lib/rate-limiter'
import { hashIP } from '../lib/secure-logger'
import {
  DEFAULT_RATE_LIMITS,
  getEndpointLimit,
  RateLimitKeys,
  type RateLimitConfig,
} from '../lib/rate-limit-config'
import { createSecureLogger } from '../lib/secure-logger'

/**
 * Environment bindings required for rate limiting.
 */
interface RateLimitEnv {
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

/**
 * Options for rate limiting middleware.
 */
interface RateLimitOptions {
  /** Custom rate limit configuration */
  config?: RateLimitConfig
  /** Paths to skip rate limiting */
  skipPaths?: string[]
  /** Enable global IP-based limiting */
  enableGlobal?: boolean
  /** Enable endpoint-specific limiting */
  enableEndpoint?: boolean
}

/**
 * Rate limit check result with all info needed for headers.
 */
interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter?: number
  tier: 'global' | 'endpoint' | 'wallet'
}

/**
 * Get client IP from request headers.
 */
function getClientIP(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Normalize path by replacing UUIDs and IDs with placeholders.
 * This ensures rate limits are applied consistently across different resource IDs.
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9a-f]{24,}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
}

/**
 * Set rate limit headers on response.
 * Called on EVERY response per tier-1 API standards.
 */
function setRateLimitHeaders(c: Context, result: RateLimitResult): void {
  c.header('X-RateLimit-Limit', result.limit.toString())
  c.header('X-RateLimit-Remaining', Math.max(0, result.remaining).toString())
  c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString())

  if (result.retryAfter !== undefined) {
    c.header('Retry-After', result.retryAfter.toString())
  }
}

/**
 * Select the most restrictive rate limit result.
 * Used when multiple tiers apply to determine which headers to show.
 */
function getMostRestrictiveResult(results: RateLimitResult[]): RateLimitResult {
  if (results.length === 0) {
    throw new Error('No rate limit results provided')
  }

  // Find the result with lowest remaining percentage (most restrictive)
  return results.reduce((mostRestrictive, current) => {
    const currentRatio = current.remaining / current.limit
    const restrictiveRatio = mostRestrictive.remaining / mostRestrictive.limit

    // If current is denied, it's most restrictive
    if (!current.allowed) return current
    // If mostRestrictive is denied, keep it
    if (!mostRestrictive.allowed) return mostRestrictive
    // Otherwise, pick the one with lower remaining ratio
    return currentRatio < restrictiveRatio ? current : mostRestrictive
  })
}

// Module-level flag to avoid spamming KV warnings in logs
let _kvWarningLogged = false

/**
 * Create rate limiting middleware.
 *
 * @param options - Rate limiting options
 * @returns Hono middleware handler
 */
export function rateLimitMiddleware(
  options: RateLimitOptions = {}
): MiddlewareHandler<{ Bindings: RateLimitEnv }> {
  const {
    config = DEFAULT_RATE_LIMITS,
    skipPaths = ['/health', '/metrics'],
    enableGlobal = true,
    enableEndpoint = true,
  } = options

  return async (c: Context<{ Bindings: RateLimitEnv }>, next: Next) => {
    const path = new URL(c.req.url).pathname
    const method = c.req.method

    // Skip rate limiting for excluded paths
    if (skipPaths.some((skip) => path === skip || path.startsWith(skip))) {
      return next()
    }

    const clientIP = getClientIP(c)
    const ipHashSecret = c.env?.IP_HASH_SECRET || 'default-rate-limit-secret'

    // Hash IP for privacy (using SHA-256 with daily salt)
    let ipHash: string
    if (clientIP !== 'unknown') {
      ipHash = await hashIP(clientIP, ipHashSecret)
    } else {
      ipHash = 'unknown'
    }

    // Create rate limiter (KV if available, memory fallback)
    const rateLimiter = createRateLimiter(c.env?.RATE_LIMIT_KV || null, 'rate:')

    // Warn once per worker when KV is unavailable (memory limits don't persist across restarts)
    if (!rateLimiter.isKVEnabled() && !_kvWarningLogged) {
      _kvWarningLogged = true
      console.warn(
        '[rate-limit] KV unavailable — using in-memory fallback. Rate limits may not persist across worker restarts.'
      )
    }

    // Normalized path for consistent rate limiting
    const normalizedPath = normalizePath(path)

    // Collect all applicable rate limit results
    const results: RateLimitResult[] = []

    // Tier 1: Global IP-based rate limiting
    if (enableGlobal && ipHash !== 'unknown') {
      const globalKey = RateLimitKeys.global(ipHash)
      const globalCheck = await rateLimiter.checkLimit(
        globalKey,
        config.global.requests,
        config.global.windowMs
      )

      results.push({
        allowed: globalCheck.allowed,
        limit: config.global.requests,
        remaining: globalCheck.remaining,
        resetAt: globalCheck.resetAt,
        retryAfter: globalCheck.retryAfter,
        tier: 'global',
      })
    }

    // Tier 2: Endpoint-specific rate limiting
    if (enableEndpoint && ipHash !== 'unknown') {
      const endpointLimit = getEndpointLimit(method, normalizedPath, config)

      // Always check endpoint limit (even if same as global, for accurate tracking)
      const endpointKey = RateLimitKeys.endpoint(ipHash, method, normalizedPath)
      const endpointCheck = await rateLimiter.checkLimit(
        endpointKey,
        endpointLimit.requests,
        endpointLimit.windowMs
      )

      results.push({
        allowed: endpointCheck.allowed,
        limit: endpointLimit.requests,
        remaining: endpointCheck.remaining,
        resetAt: endpointCheck.resetAt,
        retryAfter: endpointCheck.retryAfter,
        tier: 'endpoint',
      })
    }

    // Determine the most restrictive limit to show in headers
    if (results.length > 0) {
      const effectiveResult = getMostRestrictiveResult(results)

      // ALWAYS set rate limit headers (tier-1 API standard)
      setRateLimitHeaders(c, effectiveResult)

      // Check if any limit was exceeded
      const deniedResult = results.find((r) => !r.allowed)
      if (deniedResult) {
        // Log security event
        const logger = createSecureLogger({ IP_HASH_SECRET: ipHashSecret })
        await logger.security(
          'rate_limit_exceeded',
          {
            tier: deniedResult.tier,
            path: normalizedPath,
            method,
          },
          clientIP
        )

        return c.json(
          {
            error:
              deniedResult.tier === 'global'
                ? 'Too many requests'
                : 'Too many requests for this endpoint',
            code: 'RATE_LIMIT_EXCEEDED',
            retry_after: deniedResult.retryAfter,
          },
          429
        )
      }
    }

    return next()
  }
}

/**
 * Create rate limiting middleware specifically for auth endpoints.
 * Uses stricter limits (10/min per IP).
 */
export function authRateLimitMiddleware(): MiddlewareHandler<{ Bindings: RateLimitEnv }> {
  return rateLimitMiddleware({
    enableGlobal: false, // Auth has its own strict limits
    enableEndpoint: true,
    skipPaths: [], // Apply to all auth endpoints
  })
}

/**
 * Per-wallet rate limiting middleware.
 * Should be applied AFTER authentication middleware.
 *
 * Headers are ALWAYS included, showing the wallet-specific limit.
 *
 * @param limit - Maximum requests per wallet per minute
 */
export function walletRateLimitMiddleware(
  limit: number = DEFAULT_RATE_LIMITS.perWallet.requests
): MiddlewareHandler<{ Bindings: RateLimitEnv; Variables: { wallet?: string } }> {
  return async (
    c: Context<{ Bindings: RateLimitEnv; Variables: { wallet?: string } }>,
    next: Next
  ) => {
    const wallet = c.get('wallet')

    if (!wallet) {
      // No wallet = not authenticated, skip wallet-based limiting
      return next()
    }

    const rateLimiter = createRateLimiter(c.env?.RATE_LIMIT_KV || null, 'rate:')
    const walletKey = RateLimitKeys.wallet(wallet)
    const result = await rateLimiter.checkLimit(
      walletKey,
      limit,
      DEFAULT_RATE_LIMITS.perWallet.windowMs
    )

    const rateLimitResult: RateLimitResult = {
      allowed: result.allowed,
      limit,
      remaining: result.remaining,
      resetAt: result.resetAt,
      retryAfter: result.retryAfter,
      tier: 'wallet',
    }

    // ALWAYS set headers (tier-1 API standard)
    setRateLimitHeaders(c, rateLimitResult)

    if (!result.allowed) {
      const logger = createSecureLogger({ IP_HASH_SECRET: c.env?.IP_HASH_SECRET })
      await logger.security(
        'rate_limit_exceeded',
        {
          tier: 'wallet',
        },
        undefined,
        wallet
      )

      return c.json(
        {
          error: 'Too many requests for this wallet',
          code: 'RATE_LIMIT_EXCEEDED',
          retry_after: result.retryAfter,
        },
        429
      )
    }

    return next()
  }
}
