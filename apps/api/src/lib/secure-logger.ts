/**
 * Secure Logger — PII Scrubbing & IP Hashing
 *
 * Reference: SECURITY_SPEC.md Section 9.2
 *
 * Security features:
 * - Pattern-based PII detection in string values
 * - IP hashing with daily salt rotation
 * - Wallet address hashing for logs
 * - Security event logging level
 *
 * What NEVER to log (enforced by scrubbing):
 * - Full API keys (LLM keys, our API keys)
 * - JWT tokens or session tokens
 * - Private keys
 * - Prompt/output content
 * - Unsanitized error messages with user data
 */

/**
 * PII patterns to detect in string values.
 * These patterns are matched against ALL string values in log data,
 * not just specific field names.
 *
 * Reference: SECURITY_SPEC.md Section 9.2.4
 */
export const PII_PATTERNS: ReadonlyMap<string, RegExp> = new Map([
  // API Keys - OpenAI format (sk-proj- or sk- followed by alphanumeric, min 20 chars)
  // Real OpenAI keys have 48+ chars after prefix, 20 is a safe minimum
  ['API_KEY_OPENAI', /sk-(?:proj-)?[a-zA-Z0-9]{20,}/g],

  // API Keys - Anthropic format (min 20 chars)
  // Real Anthropic keys have 40+ chars after prefix
  ['API_KEY_ANTHROPIC', /sk-ant-[a-zA-Z0-9_-]{20,}/g],

  // JWT tokens (header.payload.signature format)
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*/g],

  // Email addresses
  ['EMAIL', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],

  // Phone numbers (various formats)
  ['PHONE', /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g],

  // Credit card numbers (with or without spaces/dashes)
  ['CREDIT_CARD', /\b(?:[0-9]{4}[-\s]?){3}[0-9]{4}\b/g],

  // Private keys (64 hex chars - common for crypto)
  ['PRIVATE_KEY', /\b[0-9a-fA-F]{64}\b/g],

  // Bearer tokens in headers
  ['BEARER_TOKEN', /Bearer\s+[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*\.?[A-Za-z0-9_-]*/gi],

  // Generic long secrets (40+ alphanumeric chars, likely secrets)
  ['LONG_SECRET', /\b[A-Za-z0-9]{40,}\b/g],
])

/**
 * Field names that should always be redacted regardless of value.
 */
const SENSITIVE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'privatekey',
  'private_key',
  'seed',
  'mnemonic',
  'signature',
  'credentials',
  'bearer',
])

/**
 * Hash an IP address with a daily-rotating salt.
 * This allows rate limiting to work (hash is consistent within a day)
 * while preventing long-term correlation.
 *
 * Reference: SECURITY_SPEC.md Section 9.2.6
 *
 * @param ip - The IP address to hash
 * @param secret - The IP_HASH_SECRET from environment
 * @returns A 16-character hex hash
 */
export async function hashIP(ip: string, secret: string): Promise<string> {
  // Daily salt - rotates at midnight UTC
  const dailySalt = new Date().toISOString().split('T')[0] // "2026-01-11"

  const data = `${ip}:${dailySalt}:${secret}`
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))

  // Convert to hex and take first 16 chars
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16)
}

/**
 * Hash a wallet address for logs (pseudonymization).
 * Uses a consistent hash so we can correlate within logs.
 *
 * @param wallet - The wallet address to hash
 * @returns A 16-character hex hash
 */
export async function hashWallet(wallet: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(wallet))

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16)
}

/**
 * @deprecated Use hashWallet (async SHA-256) instead.
 * This function uses a non-cryptographic hash and should not be used for security.
 *
 * Synchronous version of hashWallet for legacy compatibility.
 * Uses djb2 hash - NOT cryptographically secure.
 */
export function hashWalletSync(wallet: string): string {
  console.warn('[Security] hashWalletSync is deprecated - use hashWallet (SHA-256) instead')
  // Simple djb2 hash - NOT cryptographic, for backwards compatibility only
  let hash = 5381
  for (let i = 0; i < wallet.length; i++) {
    hash = ((hash << 5) + hash) ^ wallet.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Scrub a single string value for PII patterns.
 */
function scrubStringValue(value: string): string {
  let result = value

  for (const [type, pattern] of PII_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0
    result = result.replace(pattern, `[REDACTED_${type}]`)
  }

  return result
}

/**
 * Check if a field name is sensitive.
 */
function isSensitiveFieldName(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return Array.from(SENSITIVE_FIELD_NAMES).some((sensitive) => lowerKey.includes(sensitive))
}

/**
 * Recursively scrub PII from any data structure.
 * Handles objects, arrays, and primitive values.
 *
 * Order of operations:
 * 1. For strings: first apply PII pattern matching
 * 2. For objects with sensitive field names:
 *    - If value is an object, recurse into it
 *    - If value is a primitive string, redact it
 *
 * Reference: SECURITY_SPEC.md Section 9.2.4
 *
 * @param data - The data to scrub
 * @param depth - Current recursion depth (prevents infinite loops)
 * @returns The scrubbed data
 */
export function scrubPII<T>(data: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]' as unknown as T
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data
  }

  // Handle strings - apply PII pattern matching
  if (typeof data === 'string') {
    return scrubStringValue(data) as unknown as T
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => scrubPII(item, depth + 1)) as unknown as T
  }

  // Handle objects
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = isSensitiveFieldName(key)

      if (typeof value === 'string') {
        // For strings: first try pattern matching, then check field name
        const scrubbed = scrubStringValue(value)
        // If pattern matching changed the value, use that result
        // Otherwise, if field name is sensitive, redact
        if (scrubbed !== value) {
          result[key] = scrubbed
        } else if (isSensitiveKey) {
          result[key] = '[REDACTED]'
        } else {
          result[key] = value
        }
      } else if (typeof value === 'object' && value !== null) {
        // For objects: always recurse, even if field name is sensitive
        // This allows us to redact nested sensitive fields properly
        result[key] = scrubPII(value, depth + 1)
      } else {
        // For other primitives (numbers, booleans)
        result[key] = value
      }
    }

    return result as unknown as T
  }

  // Return primitives as-is
  return data
}

/**
 * Security event types for structured logging.
 *
 * Currently implemented:
 * - auth_success, auth_failure, invalid_signature (Sprint 2)
 *
 * Planned for future sprints:
 * - rate_limit_exceeded (Sprint 3: API Security)
 * - csrf_blocked, ssrf_attempt (Sprint 3: API Security)
 * - session_created/expired/revoked (Sprint 6: Auth Hardening)
 * - api_key_created/revoked (Sprint 4: Zero-Knowledge Keys)
 * - data_export/deletion_requested (Sprint 5: GDPR Compliance)
 */
export type SecurityEventType =
  // Currently implemented
  | 'auth_success'
  | 'auth_failure'
  | 'invalid_signature'
  // Sprint 3: API Security
  | 'auth_blocked'
  | 'rate_limit_exceeded'
  | 'csrf_blocked'
  | 'ssrf_attempt'
  | 'ssrf_blocked'
  // Sprint 4: Zero-Knowledge Keys
  | 'api_key_created'
  | 'api_key_revoked'
  // Sprint 5: GDPR Compliance
  | 'data_export_requested'
  | 'data_deletion_requested'
  // Sprint 6: Auth Hardening
  | 'session_created'
  | 'session_expired'
  | 'session_revoked'
  // Webhook triggers
  | 'webhook_trigger_missing_headers'
  | 'webhook_trigger_not_found'
  | 'webhook_trigger_ip_denied'
  | 'webhook_trigger_rate_limited'
  | 'webhook_trigger_decrypt_failed'
  | 'webhook_trigger_signature_invalid'
  | 'webhook_trigger_error'
  // General
  | 'suspicious_activity'
  | 'session_blocked'

/**
 * Security log entry structure.
 */
export interface SecurityLogEntry {
  timestamp: string
  level: 'security'
  event: SecurityEventType
  ip_hash?: string
  wallet_hash?: string
  details?: Record<string, unknown>
  request_id?: string
}

/**
 * Secure Logger class with IP hashing and security events.
 *
 * Usage:
 * ```typescript
 * const logger = new SecureLogger(env.IP_HASH_SECRET)
 * await logger.security('auth_failure', { reason: 'invalid_signature' }, ip, wallet)
 * ```
 */
export class SecureLogger {
  private ipHashSecret: string

  constructor(ipHashSecret?: string) {
    this.ipHashSecret = ipHashSecret || 'default-dev-secret'

    if (!ipHashSecret && process.env.NODE_ENV !== 'test') {
      console.warn('[SecureLogger] IP_HASH_SECRET not provided, using default. Set in production!')
    }
  }

  /**
   * Log a security event.
   * Automatically hashes IP and wallet, scrubs all data.
   */
  async security(
    event: SecurityEventType,
    details?: Record<string, unknown>,
    ip?: string,
    wallet?: string,
    requestId?: string
  ): Promise<void> {
    const entry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'security',
      event,
      request_id: requestId,
    }

    if (ip) {
      entry.ip_hash = await hashIP(ip, this.ipHashSecret)
    }

    if (wallet) {
      entry.wallet_hash = await hashWallet(wallet)
    }

    if (details) {
      entry.details = scrubPII(details)
    }

    // Output as JSON for structured logging
    console.log(JSON.stringify(entry))
  }

  /**
   * Log a general info message with PII scrubbing.
   * @param message - Log message
   * @param data - Additional data to log
   * @param ip - Raw IP address (will be hashed with SHA-256)
   */
  async info(message: string, data?: Record<string, unknown>, ip?: string): Promise<void> {
    await this.logWithScrubbing('info', message, data, ip)
  }

  /**
   * Log a warning with PII scrubbing.
   * @param message - Log message
   * @param data - Additional data to log
   * @param ip - Raw IP address (will be hashed with SHA-256)
   */
  async warn(message: string, data?: Record<string, unknown>, ip?: string): Promise<void> {
    await this.logWithScrubbing('warn', message, data, ip)
  }

  /**
   * Log an error with PII scrubbing.
   * @param message - Log message
   * @param data - Additional data to log
   * @param ip - Raw IP address (will be hashed with SHA-256)
   */
  async error(message: string, data?: Record<string, unknown>, ip?: string): Promise<void> {
    await this.logWithScrubbing('error', message, data, ip)
  }

  /**
   * Internal method to log with PII scrubbing and SHA-256 IP hashing.
   */
  private async logWithScrubbing(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
    ip?: string
  ): Promise<void> {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message: scrubPII(message),
    }

    if (data) {
      Object.assign(entry, scrubPII(data))
    }

    // Hash IP using SHA-256 with daily salt
    if (ip) {
      entry.ip_hash = await hashIP(ip, this.ipHashSecret)
    }

    const output = JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }
  }
}

/**
 * Create a configured SecureLogger instance.
 *
 * @param env - Environment variables containing IP_HASH_SECRET
 * @returns SecureLogger instance
 */
export function createSecureLogger(env?: { IP_HASH_SECRET?: string }): SecureLogger {
  return new SecureLogger(env?.IP_HASH_SECRET)
}
