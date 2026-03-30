/**
 * KV Rate Limiter
 *
 * Persistent rate limiting using Cloudflare KV storage.
 * Survives worker restarts and works across edge locations.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

export interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * Rate limiter using Cloudflare KV for persistence.
 * Falls back to in-memory storage when KV is unavailable.
 */
export class KVRateLimiter {
  private kv: KVNamespace | null
  private memoryFallback: Map<string, RateLimitEntry>
  private keyPrefix: string

  constructor(kv: KVNamespace | null, keyPrefix = 'rate:') {
    this.kv = kv
    this.memoryFallback = new Map()
    this.keyPrefix = keyPrefix
  }

  /**
   * Check if a request is allowed under the rate limit.
   *
   * @param key - Unique identifier (e.g., API key ID, IP address)
   * @param limit - Maximum requests allowed in the window
   * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   * @returns Rate limit check result
   */
  async checkLimit(key: string, limit: number, windowMs = 60_000): Promise<RateLimitResult> {
    const now = Date.now()
    const kvKey = `${this.keyPrefix}${key}`

    let entry: RateLimitEntry | null = null

    // Try to get from KV
    if (this.kv) {
      try {
        const stored = await this.kv.get(kvKey, 'json')
        if (stored) {
          entry = stored as RateLimitEntry
        }
      } catch (error) {
        console.warn('KV rate limiter read error:', error)
      }
    }

    // Fallback to memory if KV unavailable or failed
    if (!entry && !this.kv) {
      entry = this.memoryFallback.get(key) || null
    }

    // Check if entry is expired or doesn't exist
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
    }

    // Increment count
    entry.count++

    // Persist to KV or memory
    if (this.kv) {
      try {
        // TTL in seconds, add buffer to ensure cleanup
        const ttlSeconds = Math.ceil(windowMs / 1000) + 60
        await this.kv.put(kvKey, JSON.stringify(entry), {
          expirationTtl: ttlSeconds,
        })
      } catch (error) {
        console.warn('KV rate limiter write error:', error)
        // Fallback to memory on write failure
        this.memoryFallback.set(key, entry)
      }
    } else {
      this.memoryFallback.set(key, entry)
    }

    // Check if over limit
    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
      }
    }

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt,
    }
  }

  /**
   * Reset rate limit for a specific key.
   * Useful for testing or administrative purposes.
   */
  async reset(key: string): Promise<void> {
    const kvKey = `${this.keyPrefix}${key}`

    if (this.kv) {
      try {
        await this.kv.delete(kvKey)
      } catch (error) {
        console.warn('KV rate limiter delete error:', error)
      }
    }

    this.memoryFallback.delete(key)
  }

  /**
   * Get current rate limit status for a key without incrementing.
   */
  async getStatus(key: string): Promise<RateLimitEntry | null> {
    const kvKey = `${this.keyPrefix}${key}`

    if (this.kv) {
      try {
        const stored = await this.kv.get(kvKey, 'json')
        return stored as RateLimitEntry | null
      } catch (error) {
        console.warn('KV rate limiter status error:', error)
      }
    }

    return this.memoryFallback.get(key) || null
  }

  /**
   * Check if KV storage is available.
   */
  isKVEnabled(): boolean {
    return this.kv !== null
  }
}

/**
 * Create a rate limiter instance.
 * Accepts optional KV namespace - if null, uses memory fallback.
 */
export function createRateLimiter(kv: KVNamespace | null, keyPrefix = 'rate:'): KVRateLimiter {
  return new KVRateLimiter(kv, keyPrefix)
}

/**
 * Simple in-memory rate limiter for environments without KV.
 * Used as fallback and for testing.
 */
export class InMemoryRateLimiter {
  private entries: Map<string, RateLimitEntry>

  constructor() {
    this.entries = new Map()
  }

  checkLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
    const now = Date.now()
    let entry = this.entries.get(key)

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
    }

    entry.count++
    this.entries.set(key, entry)

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
      }
    }

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt,
    }
  }

  reset(key: string): void {
    this.entries.delete(key)
  }

  getStatus(key: string): RateLimitEntry | null {
    return this.entries.get(key) || null
  }

  clear(): void {
    this.entries.clear()
  }
}
