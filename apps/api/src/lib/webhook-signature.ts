/**
 * Webhook Signature Library
 *
 * Implements HMAC-SHA256 signing and verification for webhook security.
 *
 * Security features:
 * - Cryptographically secure secret generation
 * - PBKDF2 hashing for secret storage (same pattern as API keys)
 * - Timing-safe signature comparison
 * - Replay attack prevention via timestamp validation
 * - Constant-time operations throughout
 *
 * Signature format: sha256=<hex_signature>
 * Signed payload: <timestamp>.<body>
 *
 * @example
 * // Creating a webhook signature (sender side)
 * const signature = await createWebhookSignature(payload, secret, timestamp)
 *
 * // Verifying a webhook signature (receiver side)
 * const isValid = await verifyWebhookSignature(payload, signature, secret, timestamp)
 */

// ============================================
// CONFIGURATION
// ============================================

/**
 * Webhook signature configuration.
 *
 * MAX_TIMESTAMP_AGE_MS: Maximum age of timestamp to prevent replay attacks.
 * 5 minutes is industry standard (Stripe, GitHub, Slack all use 5min).
 * Short enough to prevent replay, long enough for network delays.
 */
const WEBHOOK_CONFIG = {
  MAX_TIMESTAMP_AGE_MS: 5 * 60 * 1000, // 5 minutes
  SIGNATURE_PREFIX: 'sha256=',
  SECRET_LENGTH_BYTES: 32, // 256 bits
  HASH_ALGORITHM: 'SHA-256' as const,
}

/**
 * PBKDF2 configuration for secret storage.
 * Uses same parameters as API key hashing for consistency.
 * Limited to 100k iterations due to Cloudflare Workers constraint.
 */
const PBKDF2_CONFIG = {
  iterations: 100_000,
  hashLength: 32, // 256 bits
  algorithm: 'SHA-256' as const,
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert bytes to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert hex string to bytes.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * IMPORTANT: This function must be used for all signature comparisons.
 * Regular string comparison (===) leaks timing information that can
 * be exploited to forge signatures.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Length mismatch - but still do constant-time work to avoid leaking length
    let _result = 1
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      _result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0)
    }
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================
// SECRET GENERATION & STORAGE
// ============================================

/**
 * Generate a cryptographically secure webhook secret.
 *
 * Format: whsec_<64 hex chars>
 * Total length: 70 characters
 *
 * @returns A new webhook secret
 */
export function generateWebhookSecret(): string {
  const randomBytes = new Uint8Array(WEBHOOK_CONFIG.SECRET_LENGTH_BYTES)
  crypto.getRandomValues(randomBytes)
  const hex = bytesToHex(randomBytes)
  return `whsec_${hex}`
}

/**
 * Generate a random 16-byte salt for PBKDF2 hashing.
 */
export function generateSecretSalt(): string {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return bytesToHex(salt)
}

/**
 * Hash a webhook secret using PBKDF2-SHA256 for secure storage.
 *
 * The plaintext secret is NEVER stored. Only the hash and salt
 * are persisted in the database.
 *
 * @param secret - The webhook secret to hash
 * @param salt - 16-byte hex salt
 * @returns Hex-encoded hash
 */
export async function hashWebhookSecret(secret: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const saltBytes = hexToBytes(salt)

  const keyMaterial = await crypto.subtle.importKey('raw', keyData, 'PBKDF2', false, ['deriveBits'])

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_CONFIG.iterations,
      hash: PBKDF2_CONFIG.algorithm,
    },
    keyMaterial,
    PBKDF2_CONFIG.hashLength * 8
  )

  return bytesToHex(new Uint8Array(derivedBits))
}

/**
 * Verify a webhook secret against its stored hash.
 *
 * @param secret - The secret to verify
 * @param storedHash - The stored PBKDF2 hash
 * @param salt - The salt used for hashing
 * @returns True if the secret matches
 */
export async function verifyWebhookSecret(
  secret: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const computedHash = await hashWebhookSecret(secret, salt)
  return constantTimeCompare(computedHash, storedHash)
}

/**
 * Hash a new webhook secret for storage.
 * Returns all values needed for database storage.
 *
 * @param secret - The webhook secret to hash
 * @returns Object with hash, salt, and prefix
 */
export async function hashNewWebhookSecret(secret: string): Promise<{
  hash: string
  salt: string
  prefix: string
}> {
  const salt = generateSecretSalt()
  const hash = await hashWebhookSecret(secret, salt)
  const prefix = secret.slice(0, 14) // "whsec_" + first 8 chars of hex

  return { hash, salt, prefix }
}

// ============================================
// SIGNATURE CREATION & VERIFICATION
// ============================================

/**
 * Create an HMAC-SHA256 signature for a webhook payload.
 *
 * Signature format: sha256=<hex_signature>
 * Signed data: <timestamp>.<payload>
 *
 * @param payload - The request body as a string
 * @param secret - The webhook secret (plaintext)
 * @param timestamp - Unix timestamp in seconds
 * @returns The signature string
 */
export async function createWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number
): Promise<string> {
  const encoder = new TextEncoder()
  const signedPayload = `${timestamp}.${payload}`

  // Import the secret as HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: WEBHOOK_CONFIG.HASH_ALGORITHM },
    false,
    ['sign']
  )

  // Create the signature
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))

  const signatureHex = bytesToHex(new Uint8Array(signatureBuffer))
  return `${WEBHOOK_CONFIG.SIGNATURE_PREFIX}${signatureHex}`
}

/**
 * Verify an HMAC-SHA256 signature for a webhook payload.
 *
 * Performs:
 * 1. Timestamp validation (replay attack prevention)
 * 2. Signature format validation
 * 3. Constant-time signature comparison
 *
 * @param payload - The request body as a string
 * @param signature - The signature from the request header
 * @param secret - The webhook secret (plaintext)
 * @param timestamp - Unix timestamp in seconds from the request header
 * @returns Verification result with error details if failed
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number
): Promise<WebhookVerificationResult> {
  // 1. Validate timestamp (replay attack prevention)
  const timestampValidation = validateTimestamp(timestamp)
  if (!timestampValidation.valid) {
    return {
      valid: false,
      error: timestampValidation.error,
      code: timestampValidation.code,
    }
  }

  // 2. Validate signature format
  if (!signature.startsWith(WEBHOOK_CONFIG.SIGNATURE_PREFIX)) {
    return {
      valid: false,
      error: 'Invalid signature format. Expected sha256=<signature>',
      code: 'INVALID_SIGNATURE_FORMAT',
    }
  }

  // 3. Compute expected signature
  const expectedSignature = await createWebhookSignature(payload, secret, timestamp)

  // 4. Constant-time comparison
  const isValid = constantTimeCompare(signature, expectedSignature)

  if (!isValid) {
    return {
      valid: false,
      error: 'Signature verification failed',
      code: 'SIGNATURE_MISMATCH',
    }
  }

  return { valid: true }
}

/**
 * Result of webhook signature verification.
 */
export interface WebhookVerificationResult {
  valid: boolean
  error?: string
  code?: WebhookVerificationErrorCode
}

/**
 * Error codes for webhook verification failures.
 */
export type WebhookVerificationErrorCode =
  | 'TIMESTAMP_MISSING'
  | 'TIMESTAMP_EXPIRED'
  | 'TIMESTAMP_FUTURE'
  | 'INVALID_SIGNATURE_FORMAT'
  | 'SIGNATURE_MISMATCH'

/**
 * Validate webhook timestamp for replay attack prevention.
 *
 * Rejects timestamps that are:
 * - Missing or invalid
 * - Too old (> 5 minutes in the past)
 * - In the future (> 1 minute ahead, to allow for clock skew)
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Validation result
 */
export function validateTimestamp(timestamp: number): {
  valid: boolean
  error?: string
  code?: WebhookVerificationErrorCode
} {
  if (!timestamp || isNaN(timestamp)) {
    return {
      valid: false,
      error: 'Missing or invalid timestamp',
      code: 'TIMESTAMP_MISSING',
    }
  }

  const now = Date.now()
  const timestampMs = timestamp * 1000

  // Check if timestamp is too old
  if (now - timestampMs > WEBHOOK_CONFIG.MAX_TIMESTAMP_AGE_MS) {
    return {
      valid: false,
      error: `Timestamp too old. Maximum age is ${WEBHOOK_CONFIG.MAX_TIMESTAMP_AGE_MS / 1000} seconds`,
      code: 'TIMESTAMP_EXPIRED',
    }
  }

  // Check if timestamp is in the future (with 1 minute tolerance for clock skew)
  const futureToleranceMs = 60 * 1000
  if (timestampMs - now > futureToleranceMs) {
    return {
      valid: false,
      error: 'Timestamp is in the future',
      code: 'TIMESTAMP_FUTURE',
    }
  }

  return { valid: true }
}

// ============================================
// HEADER HELPERS
// ============================================

/**
 * Standard header names for webhook signatures.
 */
export const WEBHOOK_HEADERS = {
  /** Signature header for inbound webhooks */
  SIGNATURE: 'X-Webhook-Signature',
  /** Timestamp header for inbound webhooks */
  TIMESTAMP: 'X-Webhook-Timestamp',
  /** Signature header for outbound deliveries */
  GCLAW_SIGNATURE: 'X-GuardianClaw-Signature',
  /** Timestamp header for outbound deliveries */
  GCLAW_TIMESTAMP: 'X-GuardianClaw-Timestamp',
  /** Agent ID header for outbound deliveries */
  GCLAW_AGENT_ID: 'X-GuardianClaw-Agent-Id',
  /** Delivery ID header for outbound deliveries */
  GCLAW_DELIVERY_ID: 'X-GuardianClaw-Delivery-Id',
} as const

/**
 * Parse webhook signature and timestamp from request headers.
 *
 * @param headers - Request headers object or Headers instance
 * @returns Parsed signature and timestamp, or null if missing
 */
export function parseWebhookHeaders(
  headers: Headers | Record<string, string | undefined>
): { signature: string; timestamp: number } | null {
  let signature: string | undefined
  let timestampStr: string | undefined

  if (headers instanceof Headers) {
    signature = headers.get(WEBHOOK_HEADERS.SIGNATURE) || undefined
    timestampStr = headers.get(WEBHOOK_HEADERS.TIMESTAMP) || undefined
  } else {
    signature = headers[WEBHOOK_HEADERS.SIGNATURE]
    timestampStr = headers[WEBHOOK_HEADERS.TIMESTAMP]
  }

  if (!signature || !timestampStr) {
    return null
  }

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return null
  }

  return { signature, timestamp }
}

// ============================================
// IP VALIDATION
// ============================================

/**
 * Validate if a client IP is in the allowed IP list.
 *
 * @param clientIP - The client's IP address
 * @param allowedIPs - Array of allowed IPs (empty = allow all)
 * @returns True if the IP is allowed
 */
export function validateAllowedIP(clientIP: string, allowedIPs: string[]): boolean {
  // Empty array = allow all IPs
  if (!allowedIPs || allowedIPs.length === 0) {
    return true
  }

  // Normalize IP addresses for comparison
  const normalizedClientIP = normalizeIP(clientIP)

  return allowedIPs.some((allowedIP) => {
    const normalizedAllowed = normalizeIP(allowedIP)

    // Exact match
    if (normalizedClientIP === normalizedAllowed) {
      return true
    }

    // CIDR range check (basic implementation for common cases)
    if (allowedIP.includes('/')) {
      return isIPInCIDR(normalizedClientIP, allowedIP)
    }

    return false
  })
}

/**
 * Normalize an IP address for comparison.
 * Handles IPv4-mapped IPv6 addresses.
 */
function normalizeIP(ip: string): string {
  // Remove IPv6 prefix for IPv4-mapped addresses
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7)
  }
  return ip.toLowerCase().trim()
}

/**
 * Check if an IP is within a CIDR range.
 * Supports both IPv4 and IPv6.
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/')
  const mask = parseInt(bits, 10)

  // Detect IPv6 CIDR
  if (range.includes(':')) {
    return isIPv6InCIDR(ip, range, mask)
  }

  if (isNaN(mask) || mask < 0 || mask > 32) {
    return false
  }

  // Special case: /0 matches all IPs
  if (mask === 0) {
    return true
  }

  const ipParts = ip.split('.').map(Number)
  const rangeParts = range.split('.').map(Number)

  if (ipParts.length !== 4 || rangeParts.length !== 4) {
    return false
  }

  // Use unsigned 32-bit arithmetic
  const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0
  const rangeNum =
    ((rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3]) >>> 0
  const maskNum = ~((1 << (32 - mask)) - 1) >>> 0

  return (ipNum & maskNum) === (rangeNum & maskNum)
}

/**
 * Convert an IPv6 address to BigInt for CIDR comparison.
 * Handles :: shorthand expansion.
 */
function ipv6ToBigInt(ip: string): bigint | null {
  // Expand :: shorthand
  let parts: string[]
  if (ip.includes('::')) {
    const [left, right] = ip.split('::')
    const leftParts = left ? left.split(':') : []
    const rightParts = right ? right.split(':') : []
    const missing = 8 - leftParts.length - rightParts.length
    if (missing < 0) return null
    parts = [...leftParts, ...Array(missing).fill('0'), ...rightParts]
  } else {
    parts = ip.split(':')
  }

  if (parts.length !== 8) return null

  let result = 0n
  for (const part of parts) {
    const val = parseInt(part, 16)
    if (isNaN(val) || val < 0 || val > 0xffff) return null
    result = (result << 16n) | BigInt(val)
  }
  return result
}

/**
 * Check if an IPv6 address is within a CIDR range using BigInt arithmetic.
 */
function isIPv6InCIDR(ip: string, range: string, mask: number): boolean {
  if (isNaN(mask) || mask < 0 || mask > 128) return false
  if (mask === 0) return true

  // Only match IPv6 against IPv6
  if (!ip.includes(':')) return false

  const ipNum = ipv6ToBigInt(ip)
  const rangeNum = ipv6ToBigInt(range)

  if (ipNum === null || rangeNum === null) return false

  const shift = BigInt(128 - mask)
  return ipNum >> shift === rangeNum >> shift
}
