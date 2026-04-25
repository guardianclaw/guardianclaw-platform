/**
 * Cryptographic utilities using Web Crypto API
 * Real HMAC-SHA256 implementation for Memory Shield
 *
 * Security Note: Never hardcode secrets in source code.
 * All secrets must come from environment variables.
 *
 * Reference: SECURITY_SPEC.md Section 9.1
 */

/**
 * Get the HMAC key from environment variables.
 *
 * The value lives in a NEXT_PUBLIC_* variable and is therefore embedded
 * in the browser bundle. It is NOT a secret; it exists so the Memory
 * Shield demo can show a deterministic signature flow. Naming reflects
 * that reality: "_KEY" not "_SECRET".
 *
 * Throws descriptive error if not configured.
 */
function getHmacKey(providedKey?: string): string {
  // Use provided value if given
  if (providedKey) {
    return providedKey
  }

  // Canonical variable name
  const envKey = process.env.NEXT_PUBLIC_DEMO_HMAC_KEY
  if (envKey) {
    return envKey
  }

  // Deprecated alias — accept during Vercel env migration, warn once per session
  const legacyEnvKey = process.env.NEXT_PUBLIC_DEMO_HMAC_SECRET
  if (legacyEnvKey) {
    if (typeof window !== 'undefined' && !(window as typeof window & { __hmacLegacyWarned?: boolean }).__hmacLegacyWarned) {
      console.warn(
        'NEXT_PUBLIC_DEMO_HMAC_SECRET is deprecated. Rename to NEXT_PUBLIC_DEMO_HMAC_KEY. ' +
          'The value is public (NEXT_PUBLIC_*) and was never a real secret.'
      )
      ;(window as typeof window & { __hmacLegacyWarned?: boolean }).__hmacLegacyWarned = true
    }
    return legacyEnvKey
  }

  throw new Error(
    'HMAC key not configured. ' +
      'Set NEXT_PUBLIC_DEMO_HMAC_KEY environment variable or provide key parameter. ' +
      'See .env.example for configuration.'
  )
}

// Convert string to ArrayBuffer
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(str)
  // Create a copy of the buffer to ensure we get a proper ArrayBuffer
  const buffer = new ArrayBuffer(encoded.length)
  new Uint8Array(buffer).set(encoded)
  return buffer
}

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Import key for HMAC
async function importKey(secret: string): Promise<CryptoKey> {
  const keyData = stringToArrayBuffer(secret)
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

/**
 * Compute HMAC-SHA256 of data
 * @param data - The data to sign (will be JSON.stringified if object)
 * @param secret - The secret key (optional, uses env var if not provided)
 * @returns Hex-encoded HMAC signature with sha256: prefix
 */
export async function computeHmac(data: unknown, secret?: string): Promise<string> {
  const resolvedKey = getHmacKey(secret)
  const message = typeof data === 'string' ? data : JSON.stringify(data)
  const key = await importKey(resolvedKey)
  const messageBuffer = stringToArrayBuffer(message)
  const signature = await crypto.subtle.sign('HMAC', key, messageBuffer)
  return `sha256:${arrayBufferToHex(signature)}`
}

/**
 * Verify HMAC-SHA256 signature
 * @param data - The data to verify
 * @param expectedHmac - The expected HMAC signature
 * @param secret - The secret key (optional, uses env var if not provided)
 * @returns True if signature matches
 */
export async function verifyHmac(
  data: unknown,
  expectedHmac: string,
  secret?: string
): Promise<boolean> {
  const computedHmac = await computeHmac(data, secret)
  return computedHmac === expectedHmac
}

/**
 * Sign memory data with timestamp
 * @param data - The data object to sign
 * @param secret - The secret key (optional, uses env var if not provided)
 * @returns Signed memory object with data, hmac, and timestamp
 */
export async function signMemory<T extends object>(
  data: T,
  secret?: string
): Promise<{
  data: T
  hmac: string
  timestamp: number
}> {
  const timestamp = Date.now()
  const hmac = await computeHmac({ ...data, timestamp }, secret)
  return {
    data,
    hmac,
    timestamp,
  }
}

/**
 * Verify memory signature and detect tampering
 * @param signedMemory - The signed memory object to verify
 * @param secret - The secret key (optional, uses env var if not provided)
 * @returns Verification result with computed vs expected HMAC
 */
export async function verifyMemory<T extends object>(
  signedMemory: {
    data: T
    hmac: string
    timestamp: number
  },
  secret?: string
): Promise<{
  isValid: boolean
  expectedHmac: string
  computedHmac: string
}> {
  const computedHmac = await computeHmac(
    { ...signedMemory.data, timestamp: signedMemory.timestamp },
    secret
  )
  return {
    isValid: computedHmac === signedMemory.hmac,
    expectedHmac: signedMemory.hmac,
    computedHmac,
  }
}

/**
 * Compare two objects and find differences
 * @param original - The original object
 * @param modified - The modified object to compare
 * @returns Array of keys that differ between the objects
 */
export function findDifferences<T extends object>(original: T, modified: T): string[] {
  const diffs: string[] = []
  const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]) as Set<keyof T>

  for (const key of allKeys) {
    if (original[key] !== modified[key]) {
      diffs.push(String(key))
    }
  }

  return diffs
}
