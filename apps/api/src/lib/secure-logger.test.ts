/**
 * SecureLogger tests.
 *
 * Reference: SECURITY_SPEC.md Section 9.2
 *
 * These tests verify:
 * - PII pattern detection and scrubbing
 * - IP hashing with daily salt
 * - Wallet hashing
 * - Security event logging
 * - Sensitive field name detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scrubPII,
  hashIP,
  hashWallet,
  hashWalletSync,
  SecureLogger,
  createSecureLogger,
  type SecurityEventType,
} from './secure-logger'

describe('SecureLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PII Pattern Detection', () => {
    describe('OpenAI API Keys', () => {
      it('scrubs sk-proj- format keys', () => {
        // 24 chars after sk-proj- (minimum is 20)
        const data = { key: 'sk-proj-abcdef12345678901234567890' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.key).toBe('[REDACTED_API_KEY_OPENAI]')
      })

      it('scrubs sk- format keys', () => {
        const data = { key: 'sk-abcdef12345678901234567890' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.key).toBe('[REDACTED_API_KEY_OPENAI]')
      })

      it('scrubs keys embedded in text', () => {
        // 24 chars after sk-proj- (minimum is 20)
        const data = { message: 'Error with key sk-proj-test123456789012345678 in request' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.message).toContain('[REDACTED_API_KEY_OPENAI]')
        expect(scrubbed.message).not.toContain('sk-proj-')
      })
    })

    describe('Anthropic API Keys', () => {
      it('scrubs sk-ant- format keys', () => {
        const data = { key: 'sk-ant-api03-abcdefghijklmnopqrst' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.key).toBe('[REDACTED_API_KEY_ANTHROPIC]')
      })
    })

    describe('JWT Tokens', () => {
      it('scrubs JWT tokens', () => {
        const jwt =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
        const data = { token: jwt }
        const scrubbed = scrubPII(data)
        expect(scrubbed.token).toBe('[REDACTED_JWT]')
      })

      it('scrubs JWT in Authorization header values', () => {
        const data = {
          auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0',
        }
        const scrubbed = scrubPII(data)
        expect(scrubbed.auth).not.toContain('eyJ')
      })
    })

    describe('Email Addresses', () => {
      it('scrubs email addresses', () => {
        const data = { contact: 'user@example.com' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.contact).toBe('[REDACTED_EMAIL]')
      })

      it('scrubs emails embedded in text', () => {
        const data = { message: 'Contact support at help@claw.dev for assistance' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.message).toContain('[REDACTED_EMAIL]')
        expect(scrubbed.message).not.toContain('@')
      })
    })

    describe('Private Keys', () => {
      it('scrubs 64-char hex strings (private keys)', () => {
        const privateKey = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
        const data = { key: privateKey }
        const scrubbed = scrubPII(data)
        expect(scrubbed.key).toBe('[REDACTED_PRIVATE_KEY]')
      })
    })

    describe('Bearer Tokens', () => {
      it('scrubs Bearer token format', () => {
        const data = { header: 'Bearer abc123xyz789tokenabc' }
        const scrubbed = scrubPII(data)
        expect(scrubbed.header).toContain('[REDACTED_BEARER_TOKEN]')
      })
    })
  })

  describe('Sensitive Field Names', () => {
    it('redacts password fields', () => {
      const data = { password: 'secret123', username: 'john' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.password).toBe('[REDACTED]')
      expect(scrubbed.username).toBe('john')
    })

    it('redacts apiKey fields', () => {
      const data = { apiKey: 'my-key', name: 'test' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.apiKey).toBe('[REDACTED]')
    })

    it('redacts api_key fields', () => {
      const data = { api_key: 'my-key', name: 'test' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.api_key).toBe('[REDACTED]')
    })

    it('redacts authorization fields', () => {
      // Short bearer token that doesn't match pattern -> redacted by field name
      const data = { Authorization: 'Basic abc123', other: 'value' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.Authorization).toBe('[REDACTED]')
    })

    it('redacts authorization fields with bearer pattern', () => {
      // Bearer token that matches pattern -> redacted by pattern (more specific)
      const data = { Authorization: 'Bearer abc123xyz789tokenabc', other: 'value' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.Authorization).toContain('[REDACTED_BEARER_TOKEN]')
    })

    it('redacts fields with sensitive substrings', () => {
      const data = { userPassword: 'secret', adminToken: 'abc', jwtSecret: 'xyz' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.userPassword).toBe('[REDACTED]')
      expect(scrubbed.adminToken).toBe('[REDACTED]')
      expect(scrubbed.jwtSecret).toBe('[REDACTED]')
    })

    it('redacts mnemonic and seed fields', () => {
      const data = { mnemonic: 'word1 word2 word3', seed: 'abc123' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.mnemonic).toBe('[REDACTED]')
      expect(scrubbed.seed).toBe('[REDACTED]')
    })
  })

  describe('Nested Objects', () => {
    it('scrubs nested objects', () => {
      const data = {
        user: {
          name: 'John',
          email: 'john@example.com',
          credentials: {
            password: 'secret',
          },
        },
      }
      const scrubbed = scrubPII(data)
      expect(scrubbed.user.name).toBe('John')
      expect(scrubbed.user.email).toBe('[REDACTED_EMAIL]')
      expect(scrubbed.user.credentials.password).toBe('[REDACTED]')
    })

    it('scrubs arrays', () => {
      const data = {
        emails: ['user1@test.com', 'user2@test.com'],
      }
      const scrubbed = scrubPII(data)
      expect(scrubbed.emails).toEqual(['[REDACTED_EMAIL]', '[REDACTED_EMAIL]'])
    })

    it('handles max depth', () => {
      // Create deeply nested object
      let deep: Record<string, unknown> = { value: 'test@email.com' }
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep }
      }

      const scrubbed = scrubPII(deep)
      // Should not throw, should handle gracefully
      expect(scrubbed).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles null values', () => {
      const data = { key: null }
      const scrubbed = scrubPII(data)
      expect(scrubbed.key).toBeNull()
    })

    it('handles undefined values', () => {
      const data = { key: undefined }
      const scrubbed = scrubPII(data)
      expect(scrubbed.key).toBeUndefined()
    })

    it('handles number values', () => {
      const data = { count: 42 }
      const scrubbed = scrubPII(data)
      expect(scrubbed.count).toBe(42)
    })

    it('handles boolean values', () => {
      const data = { active: true }
      const scrubbed = scrubPII(data)
      expect(scrubbed.active).toBe(true)
    })

    it('preserves non-PII strings', () => {
      const data = { message: 'Hello world', status: 'success' }
      const scrubbed = scrubPII(data)
      expect(scrubbed.message).toBe('Hello world')
      expect(scrubbed.status).toBe('success')
    })
  })

  describe('IP Hashing', () => {
    it('produces consistent hash for same IP and secret', async () => {
      const hash1 = await hashIP('192.168.1.1', 'test-secret')
      const hash2 = await hashIP('192.168.1.1', 'test-secret')
      expect(hash1).toBe(hash2)
    })

    it('produces different hash for different IPs', async () => {
      const hash1 = await hashIP('192.168.1.1', 'test-secret')
      const hash2 = await hashIP('192.168.1.2', 'test-secret')
      expect(hash1).not.toBe(hash2)
    })

    it('produces different hash for different secrets', async () => {
      const hash1 = await hashIP('192.168.1.1', 'secret1')
      const hash2 = await hashIP('192.168.1.1', 'secret2')
      expect(hash1).not.toBe(hash2)
    })

    it('returns 16-character hex string', async () => {
      const hash = await hashIP('192.168.1.1', 'test-secret')
      expect(hash).toMatch(/^[a-f0-9]{16}$/)
    })

    it('handles IPv6 addresses', async () => {
      const hash = await hashIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'test-secret')
      expect(hash).toMatch(/^[a-f0-9]{16}$/)
    })
  })

  describe('Wallet Hashing', () => {
    it('produces consistent hash for same wallet', async () => {
      const wallet = 'DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M'
      const hash1 = await hashWallet(wallet)
      const hash2 = await hashWallet(wallet)
      expect(hash1).toBe(hash2)
    })

    it('produces different hash for different wallets', async () => {
      const hash1 = await hashWallet('DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M')
      const hash2 = await hashWallet('7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2')
      expect(hash1).not.toBe(hash2)
    })

    it('returns 16-character hex string', async () => {
      const hash = await hashWallet('DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M')
      expect(hash).toMatch(/^[a-f0-9]{16}$/)
    })
  })

  describe('hashWalletSync', () => {
    it('produces consistent hash', () => {
      const wallet = 'DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M'
      const hash1 = hashWalletSync(wallet)
      const hash2 = hashWalletSync(wallet)
      expect(hash1).toBe(hash2)
    })

    it('produces different hash for different wallets', () => {
      const hash1 = hashWalletSync('DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M')
      const hash2 = hashWalletSync('7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2')
      expect(hash1).not.toBe(hash2)
    })

    it('returns 8-character hex string', () => {
      const hash = hashWalletSync('DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M')
      expect(hash).toMatch(/^[a-f0-9]{8}$/)
    })
  })

  describe('SecureLogger Class', () => {
    it('logs security events with proper structure', async () => {
      const logger = new SecureLogger('test-secret')

      await logger.security('auth_failure', { reason: 'invalid_signature' }, '192.168.1.1')

      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])

      expect(output.level).toBe('security')
      expect(output.event).toBe('auth_failure')
      expect(output.ip_hash).toBeDefined()
      expect(output.ip_hash).toMatch(/^[a-f0-9]{16}$/)
      expect(output.details.reason).toBe('invalid_signature')
      expect(output.timestamp).toBeDefined()
    })

    it('hashes wallet address in security events', async () => {
      const logger = new SecureLogger('test-secret')
      const wallet = 'DRtMLqzYRi5hBqL3G6RJgr1wuXAyB9unFuR6QF4kRb5M'

      await logger.security('auth_success', {}, undefined, wallet)

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.wallet_hash).toBeDefined()
      expect(output.wallet_hash).toMatch(/^[a-f0-9]{16}$/)
      // Original wallet should not appear
      expect(consoleSpy.log.mock.calls[0][0]).not.toContain(wallet)
    })

    it('scrubs PII from security event details', async () => {
      const logger = new SecureLogger('test-secret')

      await logger.security('suspicious_activity', {
        email: 'user@example.com',
        // Short value that doesn't match API key pattern -> redacted by field name
        apiKey: 'short-key',
      })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.details.email).toBe('[REDACTED_EMAIL]')
      expect(output.details.apiKey).toBe('[REDACTED]')
    })

    it('scrubs PII patterns in security event details', async () => {
      const logger = new SecureLogger('test-secret')

      await logger.security('suspicious_activity', {
        // API key matching pattern (24 chars after sk-) -> redacted by pattern
        exposedKey: 'sk-test1234567890123456789012',
      })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.details.exposedKey).toBe('[REDACTED_API_KEY_OPENAI]')
    })

    it('logs info with PII scrubbing', async () => {
      const logger = new SecureLogger('test-secret')

      await logger.info('User action', { email: 'test@example.com' })

      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.level).toBe('info')
      expect(output.email).toBe('[REDACTED_EMAIL]')
    })

    it('logs warn with PII scrubbing', async () => {
      const logger = new SecureLogger('test-secret')

      // 28 chars after sk-ant- (minimum is 20)
      await logger.warn('Warning', { key: 'sk-ant-secretkey123456789012345678' })

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0])
      expect(output.level).toBe('warn')
      expect(output.key).toBe('[REDACTED_API_KEY_ANTHROPIC]')
    })

    it('logs error with PII scrubbing', async () => {
      const logger = new SecureLogger('test-secret')

      await logger.error('Error occurred', { password: 'secret123' })

      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0])
      expect(output.level).toBe('error')
      expect(output.password).toBe('[REDACTED]')
    })

    it('hashes IP in non-security logs using SHA-256', async () => {
      const logger = new SecureLogger('test-secret')

      await logger.info('Request', { action: 'test' }, '192.168.1.1')

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      // SHA-256 hash produces 16-char hex (truncated from 64)
      expect(output.ip_hash).toBeDefined()
      expect(output.ip_hash).toMatch(/^[a-f0-9]{16}$/)
      expect(output.ip).toBeUndefined()
      expect(output.ip_address).toBeUndefined()
    })
  })

  describe('createSecureLogger', () => {
    it('creates logger with provided secret', () => {
      const logger = createSecureLogger({ IP_HASH_SECRET: 'my-secret' })
      expect(logger).toBeInstanceOf(SecureLogger)
    })

    it('creates logger without secret (uses default)', () => {
      const logger = createSecureLogger()
      expect(logger).toBeInstanceOf(SecureLogger)
    })
  })

  describe('Security Event Types', () => {
    const eventTypes: SecurityEventType[] = [
      'auth_success',
      'auth_failure',
      'auth_blocked',
      'rate_limit_exceeded',
      'csrf_blocked',
      'ssrf_attempt',
      'invalid_signature',
      'session_created',
      'session_expired',
      'session_revoked',
      'api_key_created',
      'api_key_revoked',
      'suspicious_activity',
      'data_export_requested',
      'data_deletion_requested',
    ]

    it.each(eventTypes)('logs %s event correctly', async (eventType) => {
      const logger = new SecureLogger('test-secret')

      await logger.security(eventType, { test: true })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.event).toBe(eventType)
    })
  })
})
