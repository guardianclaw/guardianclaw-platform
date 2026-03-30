/**
 * Zero-Knowledge API Key Encryption
 *
 * Client-side encryption for LLM API keys using:
 * - PBKDF2-SHA256 (600,000 iterations) for key derivation
 * - AES-256-GCM for authenticated encryption
 *
 * The server NEVER sees plaintext keys - only encrypted blobs.
 * Encryption key is derived from wallet signature.
 *
 * Security note: 600k iterations per OWASP 2023 recommendations for
 * PBKDF2-SHA256. This provides ~240ms derivation time which is acceptable
 * for key encryption operations (not login rate limiting).
 */

export interface EncryptedKey {
  ciphertext: string // Base64 encoded
  iv: string // Base64 encoded
  salt: string // Base64 encoded
  key_preview: string // Last 4 chars for identification
}

// Crypto configuration
// 600k iterations per OWASP 2023 guidelines for PBKDF2-SHA256
// This balances security with acceptable UX (~200-300ms derivation)
const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16 // 128 bits
const IV_LENGTH = 12 // 96 bits (GCM standard)
const KEY_LENGTH = 256 // AES-256

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Convert Uint8Array to a proper ArrayBuffer
 * This ensures compatibility with SubtleCrypto in all environments
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.length)
  new Uint8Array(buffer).set(data)
  return buffer
}

/**
 * Derive encryption key from wallet signature using PBKDF2
 *
 * @param signature - Wallet signature bytes
 * @param salt - Random salt (16 bytes)
 * @returns CryptoKey for AES-256-GCM
 */
export async function deriveKeyFromSignature(
  signature: Uint8Array,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import signature as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(signature),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derive AES-256 key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt an API key using AES-256-GCM
 *
 * @param apiKey - Plaintext API key
 * @param walletSignature - Signature from wallet for key derivation
 * @returns Encrypted key with metadata
 */
export async function encryptApiKey(
  apiKey: string,
  walletSignature: Uint8Array
): Promise<EncryptedKey> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Derive encryption key
  const derivedKey = await deriveKeyFromSignature(walletSignature, salt)

  // Encrypt the API key
  const encoded = new TextEncoder().encode(apiKey)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    derivedKey,
    toArrayBuffer(encoded)
  )

  // Extract last 4 chars for preview (safe to show)
  const keyPreview = `...${apiKey.slice(-4)}`

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
    key_preview: keyPreview,
  }
}

/**
 * Decrypt an API key using AES-256-GCM
 *
 * @param encrypted - Encrypted key data
 * @param walletSignature - Same signature used for encryption
 * @returns Plaintext API key
 * @throws Error if decryption fails (wrong signature or tampered data)
 */
export async function decryptApiKey(
  encrypted: EncryptedKey,
  walletSignature: Uint8Array
): Promise<string> {
  // Decode from base64
  const ciphertext = base64ToUint8Array(encrypted.ciphertext)
  const iv = base64ToUint8Array(encrypted.iv)
  const salt = base64ToUint8Array(encrypted.salt)

  // Derive the same key
  const derivedKey = await deriveKeyFromSignature(walletSignature, salt)

  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      derivedKey,
      toArrayBuffer(ciphertext)
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('Decryption failed. Invalid signature or tampered data.')
  }
}

/**
 * Generate a signature message for key encryption
 * Uses a deterministic message so the same signature can decrypt
 */
export function getKeyEncryptionMessage(): string {
  return 'GuardianClaw API Key Encryption - Sign to encrypt/decrypt your API keys'
}

/**
 * Validate API key format before encryption
 */
export function validateApiKeyFormat(
  provider: string,
  apiKey: string
): { valid: boolean; error?: string } {
  const trimmed = apiKey.trim()

  if (!trimmed) {
    return { valid: false, error: 'API key cannot be empty' }
  }

  // Provider-specific validation
  switch (provider) {
    case 'openai':
      if (!trimmed.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI keys should start with "sk-"' }
      }
      break
    case 'anthropic':
      if (!trimmed.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic keys should start with "sk-ant-"' }
      }
      break
    case 'openrouter':
      if (!trimmed.startsWith('sk-or-')) {
        return { valid: false, error: 'OpenRouter keys should start with "sk-or-"' }
      }
      break
  }

  return { valid: true }
}

/**
 * Provider display info
 */
export const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { value: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { value: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
] as const

export type LLMProvider = (typeof LLM_PROVIDERS)[number]['value']
