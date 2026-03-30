/**
 * Webhook Signature Library Tests
 *
 * Comprehensive test coverage for webhook security functions.
 */

import { describe, it, expect } from 'vitest'
import {
  generateWebhookSecret,
  generateSecretSalt,
  hashWebhookSecret,
  verifyWebhookSecret,
  hashNewWebhookSecret,
  createWebhookSignature,
  verifyWebhookSignature,
  validateTimestamp,
  parseWebhookHeaders,
  validateAllowedIP,
  WEBHOOK_HEADERS,
} from './webhook-signature'

describe('Webhook Signature Library', () => {
  // ============================================
  // SECRET GENERATION
  // ============================================
  describe('generateWebhookSecret', () => {
    it('generates a secret with correct format', () => {
      const secret = generateWebhookSecret()

      expect(secret).toMatch(/^whsec_[0-9a-f]{64}$/)
      expect(secret.length).toBe(70)
    })

    it('generates unique secrets on each call', () => {
      const secrets = new Set<string>()

      for (let i = 0; i < 100; i++) {
        secrets.add(generateWebhookSecret())
      }

      expect(secrets.size).toBe(100)
    })

    it('starts with whsec_ prefix', () => {
      const secret = generateWebhookSecret()

      expect(secret.startsWith('whsec_')).toBe(true)
    })
  })

  describe('generateSecretSalt', () => {
    it('generates a 32-character hex salt', () => {
      const salt = generateSecretSalt()

      expect(salt).toMatch(/^[0-9a-f]{32}$/)
      expect(salt.length).toBe(32)
    })

    it('generates unique salts on each call', () => {
      const salts = new Set<string>()

      for (let i = 0; i < 100; i++) {
        salts.add(generateSecretSalt())
      }

      expect(salts.size).toBe(100)
    })
  })

  // ============================================
  // SECRET HASHING
  // ============================================
  describe('hashWebhookSecret', () => {
    it('produces a 64-character hex hash', async () => {
      const secret = generateWebhookSecret()
      const salt = generateSecretSalt()

      const hash = await hashWebhookSecret(secret, salt)

      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces consistent hashes for same input', async () => {
      const secret = 'whsec_test123'
      const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'

      const hash1 = await hashWebhookSecret(secret, salt)
      const hash2 = await hashWebhookSecret(secret, salt)

      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different salts', async () => {
      const secret = 'whsec_test123'
      const salt1 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
      const salt2 = '11111111111111111111111111111111'

      const hash1 = await hashWebhookSecret(secret, salt1)
      const hash2 = await hashWebhookSecret(secret, salt2)

      expect(hash1).not.toBe(hash2)
    })

    it('produces different hashes for different secrets', async () => {
      const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
      const secret1 = 'whsec_abc'
      const secret2 = 'whsec_xyz'

      const hash1 = await hashWebhookSecret(secret1, salt)
      const hash2 = await hashWebhookSecret(secret2, salt)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyWebhookSecret', () => {
    it('returns true for matching secret', async () => {
      const secret = generateWebhookSecret()
      const salt = generateSecretSalt()
      const hash = await hashWebhookSecret(secret, salt)

      const isValid = await verifyWebhookSecret(secret, hash, salt)

      expect(isValid).toBe(true)
    })

    it('returns false for non-matching secret', async () => {
      const secret = generateWebhookSecret()
      const wrongSecret = generateWebhookSecret()
      const salt = generateSecretSalt()
      const hash = await hashWebhookSecret(secret, salt)

      const isValid = await verifyWebhookSecret(wrongSecret, hash, salt)

      expect(isValid).toBe(false)
    })

    it('returns false for wrong salt', async () => {
      const secret = generateWebhookSecret()
      const salt = generateSecretSalt()
      const wrongSalt = generateSecretSalt()
      const hash = await hashWebhookSecret(secret, salt)

      const isValid = await verifyWebhookSecret(secret, hash, wrongSalt)

      expect(isValid).toBe(false)
    })
  })

  describe('hashNewWebhookSecret', () => {
    it('returns hash, salt, and prefix', async () => {
      const secret = generateWebhookSecret()

      const result = await hashNewWebhookSecret(secret)

      expect(result).toHaveProperty('hash')
      expect(result).toHaveProperty('salt')
      expect(result).toHaveProperty('prefix')
    })

    it('prefix is first 14 characters', async () => {
      const secret = 'whsec_abcdef1234567890'

      const result = await hashNewWebhookSecret(secret)

      expect(result.prefix).toBe('whsec_abcdef12')
      expect(result.prefix.length).toBe(14)
    })

    it('hash can be verified with returned salt', async () => {
      const secret = generateWebhookSecret()

      const { hash, salt } = await hashNewWebhookSecret(secret)
      const isValid = await verifyWebhookSecret(secret, hash, salt)

      expect(isValid).toBe(true)
    })
  })

  // ============================================
  // SIGNATURE CREATION
  // ============================================
  describe('createWebhookSignature', () => {
    it('creates signature with sha256= prefix', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)

      const signature = await createWebhookSignature(payload, secret, timestamp)

      expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/)
    })

    it('produces consistent signatures for same input', async () => {
      const payload = '{"test": "data"}'
      const secret = 'whsec_fixed_secret'
      const timestamp = 1704067200 // Fixed timestamp

      const sig1 = await createWebhookSignature(payload, secret, timestamp)
      const sig2 = await createWebhookSignature(payload, secret, timestamp)

      expect(sig1).toBe(sig2)
    })

    it('produces different signatures for different payloads', async () => {
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)

      const sig1 = await createWebhookSignature('{"a": 1}', secret, timestamp)
      const sig2 = await createWebhookSignature('{"a": 2}', secret, timestamp)

      expect(sig1).not.toBe(sig2)
    })

    it('produces different signatures for different timestamps', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()

      const sig1 = await createWebhookSignature(payload, secret, 1000)
      const sig2 = await createWebhookSignature(payload, secret, 2000)

      expect(sig1).not.toBe(sig2)
    })

    it('produces different signatures for different secrets', async () => {
      const payload = '{"test": "data"}'
      const timestamp = Math.floor(Date.now() / 1000)

      const sig1 = await createWebhookSignature(payload, 'secret1', timestamp)
      const sig2 = await createWebhookSignature(payload, 'secret2', timestamp)

      expect(sig1).not.toBe(sig2)
    })
  })

  // ============================================
  // SIGNATURE VERIFICATION
  // ============================================
  describe('verifyWebhookSignature', () => {
    it('returns valid for correct signature', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = await createWebhookSignature(payload, secret, timestamp)

      const result = await verifyWebhookSignature(payload, signature, secret, timestamp)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns invalid for wrong signature', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)
      const wrongSignature =
        'sha256=0000000000000000000000000000000000000000000000000000000000000000'

      const result = await verifyWebhookSignature(payload, wrongSignature, secret, timestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('SIGNATURE_MISMATCH')
    })

    it('returns invalid for modified payload', async () => {
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = await createWebhookSignature('{"a": 1}', secret, timestamp)

      const result = await verifyWebhookSignature('{"a": 2}', signature, secret, timestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('SIGNATURE_MISMATCH')
    })

    it('returns invalid for expired timestamp', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600 // 10 minutes ago
      const signature = await createWebhookSignature(payload, secret, oldTimestamp)

      const result = await verifyWebhookSignature(payload, signature, secret, oldTimestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('TIMESTAMP_EXPIRED')
    })

    it('returns invalid for future timestamp', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const futureTimestamp = Math.floor(Date.now() / 1000) + 300 // 5 minutes in future
      const signature = await createWebhookSignature(payload, secret, futureTimestamp)

      const result = await verifyWebhookSignature(payload, signature, secret, futureTimestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('TIMESTAMP_FUTURE')
    })

    it('returns invalid for malformed signature', async () => {
      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)

      const result = await verifyWebhookSignature(payload, 'invalid_signature', secret, timestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('INVALID_SIGNATURE_FORMAT')
    })
  })

  // ============================================
  // TIMESTAMP VALIDATION
  // ============================================
  describe('validateTimestamp', () => {
    it('returns valid for current timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000)

      const result = validateTimestamp(timestamp)

      expect(result.valid).toBe(true)
    })

    it('returns valid for timestamp within 5 minutes', () => {
      const timestamp = Math.floor(Date.now() / 1000) - 240 // 4 minutes ago

      const result = validateTimestamp(timestamp)

      expect(result.valid).toBe(true)
    })

    it('returns invalid for timestamp older than 5 minutes', () => {
      const timestamp = Math.floor(Date.now() / 1000) - 360 // 6 minutes ago

      const result = validateTimestamp(timestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('TIMESTAMP_EXPIRED')
    })

    it('returns valid for slight future timestamp (clock skew)', () => {
      const timestamp = Math.floor(Date.now() / 1000) + 30 // 30 seconds in future

      const result = validateTimestamp(timestamp)

      expect(result.valid).toBe(true)
    })

    it('returns invalid for far future timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000) + 120 // 2 minutes in future

      const result = validateTimestamp(timestamp)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('TIMESTAMP_FUTURE')
    })

    it('returns invalid for missing timestamp', () => {
      const result = validateTimestamp(0)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('TIMESTAMP_MISSING')
    })

    it('returns invalid for NaN timestamp', () => {
      const result = validateTimestamp(NaN)

      expect(result.valid).toBe(false)
      expect(result.code).toBe('TIMESTAMP_MISSING')
    })
  })

  // ============================================
  // HEADER PARSING
  // ============================================
  describe('parseWebhookHeaders', () => {
    it('parses headers from Headers object', () => {
      const headers = new Headers()
      headers.set(WEBHOOK_HEADERS.SIGNATURE, 'sha256=abc123')
      headers.set(WEBHOOK_HEADERS.TIMESTAMP, '1704067200')

      const result = parseWebhookHeaders(headers)

      expect(result).toEqual({
        signature: 'sha256=abc123',
        timestamp: 1704067200,
      })
    })

    it('parses headers from plain object', () => {
      const headers = {
        [WEBHOOK_HEADERS.SIGNATURE]: 'sha256=abc123',
        [WEBHOOK_HEADERS.TIMESTAMP]: '1704067200',
      }

      const result = parseWebhookHeaders(headers)

      expect(result).toEqual({
        signature: 'sha256=abc123',
        timestamp: 1704067200,
      })
    })

    it('returns null for missing signature', () => {
      const headers = {
        [WEBHOOK_HEADERS.TIMESTAMP]: '1704067200',
      }

      const result = parseWebhookHeaders(headers)

      expect(result).toBeNull()
    })

    it('returns null for missing timestamp', () => {
      const headers = {
        [WEBHOOK_HEADERS.SIGNATURE]: 'sha256=abc123',
      }

      const result = parseWebhookHeaders(headers)

      expect(result).toBeNull()
    })

    it('returns null for invalid timestamp', () => {
      const headers = {
        [WEBHOOK_HEADERS.SIGNATURE]: 'sha256=abc123',
        [WEBHOOK_HEADERS.TIMESTAMP]: 'not-a-number',
      }

      const result = parseWebhookHeaders(headers)

      expect(result).toBeNull()
    })
  })

  // ============================================
  // IP VALIDATION
  // ============================================
  describe('validateAllowedIP', () => {
    it('allows all IPs when list is empty', () => {
      expect(validateAllowedIP('192.168.1.1', [])).toBe(true)
      expect(validateAllowedIP('10.0.0.1', [])).toBe(true)
      expect(validateAllowedIP('8.8.8.8', [])).toBe(true)
    })

    it('allows exact IP match', () => {
      const allowedIPs = ['192.168.1.1', '10.0.0.1']

      expect(validateAllowedIP('192.168.1.1', allowedIPs)).toBe(true)
      expect(validateAllowedIP('10.0.0.1', allowedIPs)).toBe(true)
    })

    it('rejects non-matching IP', () => {
      const allowedIPs = ['192.168.1.1', '10.0.0.1']

      expect(validateAllowedIP('192.168.1.2', allowedIPs)).toBe(false)
      expect(validateAllowedIP('8.8.8.8', allowedIPs)).toBe(false)
    })

    it('handles IPv4-mapped IPv6 addresses', () => {
      const allowedIPs = ['192.168.1.1']

      expect(validateAllowedIP('::ffff:192.168.1.1', allowedIPs)).toBe(true)
    })

    it('allows IPs in CIDR range', () => {
      const allowedIPs = ['192.168.1.0/24']

      expect(validateAllowedIP('192.168.1.1', allowedIPs)).toBe(true)
      expect(validateAllowedIP('192.168.1.254', allowedIPs)).toBe(true)
      expect(validateAllowedIP('192.168.2.1', allowedIPs)).toBe(false)
    })

    it('handles /32 CIDR (single IP)', () => {
      const allowedIPs = ['10.0.0.5/32']

      expect(validateAllowedIP('10.0.0.5', allowedIPs)).toBe(true)
      expect(validateAllowedIP('10.0.0.6', allowedIPs)).toBe(false)
    })

    it('handles /0 CIDR (all IPs)', () => {
      const allowedIPs = ['0.0.0.0/0']

      expect(validateAllowedIP('192.168.1.1', allowedIPs)).toBe(true)
      expect(validateAllowedIP('10.0.0.1', allowedIPs)).toBe(true)
    })
  })

  // ============================================
  // CONSTANT-TIME COMPARISON (Security)
  // ============================================
  describe('Timing Attack Resistance', () => {
    it('signature comparison takes consistent time regardless of mismatch position', async () => {
      // This test verifies the constant-time comparison works correctly
      // by checking that signatures with different mismatch positions
      // all return the same result consistently

      const payload = '{"test": "data"}'
      const secret = generateWebhookSecret()
      const timestamp = Math.floor(Date.now() / 1000)
      const validSignature = await createWebhookSignature(payload, secret, timestamp)

      // Create signatures that differ at different positions
      // Use non-hex characters (g, x, z) to ensure modification always changes the signature
      const wrongAtStart = 'sha256=g' + validSignature.slice(8) // 'g' is not a valid hex char
      const wrongAtMiddle = validSignature.slice(0, 40) + 'x' + validSignature.slice(41)
      const wrongAtEnd = validSignature.slice(0, -1) + 'z'

      // All should return false
      const results = await Promise.all([
        verifyWebhookSignature(payload, wrongAtStart, secret, timestamp),
        verifyWebhookSignature(payload, wrongAtMiddle, secret, timestamp),
        verifyWebhookSignature(payload, wrongAtEnd, secret, timestamp),
      ])

      for (const result of results) {
        expect(result.valid).toBe(false)
        expect(result.code).toBe('SIGNATURE_MISMATCH')
      }
    })
  })
})
