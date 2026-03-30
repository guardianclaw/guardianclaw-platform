/**
 * Rate Limit Configuration
 *
 * Multi-tier rate limiting configuration per SECURITY_SPEC Section 3.1.2.
 *
 * Tiers:
 * 1. Global (per IP) - Applied at edge, prevents DDoS
 * 2. Per Wallet - Applied after auth, prevents abuse by authenticated users
 * 3. Per Endpoint - Fine-grained limits for sensitive operations
 */

/**
 * Rate limit tier configuration.
 */
export interface RateLimitTier {
  /** Maximum requests allowed in the window */
  requests: number
  /** Time window in milliseconds */
  windowMs: number
}

/**
 * Endpoint-specific rate limits.
 * Key is the endpoint pattern (method:path).
 */
export interface EndpointLimits {
  [endpoint: string]: RateLimitTier
}

/**
 * Complete rate limit configuration.
 */
export interface RateLimitConfig {
  /** Global limit per IP address (Tier 1) */
  global: RateLimitTier
  /** Per-wallet limit for authenticated users (Tier 2) */
  perWallet: RateLimitTier
  /** Endpoint-specific limits (Tier 3) */
  perEndpoint: EndpointLimits
}

/**
 * Default rate limits per SECURITY_SPEC Section 3.1.2.
 */
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  // Tier 1: IP-based (1000/min global)
  global: {
    requests: 1000,
    windowMs: 60_000, // 1 minute
  },

  // Tier 2: Wallet-based (100/min per authenticated wallet)
  perWallet: {
    requests: 100,
    windowMs: 60_000, // 1 minute
  },

  // Tier 3: Endpoint-specific limits
  perEndpoint: {
    // Auth endpoints - strict limits to prevent brute force
    'GET:/auth/nonce': { requests: 10, windowMs: 60_000 },
    'POST:/auth/verify': { requests: 10, windowMs: 60_000 },
    'POST:/auth/logout': { requests: 10, windowMs: 60_000 },
    'POST:/auth/logout-all': { requests: 5, windowMs: 60_000 },
    'GET:/auth/sessions': { requests: 20, windowMs: 60_000 },
    'GET:/auth/me': { requests: 30, windowMs: 60_000 },

    // Deploy operations - expensive, limit strictly
    'POST:/deploy/:id': { requests: 5, windowMs: 60_000 },
    'DELETE:/deploy/:id': { requests: 5, windowMs: 60_000 },
    'POST:/deploy/:id/keys': { requests: 10, windowMs: 60_000 },

    // Agent invocation - based on plan (default 60/min)
    'POST:/invoke/:id': { requests: 60, windowMs: 60_000 },

    // Governance - prevent spam
    'POST:/governance/proposals': { requests: 5, windowMs: 60_000 },
    'POST:/governance/proposals/:id/votes': { requests: 10, windowMs: 60_000 },
    'POST:/governance/proposals/:id/comments': { requests: 20, windowMs: 60_000 },

    // LLM keys - sensitive operations
    'POST:/llm-keys': { requests: 5, windowMs: 60_000 },
    'DELETE:/llm-keys/:id': { requests: 10, windowMs: 60_000 },

    // Payments - prevent abuse
    'POST:/payments/verify': { requests: 10, windowMs: 60_000 },

    // Character preview - calls external LLM, limit to prevent cost abuse
    'POST:/agents/:id/character/preview': { requests: 10, windowMs: 60_000 },

    // Agent export/import - moderately expensive operations
    'POST:/agents/:id/export': { requests: 20, windowMs: 60_000 },
    'POST:/agents/:id/import': { requests: 10, windowMs: 60_000 },
  },
}

/**
 * Get rate limit for a specific endpoint.
 * Falls back to global limit if no specific limit defined.
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param config - Rate limit configuration
 * @returns Rate limit tier for the endpoint
 */
export function getEndpointLimit(
  method: string,
  path: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMITS
): RateLimitTier {
  // Try exact match first
  const exactKey = `${method.toUpperCase()}:${path}`
  if (config.perEndpoint[exactKey]) {
    return config.perEndpoint[exactKey]
  }

  // Try pattern matching for parameterized routes
  for (const [pattern, limit] of Object.entries(config.perEndpoint)) {
    if (matchEndpointPattern(pattern, exactKey)) {
      return limit
    }
  }

  // Fall back to global limit
  return config.global
}

/**
 * Match endpoint pattern with parameterized routes.
 * E.g., "POST:/deploy/:id" matches "POST:/deploy/abc123"
 */
function matchEndpointPattern(pattern: string, actual: string): boolean {
  const [patternMethod, patternPath] = pattern.split(':')
  const [actualMethod, actualPath] = actual.split(':')

  if (patternMethod !== actualMethod) {
    return false
  }

  const patternParts = patternPath.split('/')
  const actualParts = actualPath.split('/')

  if (patternParts.length !== actualParts.length) {
    return false
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const actualPart = actualParts[i]

    // Parameter placeholder matches anything
    if (patternPart.startsWith(':')) {
      continue
    }

    if (patternPart !== actualPart) {
      return false
    }
  }

  return true
}

/**
 * Generate rate limit key for different tiers.
 */
export const RateLimitKeys = {
  /**
   * Key for global (IP-based) rate limiting.
   * Uses hashed IP for privacy.
   */
  global: (ipHash: string): string => `global:${ipHash}`,

  /**
   * Key for per-wallet rate limiting.
   * Uses wallet address (public, pseudonymous).
   */
  wallet: (wallet: string): string => `wallet:${wallet}`,

  /**
   * Key for endpoint-specific rate limiting.
   * Combines IP hash and endpoint for granular control.
   */
  endpoint: (ipHash: string, method: string, path: string): string =>
    `endpoint:${ipHash}:${method}:${path}`,

  /**
   * Key for API key rate limiting.
   */
  apiKey: (keyId: string): string => `apikey:${keyId}`,
}
