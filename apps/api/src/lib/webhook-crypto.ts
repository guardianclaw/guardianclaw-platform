/**
 * Webhook Secret Encryption Library
 *
 * Provides AES-256-GCM encryption for webhook secrets.
 *
 * Unlike API keys (which use one-way PBKDF2 hashing), webhook secrets
 * need to be recoverable for HMAC signature verification. We encrypt
 * them using AES-256-GCM with a key derived from the server's JWT_SECRET.
 *
 * Security properties:
 * - AES-256-GCM provides authenticated encryption (confidentiality + integrity)
 * - 96-bit IV (recommended for GCM) with random generation
 * - 128-bit authentication tag (default for Web Crypto API)
 * - Key derived from JWT_SECRET using PBKDF2 for key separation
 *
 * @example
 * // Encrypt a secret
 * const { encrypted, iv } = await encryptWebhookSecret(secret, serverKey)
 *
 * // Decrypt for verification
 * const plaintext = await decryptWebhookSecret(encrypted, iv, serverKey)
 */

// ============================================
// CONFIGURATION
// ============================================

const CRYPTO_CONFIG = {
  ALGORITHM: 'AES-GCM' as const,
  KEY_LENGTH: 256,
  IV_LENGTH_BYTES: 12, // 96 bits - recommended for GCM
  SALT: 'claw-webhook-secret-v1', // Static salt for key derivation
  PBKDF2_ITERATIONS: 100_000,
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
 * Convert bytes to base64 string.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert base64 string to bytes.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ============================================
// KEY DERIVATION
// ============================================

/**
 * Derive an AES-256 key from the server secret.
 *
 * Uses PBKDF2 to derive a separate key for webhook encryption,
 * preventing key reuse with other cryptographic operations.
 *
 * @param serverSecret - The server's JWT_SECRET
 * @returns A CryptoKey for AES-256-GCM operations
 */
async function deriveEncryptionKey(serverSecret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()

  // Import server secret as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSecret),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive AES key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(CRYPTO_CONFIG.SALT),
      iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: CRYPTO_CONFIG.ALGORITHM,
      length: CRYPTO_CONFIG.KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  )
}

// ============================================
// ENCRYPTION / DECRYPTION
// ============================================

/**
 * Encrypt a webhook secret using AES-256-GCM.
 *
 * @param secret - The webhook secret to encrypt
 * @param serverSecret - The server's JWT_SECRET
 * @returns Object with encrypted ciphertext and IV (both base64-encoded)
 */
export async function encryptWebhookSecret(
  secret: string,
  serverSecret: string
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder()

  // Generate random IV
  const iv = new Uint8Array(CRYPTO_CONFIG.IV_LENGTH_BYTES)
  crypto.getRandomValues(iv)

  // Derive encryption key
  const key = await deriveEncryptionKey(serverSecret)

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: CRYPTO_CONFIG.ALGORITHM,
      iv,
    },
    key,
    encoder.encode(secret)
  )

  return {
    encrypted: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  }
}

/**
 * Decrypt a webhook secret using AES-256-GCM.
 *
 * @param encrypted - The encrypted ciphertext (base64-encoded)
 * @param iv - The initialization vector (base64-encoded)
 * @param serverSecret - The server's JWT_SECRET
 * @returns The decrypted webhook secret
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptWebhookSecret(
  encrypted: string,
  iv: string,
  serverSecret: string
): Promise<string> {
  const decoder = new TextDecoder()

  // Derive encryption key
  const key = await deriveEncryptionKey(serverSecret)

  // Decrypt
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: CRYPTO_CONFIG.ALGORITHM,
        iv: base64ToBytes(iv) as BufferSource,
      },
      key,
      base64ToBytes(encrypted) as BufferSource
    )

    return decoder.decode(plaintext)
  } catch (error) {
    // AES-GCM throws on authentication failure (tampered data or wrong key)
    throw new Error('Failed to decrypt webhook secret: authentication failed')
  }
}

/**
 * Encrypt a new webhook secret for storage.
 * Returns all values needed for database storage.
 *
 * @param secret - The webhook secret to encrypt
 * @param serverSecret - The server's JWT_SECRET
 * @returns Object with encrypted, iv, and prefix
 */
export async function encryptNewWebhookSecret(
  secret: string,
  serverSecret: string
): Promise<{
  encrypted: string
  iv: string
  prefix: string
}> {
  const { encrypted, iv } = await encryptWebhookSecret(secret, serverSecret)
  const prefix = secret.slice(0, 14) // "whsec_" + first 8 chars of hex

  return { encrypted, iv, prefix }
}

// ============================================
// EXPORTS
// ============================================

export { bytesToHex, hexToBytes, bytesToBase64, base64ToBytes }
