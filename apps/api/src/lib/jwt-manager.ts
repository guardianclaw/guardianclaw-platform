/**
 * JWT Manager — ES256 Implementation
 *
 * Implements ES256 (ECDSA with P-256 curve) for JWT signing per SECURITY_SPEC Section 2.2.
 *
 * Security improvements over HS256:
 * - Asymmetric cryptography - private key never needs to be shared
 * - Shorter signatures with equivalent security
 * - Industry standard for modern JWT implementations
 *
 * Key Management:
 * - Private key stored as Cloudflare secret (JWT_ES256_PRIVATE_KEY)
 * - Public key can be exposed for token verification
 * - Keys are in JWK format for jose compatibility
 *
 * Migration Strategy:
 * - Supports both ES256 (new) and HS256 (legacy) verification
 * - New tokens always use ES256
 * - Old HS256 tokens remain valid until expiration
 */

import * as jose from 'jose'

/**
 * JWT algorithm configuration.
 */
export const JWT_CONFIG = {
  ALGORITHM: 'ES256' as const,
  ISSUER: 'guardianclaw.org',
  AUDIENCE: 'claw-api',
  DEFAULT_EXPIRY: '1h',
  MAX_EXPIRY: '24h',
} as const

/**
 * JWT payload structure.
 */
export interface JWTPayload {
  sub: string // Wallet address
  plan: string // User plan
  jti?: string // JWT ID for revocation
  iat?: number // Issued at
  exp?: number // Expiration
  iss?: string // Issuer
  aud?: string // Audience
  sessionId?: string // Session ID for tracking
  ipHash?: string // IP hash at token creation (for suspicious activity detection)
}

/**
 * Token creation result.
 */
export interface TokenResult {
  token: string
  jti: string
  expiresAt: number
}

/**
 * Token verification result.
 */
export interface VerifyResult {
  valid: boolean
  payload?: JWTPayload
  error?: string
  algorithm?: string
}

/**
 * JWT Manager class.
 *
 * Handles token generation and verification with ES256.
 */
export class JWTManager {
  private privateKey: jose.KeyLike | null = null
  private publicKey: jose.KeyLike | null = null
  private hs256Secret: Uint8Array | null = null
  private initialized = false

  /**
   * Initialize the JWT manager with keys.
   *
   * @param es256PrivateKey - ES256 private key in JWK format (JSON string)
   * @param es256PublicKey - ES256 public key in JWK format (JSON string) - optional, derived from private
   * @param hs256Secret - Legacy HS256 secret for backwards compatibility
   */
  async initialize(
    es256PrivateKey?: string,
    es256PublicKey?: string,
    hs256Secret?: string
  ): Promise<void> {
    if (this.initialized) {
      return
    }

    // Import ES256 keys if provided
    if (es256PrivateKey) {
      try {
        const privateJwk = JSON.parse(es256PrivateKey)
        const importedPrivate = await jose.importJWK(privateJwk, JWT_CONFIG.ALGORITHM)
        // importJWK returns KeyLike | Uint8Array, but for ES256 it's always KeyLike
        this.privateKey = importedPrivate as jose.KeyLike

        // If public key provided, use it; otherwise derive from private
        if (es256PublicKey) {
          const publicJwk = JSON.parse(es256PublicKey)
          const importedPublic = await jose.importJWK(publicJwk, JWT_CONFIG.ALGORITHM)
          this.publicKey = importedPublic as jose.KeyLike
        } else {
          // Extract public key from private key JWK
          const { d: _d, ...publicJwk } = privateJwk
          const importedPublic = await jose.importJWK(publicJwk, JWT_CONFIG.ALGORITHM)
          this.publicKey = importedPublic as jose.KeyLike
        }
      } catch (error) {
        console.error('[JWTManager] Failed to import ES256 keys:', error)
        // Continue with HS256 fallback
      }
    }

    // Import HS256 secret for backwards compatibility
    if (hs256Secret) {
      this.hs256Secret = new TextEncoder().encode(hs256Secret)
    }

    if (!this.privateKey && !this.hs256Secret) {
      throw new Error('[JWTManager] No valid signing keys provided')
    }

    this.initialized = true
  }

  /**
   * Check if ES256 is available.
   */
  hasES256(): boolean {
    return this.privateKey !== null && this.publicKey !== null
  }

  /**
   * Check if HS256 fallback is available.
   */
  hasHS256(): boolean {
    return this.hs256Secret !== null
  }

  /**
   * Create a signed JWT token.
   *
   * @param payload - Token payload
   * @param expiresIn - Expiration time (default: 1h)
   * @returns Token result with JTI and expiration
   */
  async createToken(
    payload: Omit<JWTPayload, 'jti' | 'iat' | 'exp' | 'iss' | 'aud'>,
    expiresIn: string = JWT_CONFIG.DEFAULT_EXPIRY
  ): Promise<TokenResult> {
    if (!this.initialized) {
      throw new Error('[JWTManager] Not initialized')
    }

    const jti = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    // Parse expiry string to seconds
    let expirySeconds = 3600 // 1h default
    if (expiresIn.endsWith('h')) {
      expirySeconds = parseInt(expiresIn) * 3600
    } else if (expiresIn.endsWith('m')) {
      expirySeconds = parseInt(expiresIn) * 60
    } else if (expiresIn.endsWith('d')) {
      expirySeconds = parseInt(expiresIn) * 86400
    }

    const expiresAt = (now + expirySeconds) * 1000 // Convert to ms

    // Prefer ES256 if available
    if (this.privateKey) {
      const token = await new jose.SignJWT({
        ...payload,
        jti,
      })
        .setProtectedHeader({ alg: JWT_CONFIG.ALGORITHM, typ: 'JWT' })
        .setIssuedAt(now)
        .setExpirationTime(now + expirySeconds)
        .setIssuer(JWT_CONFIG.ISSUER)
        .setAudience(JWT_CONFIG.AUDIENCE)
        .sign(this.privateKey)

      return { token, jti, expiresAt }
    }

    // Fallback to HS256
    if (this.hs256Secret) {
      const token = await new jose.SignJWT({
        ...payload,
        jti,
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt(now)
        .setExpirationTime(now + expirySeconds)
        .setIssuer(JWT_CONFIG.ISSUER)
        .setAudience(JWT_CONFIG.AUDIENCE)
        .sign(this.hs256Secret)

      return { token, jti, expiresAt }
    }

    throw new Error('[JWTManager] No signing key available')
  }

  /**
   * Verify and decode a JWT token.
   *
   * Supports both ES256 (preferred) and HS256 (legacy).
   *
   * @param token - JWT token string
   * @returns Verification result
   */
  async verifyToken(token: string): Promise<VerifyResult> {
    if (!this.initialized) {
      return { valid: false, error: 'JWT Manager not initialized' }
    }

    // Decode header to check algorithm
    let algorithm: string
    try {
      const decoded = jose.decodeProtectedHeader(token)
      algorithm = decoded.alg || 'unknown'
    } catch {
      return { valid: false, error: 'Invalid token format' }
    }

    // Verify based on algorithm
    try {
      if (algorithm === 'ES256' && this.publicKey) {
        const { payload } = await jose.jwtVerify(token, this.publicKey, {
          issuer: JWT_CONFIG.ISSUER,
          audience: JWT_CONFIG.AUDIENCE,
        })

        return {
          valid: true,
          payload: payload as unknown as JWTPayload,
          algorithm: 'ES256',
        }
      }

      if (algorithm === 'HS256' && this.hs256Secret) {
        const { payload } = await jose.jwtVerify(token, this.hs256Secret, {
          issuer: JWT_CONFIG.ISSUER,
          // Legacy tokens might not have audience, so make it optional
        })

        return {
          valid: true,
          payload: payload as unknown as JWTPayload,
          algorithm: 'HS256',
        }
      }

      return { valid: false, error: `Unsupported algorithm: ${algorithm}` }
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        return { valid: false, error: 'Token expired' }
      }
      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        return { valid: false, error: 'Token claim validation failed' }
      }
      return { valid: false, error: 'Token verification failed' }
    }
  }

  /**
   * Decode token without verification (for extracting claims).
   *
   * @param token - JWT token string
   * @returns Decoded payload or null
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jose.decodeJwt(token) as JWTPayload
    } catch {
      return null
    }
  }
}

/**
 * Generate ES256 key pair for initial setup.
 *
 * Run this once to generate keys, then store as secrets.
 * The output is in JWK format for easy storage.
 */
export async function generateES256KeyPair(): Promise<{
  privateKey: jose.JWK
  publicKey: jose.JWK
}> {
  const { privateKey, publicKey } = await jose.generateKeyPair('ES256', {
    extractable: true,
  })

  const privateJwk = await jose.exportJWK(privateKey)
  const publicJwk = await jose.exportJWK(publicKey)

  // Add key ID for rotation support
  const kid = crypto.randomUUID()
  privateJwk.kid = kid
  publicJwk.kid = kid

  return {
    privateKey: privateJwk,
    publicKey: publicJwk,
  }
}

/**
 * Create a JWT Manager instance.
 *
 * @param env - Environment with key secrets
 */
export async function createJWTManager(env: {
  JWT_ES256_PRIVATE_KEY?: string
  JWT_ES256_PUBLIC_KEY?: string
  JWT_SECRET?: string
}): Promise<JWTManager> {
  const manager = new JWTManager()

  await manager.initialize(env.JWT_ES256_PRIVATE_KEY, env.JWT_ES256_PUBLIC_KEY, env.JWT_SECRET)

  return manager
}

/**
 * Singleton pattern for JWT Manager to avoid reinitializing.
 */
let jwtManagerInstance: JWTManager | null = null

export async function getJWTManager(env: {
  JWT_ES256_PRIVATE_KEY?: string
  JWT_ES256_PUBLIC_KEY?: string
  JWT_SECRET?: string
}): Promise<JWTManager> {
  if (!jwtManagerInstance) {
    jwtManagerInstance = await createJWTManager(env)
  }
  return jwtManagerInstance
}

/**
 * Reset JWT Manager (for testing).
 */
export function resetJWTManager(): void {
  jwtManagerInstance = null
}
