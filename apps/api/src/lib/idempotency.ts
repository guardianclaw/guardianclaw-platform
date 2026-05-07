/**
 * Idempotency Layer
 *
 * Prevents duplicate request execution using KV storage with memory fallback.
 * Same pattern as KVRateLimiter: KV first, memory fallback if unavailable.
 *
 * Supports both explicit Idempotency-Key header and auto-generated keys
 * based on sha256(api_key_id + agent_id + message_body).
 */

export interface IdempotencyEntry {
  status: 'processing' | 'complete'
  response?: unknown
  statusCode?: number
  created_at: string
}

const TTL_SECONDS = 86400 // 24 hours
const memoryFallback = new Map<string, IdempotencyEntry>()

/**
 * Generate a deterministic key from request properties.
 * Used when the client doesn't provide an Idempotency-Key header.
 */
export async function generateAutoKey(
  apiKeyId: string,
  agentId: string,
  body: string
): Promise<string> {
  const data = new TextEncoder().encode(`${apiKeyId}:${agentId}:${body}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class IdempotencyLayer {
  private kv: KVNamespace | null

  constructor(kv: KVNamespace | null) {
    this.kv = kv
  }

  /**
   * Check if a request with this key has been seen before.
   * Returns the cached entry if found, null for new requests.
   */
  async check(key: string): Promise<IdempotencyEntry | null> {
    const kvKey = `idem:${key}`

    if (this.kv) {
      try {
        const stored = await this.kv.get(kvKey, 'json')
        if (stored) return stored as IdempotencyEntry
      } catch {
        // Fall through to memory
      }
    }

    return memoryFallback.get(kvKey) || null
  }

  /**
   * Mark a request as currently being processed.
   */
  async markProcessing(key: string): Promise<void> {
    const kvKey = `idem:${key}`
    const entry: IdempotencyEntry = {
      status: 'processing',
      created_at: new Date().toISOString(),
    }

    if (this.kv) {
      try {
        await this.kv.put(kvKey, JSON.stringify(entry), { expirationTtl: TTL_SECONDS })
        return
      } catch {
        // Fall through to memory
      }
    }

    memoryFallback.set(kvKey, entry)
  }

  /**
   * Mark a request as complete and cache its response.
   */
  async markComplete(key: string, response: unknown, statusCode: number): Promise<void> {
    const kvKey = `idem:${key}`
    const entry: IdempotencyEntry = {
      status: 'complete',
      response,
      statusCode,
      created_at: new Date().toISOString(),
    }

    if (this.kv) {
      try {
        await this.kv.put(kvKey, JSON.stringify(entry), { expirationTtl: TTL_SECONDS })
        return
      } catch {
        // Fall through to memory
      }
    }

    memoryFallback.set(kvKey, entry)
  }

  /**
   * Remove a key to allow retry after failure.
   */
  async remove(key: string): Promise<void> {
    const kvKey = `idem:${key}`

    if (this.kv) {
      try {
        await this.kv.delete(kvKey)
      } catch {
        // ignore
      }
    }

    memoryFallback.delete(kvKey)
  }
}
