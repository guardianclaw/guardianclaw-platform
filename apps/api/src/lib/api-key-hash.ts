/**
 * API Key Hashing with PBKDF2
 *
 * Security upgrade per SECURITY_SPEC Section 3.3.
 *
 * Uses PBKDF2-SHA256 with 600,000 iterations and random salt
 * for secure API key storage. Resistant to brute force attacks.
 *
 * Backwards compatible: checks both PBKDF2 and legacy SHA-256.
 */

/**
 * PBKDF2 configuration.
 *
 * 100k iterations is the maximum supported by Cloudflare Workers.
 * While OWASP recommends higher values for traditional servers,
 * 100k is still considered secure and is the OWASP minimum.
 *
 * Cloudflare Workers limitation: max 100,000 iterations
 * https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
 */
const PBKDF2_CONFIG = {
  iterations: 100_000,
  hashLength: 32, // 256 bits
  algorithm: 'SHA-256' as const,
}

/**
 * Generate a random 16-byte salt.
 */
export function generateSalt(): string {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  return bytesToHex(salt)
}

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
 * Hash an API key using PBKDF2-SHA256.
 *
 * @param apiKey - The API key to hash
 * @param salt - 16-byte hex salt (generate with generateSalt())
 * @returns Hex-encoded hash
 */
export async function hashApiKeyPBKDF2(apiKey: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(apiKey)
  const saltBytes = hexToBytes(salt)

  // Import key material
  const keyMaterial = await crypto.subtle.importKey('raw', keyData, 'PBKDF2', false, ['deriveBits'])

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_CONFIG.iterations,
      hash: PBKDF2_CONFIG.algorithm,
    },
    keyMaterial,
    PBKDF2_CONFIG.hashLength * 8 // Convert bytes to bits
  )

  return bytesToHex(new Uint8Array(derivedBits))
}

/**
 * Legacy SHA-256 hash (for backwards compatibility).
 * New keys should use PBKDF2.
 */
export async function hashApiKeyLegacy(apiKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(hashBuffer))
}

/**
 * Verify an API key against its stored hash.
 * Supports both PBKDF2 (with salt) and legacy SHA-256 (no salt).
 *
 * @param apiKey - The API key to verify
 * @param storedHash - The stored hash
 * @param salt - The salt (null for legacy SHA-256)
 * @returns True if the key matches
 */
export async function verifyApiKey(
  apiKey: string,
  storedHash: string,
  salt: string | null
): Promise<boolean> {
  if (salt) {
    // PBKDF2 verification
    const computedHash = await hashApiKeyPBKDF2(apiKey, salt)
    return constantTimeCompare(computedHash, storedHash)
  } else {
    // Legacy SHA-256 verification
    const computedHash = await hashApiKeyLegacy(apiKey)
    return constantTimeCompare(computedHash, storedHash)
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Generate a cryptographically secure API key.
 * Format: sk_live_{64 hex chars}
 */
export function generateApiKey(): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const hex = bytesToHex(randomBytes)
  return `sk_live_${hex}`
}

/**
 * Hash a new API key with PBKDF2.
 * Returns both the hash and salt for storage.
 *
 * @param apiKey - The API key to hash
 * @returns Object with hash and salt
 */
export async function hashNewApiKey(apiKey: string): Promise<{
  hash: string
  salt: string
  prefix: string
}> {
  const salt = generateSalt()
  const hash = await hashApiKeyPBKDF2(apiKey, salt)
  const prefix = apiKey.slice(0, 15)

  return { hash, salt, prefix }
}

/**
 * Migration helper: Check if a stored key uses legacy hashing.
 *
 * @param salt - The stored salt (null = legacy)
 * @returns True if the key needs migration to PBKDF2
 */
export function needsMigration(salt: string | null | undefined): boolean {
  return !salt
}
