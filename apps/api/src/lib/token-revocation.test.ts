/**
 * Token Revocation List Tests
 *
 * Comprehensive tests for token revocation functionality.
 * Tests all methods with KV available, unavailable, and error scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as jose from 'jose'
import {
  TokenRevocationList,
  createTokenRevocationList,
  extractJti,
  extractExpiration,
} from './token-revocation'

// Mock KV namespace
function createMockKV() {
  const store = new Map<string, { value: string; expirationTtl?: number }>()

  return {
    store,
    kv: {
      get: vi.fn(async (key: string, type?: string) => {
        const entry = store.get(key)
        if (!entry) return null
        if (type === 'json') {
          return JSON.parse(entry.value)
        }
        return entry.value
      }),
      put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
        store.set(key, { value, expirationTtl: options?.expirationTtl })
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key)
      }),
    } as unknown as KVNamespace,
    reset: () => {
      store.clear()
      vi.clearAllMocks()
    },
  }
}

// Generate a test JWT for helper function tests
async function generateTestToken(
  options: {
    jti?: string
    exp?: number
    sub?: string
  } = {}
): Promise<string> {
  const secret = new TextEncoder().encode('test-secret-with-32-chars-min!!')
  const now = Math.floor(Date.now() / 1000)

  const builder = new jose.SignJWT({
    sub: options.sub || 'test-wallet',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)

  if (options.jti) {
    builder.setJti(options.jti)
  }

  if (options.exp !== undefined) {
    builder.setExpirationTime(options.exp)
  } else {
    builder.setExpirationTime(now + 3600) // 1 hour default
  }

  return builder.sign(secret)
}

describe('TokenRevocationList', () => {
  let mockKV: ReturnType<typeof createMockKV>

  beforeEach(() => {
    mockKV = createMockKV()
  })

  describe('constructor and isEnabled', () => {
    it('returns true when KV is provided', () => {
      const trl = new TokenRevocationList(mockKV.kv)
      expect(trl.isEnabled()).toBe(true)
    })

    it('returns false when KV is null', () => {
      const trl = new TokenRevocationList(null)
      expect(trl.isEnabled()).toBe(false)
    })
  })

  describe('revokeToken', () => {
    it('stores revocation entry in KV with correct TTL', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const jti = 'test-jti-123'
      const expiresAt = Date.now() + 3600000 // 1 hour from now

      const result = await trl.revokeToken(jti, expiresAt, 'user_logout', 'wallet-hash')

      expect(result).toBe(true)
      expect(mockKV.kv.put).toHaveBeenCalledWith(
        `revoked:${jti}`,
        expect.stringContaining('user_logout'),
        expect.objectContaining({
          expirationTtl: expect.any(Number),
        })
      )

      // Verify TTL is approximately correct (1 hour + 60 second buffer)
      const putCall = vi.mocked(mockKV.kv.put).mock.calls[0]
      const ttl = putCall[2]?.expirationTtl as number
      expect(ttl).toBeGreaterThan(3600) // More than 1 hour
      expect(ttl).toBeLessThan(3700) // Less than 1 hour + 100 seconds
    })

    it('includes wallet hash in revocation entry', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const jti = 'test-jti-456'
      const expiresAt = Date.now() + 3600000
      const walletHash = 'hashed-wallet-address'

      await trl.revokeToken(jti, expiresAt, 'suspicious_activity', walletHash)

      const putCall = vi.mocked(mockKV.kv.put).mock.calls[0]
      const storedEntry = JSON.parse(putCall[1])

      expect(storedEntry.walletHash).toBe(walletHash)
      expect(storedEntry.reason).toBe('suspicious_activity')
      expect(storedEntry.revokedAt).toBeDefined()
    })

    it('returns true for already expired token without storing', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const jti = 'expired-jti'
      const expiresAt = Date.now() - 1000 // Already expired

      const result = await trl.revokeToken(jti, expiresAt, 'test')

      expect(result).toBe(true)
      expect(mockKV.kv.put).not.toHaveBeenCalled()
    })

    it('returns false when KV is not available', async () => {
      const trl = new TokenRevocationList(null)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await trl.revokeToken('jti', Date.now() + 3600000, 'test')

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('KV not available'))

      consoleSpy.mockRestore()
    })

    it('returns false and logs error on KV failure', async () => {
      const errorKV = {
        put: vi.fn().mockRejectedValue(new Error('KV write failed')),
      } as unknown as KVNamespace

      const trl = new TokenRevocationList(errorKV)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await trl.revokeToken('jti', Date.now() + 3600000, 'test')

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to revoke token'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('isRevoked', () => {
    it('returns true for revoked token', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const jti = 'revoked-jti'

      // Pre-populate the store
      mockKV.store.set(`revoked:${jti}`, {
        value: JSON.stringify({ revokedAt: Date.now(), reason: 'test' }),
      })

      const result = await trl.isRevoked(jti)

      expect(result).toBe(true)
    })

    it('returns false for non-revoked token', async () => {
      const trl = new TokenRevocationList(mockKV.kv)

      const result = await trl.isRevoked('non-existent-jti')

      expect(result).toBe(false)
    })

    it('returns false when KV is not available (fail open)', async () => {
      const trl = new TokenRevocationList(null)

      const result = await trl.isRevoked('any-jti')

      expect(result).toBe(false)
    })

    it('returns false on KV error (fail open)', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV read failed')),
      } as unknown as KVNamespace

      const trl = new TokenRevocationList(errorKV)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await trl.isRevoked('jti')

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('revokeAllForWallet', () => {
    it('stores wallet revocation with correct TTL', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const walletHash = 'wallet-hash-123'

      const result = await trl.revokeAllForWallet(walletHash, 'logout_all', 24)

      expect(result).toBe(true)
      expect(mockKV.kv.put).toHaveBeenCalledWith(
        `wallet_revoked:${walletHash}`,
        expect.stringContaining('logout_all'),
        expect.objectContaining({
          expirationTtl: 24 * 60 * 60, // 24 hours in seconds
        })
      )
    })

    it('uses default TTL of 24 hours', async () => {
      const trl = new TokenRevocationList(mockKV.kv)

      await trl.revokeAllForWallet('wallet-hash', 'test')

      const putCall = vi.mocked(mockKV.kv.put).mock.calls[0]
      expect(putCall[2]?.expirationTtl).toBe(24 * 60 * 60)
    })

    it('stores revokedBefore timestamp', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const beforeCall = Date.now()

      await trl.revokeAllForWallet('wallet-hash', 'security_breach')

      const putCall = vi.mocked(mockKV.kv.put).mock.calls[0]
      const storedEntry = JSON.parse(putCall[1])

      expect(storedEntry.revokedBefore).toBeGreaterThanOrEqual(beforeCall)
      expect(storedEntry.revokedBefore).toBeLessThanOrEqual(Date.now())
      expect(storedEntry.reason).toBe('security_breach')
    })

    it('returns false when KV is not available', async () => {
      const trl = new TokenRevocationList(null)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await trl.revokeAllForWallet('wallet', 'test')

      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })

    it('returns false on KV error', async () => {
      const errorKV = {
        put: vi.fn().mockRejectedValue(new Error('KV write failed')),
      } as unknown as KVNamespace

      const trl = new TokenRevocationList(errorKV)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await trl.revokeAllForWallet('wallet', 'test')

      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('isWalletRevoked', () => {
    it('returns true for token issued before revocation', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const walletHash = 'wallet-hash'
      const revocationTime = Date.now()
      const tokenIssuedAt = revocationTime - 10000 // 10 seconds before revocation

      // Pre-populate the store
      mockKV.store.set(`wallet_revoked:${walletHash}`, {
        value: JSON.stringify({ revokedBefore: revocationTime, reason: 'test' }),
      })

      const result = await trl.isWalletRevoked(walletHash, tokenIssuedAt)

      expect(result).toBe(true)
    })

    it('returns false for token issued after revocation', async () => {
      const trl = new TokenRevocationList(mockKV.kv)
      const walletHash = 'wallet-hash'
      const revocationTime = Date.now() - 10000 // 10 seconds ago
      const tokenIssuedAt = Date.now() // Issued now (after revocation)

      mockKV.store.set(`wallet_revoked:${walletHash}`, {
        value: JSON.stringify({ revokedBefore: revocationTime, reason: 'test' }),
      })

      const result = await trl.isWalletRevoked(walletHash, tokenIssuedAt)

      expect(result).toBe(false)
    })

    it('returns false when no wallet revocation exists', async () => {
      const trl = new TokenRevocationList(mockKV.kv)

      const result = await trl.isWalletRevoked('non-existent-wallet', Date.now())

      expect(result).toBe(false)
    })

    it('returns false when KV is not available', async () => {
      const trl = new TokenRevocationList(null)

      const result = await trl.isWalletRevoked('wallet', Date.now())

      expect(result).toBe(false)
    })

    it('returns false on KV error', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV read failed')),
      } as unknown as KVNamespace

      const trl = new TokenRevocationList(errorKV)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await trl.isWalletRevoked('wallet', Date.now())

      expect(result).toBe(false)

      consoleSpy.mockRestore()
    })
  })
})

describe('createTokenRevocationList', () => {
  it('creates a TokenRevocationList instance', () => {
    const mockKV = {} as KVNamespace
    const trl = createTokenRevocationList(mockKV)

    expect(trl).toBeInstanceOf(TokenRevocationList)
    expect(trl.isEnabled()).toBe(true)
  })

  it('handles null KV', () => {
    const trl = createTokenRevocationList(null)

    expect(trl).toBeInstanceOf(TokenRevocationList)
    expect(trl.isEnabled()).toBe(false)
  })
})

describe('extractJti', () => {
  it('extracts JTI from valid token', async () => {
    const jti = 'unique-token-id-123'
    const token = await generateTestToken({ jti })

    const result = extractJti(token)

    expect(result).toBe(jti)
  })

  it('returns undefined for token without JTI', async () => {
    const token = await generateTestToken({})

    const result = extractJti(token)

    expect(result).toBeUndefined()
  })

  it('returns undefined for invalid token', () => {
    const result = extractJti('not-a-valid-jwt')

    expect(result).toBeUndefined()
  })

  it('returns undefined for malformed token', () => {
    const result = extractJti('eyJ.eyJ.invalid')

    expect(result).toBeUndefined()
  })
})

describe('extractExpiration', () => {
  it('extracts expiration from valid token', async () => {
    const exp = Math.floor(Date.now() / 1000) + 7200 // 2 hours from now
    const token = await generateTestToken({ exp })

    const result = extractExpiration(token)

    expect(result).toBe(exp * 1000) // Converted to milliseconds
  })

  it('returns undefined for invalid token', () => {
    const result = extractExpiration('not-a-valid-jwt')

    expect(result).toBeUndefined()
  })

  it('returns undefined for malformed token', () => {
    const result = extractExpiration('eyJ.eyJ.invalid')

    expect(result).toBeUndefined()
  })
})

describe('Integration: Revoke and Check Flow', () => {
  let mockKV: ReturnType<typeof createMockKV>
  let trl: TokenRevocationList

  beforeEach(() => {
    mockKV = createMockKV()
    trl = new TokenRevocationList(mockKV.kv)
  })

  it('full token revocation flow works correctly', async () => {
    const jti = 'integration-test-jti'
    const expiresAt = Date.now() + 3600000

    // Initially not revoked
    expect(await trl.isRevoked(jti)).toBe(false)

    // Revoke the token
    const revokeResult = await trl.revokeToken(jti, expiresAt, 'user_logout')
    expect(revokeResult).toBe(true)

    // Now should be revoked
    expect(await trl.isRevoked(jti)).toBe(true)
  })

  it('full wallet revocation flow works correctly', async () => {
    const walletHash = 'integration-wallet-hash'
    const oldTokenIssuedAt = Date.now() - 10000 // 10 seconds ago

    // Initially not revoked
    expect(await trl.isWalletRevoked(walletHash, oldTokenIssuedAt)).toBe(false)

    // Revoke all wallet tokens
    const revokeResult = await trl.revokeAllForWallet(walletHash, 'security_incident')
    expect(revokeResult).toBe(true)

    // Old token should now be revoked
    expect(await trl.isWalletRevoked(walletHash, oldTokenIssuedAt)).toBe(true)

    // New token (issued after revocation) should not be revoked
    const newTokenIssuedAt = Date.now() + 1000
    expect(await trl.isWalletRevoked(walletHash, newTokenIssuedAt)).toBe(false)
  })
})
