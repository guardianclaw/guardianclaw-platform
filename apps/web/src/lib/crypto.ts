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
 * Get the HMAC secret from environment variables
 * Throws descriptive error if not configured
 */
function getHmacSecret(providedSecret?: string): string {
  // Use provided secret if given
  if (providedSecret) {
    return providedSecret
  }

  // Try to get from environment variable
  const envSecret = process.env.NEXT_PUBLIC_DEMO_HMAC_SECRET

  if (!envSecret) {
    throw new Error(
      'HMAC secret not configured. ' +
        'Set NEXT_PUBLIC_DEMO_HMAC_SECRET environment variable or provide secret parameter. ' +
        'See .env.example for configuration.'
    )
  }

  return envSecret
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
  const actualSecret = getHmacSecret(secret)
  const message = typeof data === 'string' ? data : JSON.stringify(data)
  const key = await importKey(actualSecret)
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
