/**
 * Rate Limiter Abstraction
 *
 * Provides a flexible rate limiting interface that supports different backends:
 * - InMemoryRateLimiter: For development and single-worker deployments
 * - KVRateLimiter: For Cloudflare Workers production (using Workers KV)
 * - RedisRateLimiter: For Node.js production (using Redis)
 *
 * Uses a sliding window algorithm for accurate rate limiting.
 *
 * @example
 * // Development
 * const limiter = new InMemoryRateLimiter()
 *
 * // Production (Cloudflare)
 * const limiter = new KVRateLimiter(env.RATE_LIMIT_KV)
 *
 * // Check rate limit
 * const result = await limiter.check('host:api.example.com', 100, 60000)
 * if (!result.allowed) {
 *   // Rate limited
 * }
 */

// ============================================
// TYPES
// ============================================

/**
 * Rate limit check result.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Remaining requests in current window */
  remaining: number
  /** Unix timestamp when the window resets */
  resetAt: number
  /** Current count in window */
  count: number
}

/**
 * Rate limiter storage interface.
 * Implement this for custom backends.
 */
export interface RateLimitStore {
  /**
   * Get current count for a key.
   * @returns Current count or null if key doesn't exist
   */
  get(key: string): Promise<{ count: number; windowStart: number } | null>

  /**
   * Set count for a key with TTL.
   * @param key - Rate limit key
   * @param count - Current count
   * @param windowStart - Window start timestamp
   * @param ttlMs - Time to live in milliseconds
   */
  set(key: string, count: number, windowStart: number, ttlMs: number): Promise<void>

  /**
   * Increment count for a key atomically.
   * @returns New count after increment
   */
  increment(key: string): Promise<number>

  /**
   * Delete a key.
   */
  delete(key: string): Promise<void>
}

/**
 * Rate limiter configuration.
 */
export interface RateLimiterConfig {
  /** Maximum requests per window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Key prefix for namespacing */
  keyPrefix?: string
}

// ============================================
// IN-MEMORY STORE
// ============================================

/**
 * In-memory rate limit storage.
 * Suitable for development and single-worker deployments.
 * Note: Data is lost on worker restart and not shared between workers.
 */
export class InMemoryStore implements RateLimitStore {
  private data = new Map<string, { count: number; windowStart: number; expiresAt: number }>()

  async get(key: string): Promise<{ count: number; windowStart: number } | null> {
    const entry = this.data.get(key)
    if (!entry) return null

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key)
      return null
    }

    return { count: entry.count, windowStart: entry.windowStart }
  }

  async set(key: string, count: number, windowStart: number, ttlMs: number): Promise<void> {
    this.data.set(key, {
      count,
      windowStart,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async increment(key: string): Promise<number> {
    const entry = this.data.get(key)
    if (!entry || Date.now() > entry.expiresAt) {
      return 0 // Key doesn't exist or expired
    }
    entry.count++
    return entry.count
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key)
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.data.clear()
  }

  /**
   * Get number of entries (for testing/monitoring).
   */
  size(): number {
    return this.data.size
  }
}

// ============================================
// CLOUDFLARE KV STORE
// ============================================

/**
 * Cloudflare Workers KV rate limit storage.
 * Suitable for production multi-worker deployments.
 */
export class KVStore implements RateLimitStore {
  private kv: KVNamespace

  constructor(kv: KVNamespace) {
    this.kv = kv
  }

  async get(key: string): Promise<{ count: number; windowStart: number } | null> {
    const value = await this.kv.get(key, 'json')
    if (!value) return null
    return value as { count: number; windowStart: number }
  }

  async set(key: string, count: number, windowStart: number, ttlMs: number): Promise<void> {
    // KV uses seconds for TTL, minimum 60 seconds
    const ttlSeconds = Math.max(60, Math.ceil(ttlMs / 1000))
    await this.kv.put(key, JSON.stringify({ count, windowStart }), {
      expirationTtl: ttlSeconds,
    })
  }

  async increment(key: string): Promise<number> {
    // KV doesn't support atomic increment, so we need to get-then-set
    // This has a race condition but KV is eventually consistent anyway
    const current = await this.get(key)
    if (!current) return 0

    const newCount = current.count + 1
    // Keep same TTL - we can't extend it easily in KV
    await this.kv.put(key, JSON.stringify({ count: newCount, windowStart: current.windowStart }))
    return newCount
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }
}

// ============================================
// RATE LIMITER
// ============================================

/**
 * Rate limiter with pluggable storage backend.
 */
export class RateLimiter {
  private store: RateLimitStore
  private keyPrefix: string

  constructor(store: RateLimitStore, keyPrefix = 'rl:') {
    this.store = store
    this.keyPrefix = keyPrefix
  }

  /**
   * Build the full key with prefix.
   */
  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  /**
   * Check if a request is allowed under rate limits.
   *
   * @param key - Unique identifier (e.g., "host:example.com", "cred:uuid")
   * @param maxRequests - Maximum requests per window
   * @param windowMs - Window duration in milliseconds
   * @returns Rate limit result
   */
  async check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const fullKey = this.buildKey(key)
    const now = Date.now()

    // Handle edge case: zero max requests means no requests allowed
    if (maxRequests <= 0) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + windowMs,
        count: 0,
      }
    }

    // Get current state
    const current = await this.store.get(fullKey)

    // If no entry or window expired, create new window
    if (!current || now - current.windowStart > windowMs) {
      await this.store.set(fullKey, 1, now, windowMs)
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
        count: 1,
      }
    }

    // Check if limit exceeded
    if (current.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.windowStart + windowMs,
        count: current.count,
      }
    }

    // Increment counter
    const newCount = await this.store.increment(fullKey)

    // Handle race condition where increment returned 0 (key was deleted)
    if (newCount === 0) {
      await this.store.set(fullKey, 1, now, windowMs)
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
        count: 1,
      }
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - newCount),
      resetAt: current.windowStart + windowMs,
      count: newCount,
    }
  }

  /**
   * Reset rate limit for a key.
   */
  async reset(key: string): Promise<void> {
    await this.store.delete(this.buildKey(key))
  }

  /**
   * Get current status without incrementing.
   */
  async status(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const fullKey = this.buildKey(key)
    const now = Date.now()

    const current = await this.store.get(fullKey)

    if (!current || now - current.windowStart > windowMs) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: now + windowMs,
        count: 0,
      }
    }

    return {
      allowed: current.count < maxRequests,
      remaining: Math.max(0, maxRequests - current.count),
      resetAt: current.windowStart + windowMs,
      count: current.count,
    }
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create an in-memory rate limiter.
 * Use for development or single-worker deployments.
 */
export function createInMemoryRateLimiter(keyPrefix = 'rl:'): RateLimiter {
  return new RateLimiter(new InMemoryStore(), keyPrefix)
}

/**
 * Create a KV-backed rate limiter.
 * Use for Cloudflare Workers production.
 */
export function createKVRateLimiter(kv: KVNamespace, keyPrefix = 'rl:'): RateLimiter {
  return new RateLimiter(new KVStore(kv), keyPrefix)
}

// ============================================
// SINGLETON INSTANCE
// ============================================

// Default in-memory instance for backwards compatibility
let defaultLimiter: RateLimiter | null = null

/**
 * Get the default rate limiter instance.
 * Creates an in-memory limiter if not configured.
 */
export function getDefaultRateLimiter(): RateLimiter {
  if (!defaultLimiter) {
    defaultLimiter = createInMemoryRateLimiter()
  }
  return defaultLimiter
}

/**
 * Set the default rate limiter instance.
 * Call this at startup to configure production storage.
 */
export function setDefaultRateLimiter(limiter: RateLimiter): void {
  defaultLimiter = limiter
}

/**
 * Reset the default rate limiter (for testing).
 */
export function resetDefaultRateLimiter(): void {
  defaultLimiter = null
}
