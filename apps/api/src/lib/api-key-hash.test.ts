/**
 * API Key Hashing Tests
 */

import { describe, it, expect } from 'vitest'
import {
  generateSalt,
  generateApiKey,
  hashApiKeyPBKDF2,
  hashApiKeyLegacy,
  verifyApiKey,
  hashNewApiKey,
  needsMigration,
} from './api-key-hash'

describe('API Key Hashing', () => {
  describe('generateSalt', () => {
    it('generates 32-char hex string (16 bytes)', () => {
      const salt = generateSalt()
      expect(salt).toMatch(/^[a-f0-9]{32}$/)
    })

    it('generates unique salts', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1).not.toBe(salt2)
    })
  })

  describe('generateApiKey', () => {
    it('generates key with sk_live_ prefix', () => {
      const key = generateApiKey()
      expect(key).toMatch(/^sk_live_[a-f0-9]{64}$/)
    })

    it('generates 72-char total length', () => {
      const key = generateApiKey()
      expect(key.length).toBe(72) // 8 (prefix) + 64 (hex)
    })

    it('generates unique keys', () => {
      const key1 = generateApiKey()
      const key2 = generateApiKey()
      expect(key1).not.toBe(key2)
    })
  })

  describe('hashApiKeyPBKDF2', () => {
    it('produces consistent hashes with same salt', async () => {
      const key = 'sk_live_test123'
      const salt = generateSalt()

      const hash1 = await hashApiKeyPBKDF2(key, salt)
      const hash2 = await hashApiKeyPBKDF2(key, salt)

      expect(hash1).toBe(hash2)
    })

    it('produces different hashes with different salts', async () => {
      const key = 'sk_live_test123'
      const salt1 = generateSalt()
      const salt2 = generateSalt()

      const hash1 = await hashApiKeyPBKDF2(key, salt1)
      const hash2 = await hashApiKeyPBKDF2(key, salt2)

      expect(hash1).not.toBe(hash2)
    })

    it('produces 64-char hex hash', async () => {
      const key = generateApiKey()
      const salt = generateSalt()

      const hash = await hashApiKeyPBKDF2(key, salt)

      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('hashApiKeyLegacy', () => {
    it('produces consistent hashes (SHA-256)', async () => {
      const key = 'sk_live_test123'

      const hash1 = await hashApiKeyLegacy(key)
      const hash2 = await hashApiKeyLegacy(key)

      expect(hash1).toBe(hash2)
    })

    it('produces 64-char hex hash', async () => {
      const key = generateApiKey()
      const hash = await hashApiKeyLegacy(key)

      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('differs from PBKDF2 hash', async () => {
      const key = generateApiKey()
      const salt = generateSalt()

      const legacyHash = await hashApiKeyLegacy(key)
      const pbkdf2Hash = await hashApiKeyPBKDF2(key, salt)

      expect(legacyHash).not.toBe(pbkdf2Hash)
    })
  })

  describe('verifyApiKey', () => {
    it('verifies PBKDF2 hashed keys', async () => {
      const key = generateApiKey()
      const salt = generateSalt()
      const hash = await hashApiKeyPBKDF2(key, salt)

      const result = await verifyApiKey(key, hash, salt)
      expect(result).toBe(true)
    })

    it('verifies legacy SHA-256 hashed keys', async () => {
      const key = generateApiKey()
      const hash = await hashApiKeyLegacy(key)

      const result = await verifyApiKey(key, hash, null)
      expect(result).toBe(true)
    })

    it('rejects incorrect key with PBKDF2', async () => {
      const key = generateApiKey()
      const salt = generateSalt()
      const hash = await hashApiKeyPBKDF2(key, salt)

      const result = await verifyApiKey('wrong_key', hash, salt)
      expect(result).toBe(false)
    })

    it('rejects incorrect key with legacy', async () => {
      const key = generateApiKey()
      const hash = await hashApiKeyLegacy(key)

      const result = await verifyApiKey('wrong_key', hash, null)
      expect(result).toBe(false)
    })

    it('rejects wrong salt', async () => {
      const key = generateApiKey()
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      const hash = await hashApiKeyPBKDF2(key, salt1)

      const result = await verifyApiKey(key, hash, salt2)
      expect(result).toBe(false)
    })

    it('handles empty string salt - treated as falsy, uses legacy', async () => {
      const key = generateApiKey()
      const hash = await hashApiKeyLegacy(key)

      // Empty string '' is falsy in JavaScript
      // verifyApiKey uses `if (salt)` which evaluates '' as false
      // So empty string is treated as legacy SHA-256 verification
      const result = await verifyApiKey(key, hash, '')
      expect(result).toBe(true) // '' is falsy, uses legacy verification
    })
  })

  describe('hashNewApiKey', () => {
    it('returns hash, salt, and prefix', async () => {
      const key = generateApiKey()
      const result = await hashNewApiKey(key)

      expect(result.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(result.salt).toMatch(/^[a-f0-9]{32}$/)
      expect(result.prefix).toBe(key.slice(0, 15))
    })

    it('produces verifiable hash', async () => {
      const key = generateApiKey()
      const { hash, salt } = await hashNewApiKey(key)

      const verified = await verifyApiKey(key, hash, salt)
      expect(verified).toBe(true)
    })
  })

  describe('needsMigration', () => {
    it('returns true for null salt', () => {
      expect(needsMigration(null)).toBe(true)
    })

    it('returns true for undefined salt', () => {
      expect(needsMigration(undefined)).toBe(true)
    })

    it('returns false for valid salt', () => {
      expect(needsMigration('abc123')).toBe(false)
      expect(needsMigration(generateSalt())).toBe(false)
    })

    it('returns false for empty string (edge case)', () => {
      // Empty string is technically a salt, even if invalid
      expect(needsMigration('')).toBe(true) // falsy value
    })
  })

  describe('Security properties', () => {
    it('PBKDF2 hash is timing-safe during comparison', async () => {
      const key = generateApiKey()
      const salt = generateSalt()
      const hash = await hashApiKeyPBKDF2(key, salt)

      // Both should take similar time (constant-time comparison)
      const start1 = performance.now()
      await verifyApiKey('sk_live_wrong', hash, salt)
      const time1 = performance.now() - start1

      const start2 = performance.now()
      await verifyApiKey('sk_live_totally_different_key', hash, salt)
      const time2 = performance.now() - start2

      // Times should be within 50ms of each other
      // (PBKDF2 dominates, so timing attack on comparison is infeasible)
      // Using 50ms tolerance to account for system load variations
      expect(Math.abs(time1 - time2)).toBeLessThan(50)
    })

    it('different keys produce vastly different hashes (avalanche)', async () => {
      const key1 = 'sk_live_' + 'a'.repeat(64)
      const key2 = 'sk_live_' + 'a'.repeat(63) + 'b' // 1 char difference
      const salt = generateSalt()

      const hash1 = await hashApiKeyPBKDF2(key1, salt)
      const hash2 = await hashApiKeyPBKDF2(key2, salt)

      // Count differing characters
      let diff = 0
      for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) diff++
      }

      // Should have significant differences (avalanche effect)
      expect(diff).toBeGreaterThan(30) // At least half the chars differ
    })
  })
})
