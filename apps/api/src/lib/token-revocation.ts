/**
 * Token Revocation List (TRL)
 *
 * Manages revoked JWT tokens using Cloudflare KV storage.
 * Per SECURITY_SPEC Section 2.2.4 - Token Management.
 *
 * Architecture:
 * - Stores revoked token JTIs (JWT IDs) in KV
 * - TTL matches token expiration (auto-cleanup)
 * - Checked on every authenticated request
 *
 * Security:
 * - Immediate revocation on logout
 * - Session invalidation on suspicious activity
 * - Supports batch revocation (all sessions for wallet)
 */

import * as jose from 'jose'

/**
 * Key prefix for revoked tokens in KV storage.
 */
const REVOKED_PREFIX = 'revoked:'

/**
 * Key prefix for revoked wallet sessions (batch revocation).
 */
const WALLET_REVOKED_PREFIX = 'wallet_revoked:'

/**
 * Token revocation entry stored in KV.
 */
interface RevocationEntry {
  revokedAt: number
  reason: string
  walletHash?: string
}

/**
 * Token Revocation List manager.
 *
 * Uses the same KV namespace as rate limiting for simplicity.
 * Tokens are stored with TTL matching their expiration time.
 */
export class TokenRevocationList {
  private kv: KVNamespace | null

  constructor(kv: KVNamespace | null) {
    this.kv = kv
  }

  /**
   * Revoke a specific token by its JTI.
   *
   * @param jti - JWT ID (unique identifier)
   * @param expiresAt - Token expiration timestamp (ms)
   * @param reason - Reason for revocation
   * @param walletHash - Optional hashed wallet for audit
   */
  async revokeToken(
    jti: string,
    expiresAt: number,
    reason: string,
    walletHash?: string
  ): Promise<boolean> {
    if (!this.kv) {
      console.warn('[TokenRevocation] KV not available, revocation not persisted')
      return false
    }

    const key = `${REVOKED_PREFIX}${jti}`
    const entry: RevocationEntry = {
      revokedAt: Date.now(),
      reason,
      walletHash,
    }

    // Calculate TTL - token can't be used after expiration anyway
    const ttlMs = expiresAt - Date.now()
    if (ttlMs <= 0) {
      // Token already expired, no need to revoke
      return true
    }

    // Add buffer of 60 seconds for clock skew
    const ttlSeconds = Math.ceil(ttlMs / 1000) + 60

    try {
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttlSeconds,
      })
      return true
    } catch (error) {
      console.error('[TokenRevocation] Failed to revoke token:', error)
      return false
    }
  }

  /**
   * Check if a token is revoked.
   *
   * @param jti - JWT ID to check
   * @returns true if revoked, false if valid
   */
  async isRevoked(jti: string): Promise<boolean> {
    if (!this.kv) {
      // If KV is unavailable, assume not revoked (fail open)
      // This is a conscious trade-off for availability
      return false
    }

    const key = `${REVOKED_PREFIX}${jti}`

    try {
      const entry = await this.kv.get(key)
      return entry !== null
    } catch (error) {
      console.error('[TokenRevocation] Failed to check revocation:', error)
      // Fail open on error - don't block users due to KV issues
      return false
    }
  }

  /**
   * Revoke all tokens for a wallet.
   *
   * Sets a timestamp marker - any token issued before this time
   * for this wallet is considered revoked.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @param reason - Reason for batch revocation
   * @param ttlHours - How long to maintain the revocation (default: 24h)
   */
  async revokeAllForWallet(walletHash: string, reason: string, ttlHours = 24): Promise<boolean> {
    if (!this.kv) {
      console.warn('[TokenRevocation] KV not available, wallet revocation not persisted')
      return false
    }

    const key = `${WALLET_REVOKED_PREFIX}${walletHash}`
    const entry = {
      revokedBefore: Date.now(),
      reason,
    }

    try {
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttlHours * 60 * 60,
      })
      return true
    } catch (error) {
      console.error('[TokenRevocation] Failed to revoke wallet tokens:', error)
      return false
    }
  }

  /**
   * Check if all tokens for a wallet are revoked.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @param tokenIssuedAt - When the token was issued (ms)
   * @returns true if token was issued before revocation
   */
  async isWalletRevoked(walletHash: string, tokenIssuedAt: number): Promise<boolean> {
    if (!this.kv) {
      return false
    }

    const key = `${WALLET_REVOKED_PREFIX}${walletHash}`

    try {
      const stored = await this.kv.get(key, 'json')
      if (!stored) {
        return false
      }

      const entry = stored as { revokedBefore: number }
      // Token is revoked if issued before the revocation timestamp
      return tokenIssuedAt < entry.revokedBefore
    } catch (error) {
      console.error('[TokenRevocation] Failed to check wallet revocation:', error)
      return false
    }
  }

  /**
   * Check if KV storage is available.
   */
  isEnabled(): boolean {
    return this.kv !== null
  }
}

/**
 * Extract JTI from a JWT token string.
 *
 * @param token - JWT token string
 * @returns JTI if present, undefined otherwise
 */
export function extractJti(token: string): string | undefined {
  try {
    const decoded = jose.decodeJwt(token)
    return decoded.jti
  } catch {
    return undefined
  }
}

/**
 * Extract expiration from a JWT token string.
 *
 * @param token - JWT token string
 * @returns Expiration timestamp in ms, or undefined
 */
export function extractExpiration(token: string): number | undefined {
  try {
    const decoded = jose.decodeJwt(token)
    if (decoded.exp) {
      return decoded.exp * 1000 // Convert to milliseconds
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Create a Token Revocation List instance.
 *
 * @param kv - Cloudflare KV namespace (can be null for testing)
 */
export function createTokenRevocationList(kv: KVNamespace | null): TokenRevocationList {
  return new TokenRevocationList(kv)
}
