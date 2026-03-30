/**
 * Webhook Endpoint Routes Tests
 *
 * Tests for outbound webhook endpoint management validation.
 * These tests focus on request validation and response format.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { generateWebhookSecret } from '../lib/webhook-signature'
import { encryptNewWebhookSecret, decryptWebhookSecret } from '../lib/webhook-crypto'
import { DELIVERY_EVENT_TYPES } from '../services/webhook-delivery'

const JWT_SECRET = 'test-jwt-secret-with-minimum-32-chars!'

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================

describe('Webhook Endpoint Validation Schemas', () => {
  const urlSchema = z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          const parsed = new URL(url)
          return parsed.protocol === 'https:' || parsed.protocol === 'http:'
        } catch {
          return false
        }
      },
      { message: 'URL must be a valid HTTP or HTTPS URL' }
    )

  const headersSchema = z.record(z.string()).refine(
    (headers) => {
      const forbidden = ['host', 'content-length', 'transfer-encoding']
      return !Object.keys(headers).some((k) => forbidden.includes(k.toLowerCase()))
    },
    { message: 'Cannot override protected headers (Host, Content-Length, Transfer-Encoding)' }
  )

  describe('URL validation', () => {
    it('accepts valid HTTPS URLs', () => {
      expect(urlSchema.safeParse('https://example.com/webhook').success).toBe(true)
      expect(urlSchema.safeParse('https://api.example.com:8080/path').success).toBe(true)
      expect(urlSchema.safeParse('https://subdomain.example.com/webhook?key=value').success).toBe(
        true
      )
    })

    it('accepts valid HTTP URLs', () => {
      expect(urlSchema.safeParse('http://localhost:3000/webhook').success).toBe(true)
      expect(urlSchema.safeParse('http://192.168.1.1/webhook').success).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(urlSchema.safeParse('not-a-url').success).toBe(false)
      expect(urlSchema.safeParse('ftp://example.com').success).toBe(false)
      expect(urlSchema.safeParse('').success).toBe(false)
      expect(urlSchema.safeParse('example.com').success).toBe(false)
    })
  })

  describe('Headers validation', () => {
    it('accepts valid custom headers', () => {
      expect(headersSchema.safeParse({ Authorization: 'Bearer token' }).success).toBe(true)
      expect(headersSchema.safeParse({ 'X-Custom-Header': 'value' }).success).toBe(true)
      expect(headersSchema.safeParse({}).success).toBe(true)
    })

    it('rejects protected headers', () => {
      expect(headersSchema.safeParse({ Host: 'evil.com' }).success).toBe(false)
      expect(headersSchema.safeParse({ 'Content-Length': '100' }).success).toBe(false)
      expect(headersSchema.safeParse({ 'Transfer-Encoding': 'chunked' }).success).toBe(false)
    })

    it('rejects protected headers case-insensitively', () => {
      expect(headersSchema.safeParse({ HOST: 'evil.com' }).success).toBe(false)
      expect(headersSchema.safeParse({ host: 'evil.com' }).success).toBe(false)
    })
  })

  describe('Event types validation', () => {
    const eventTypesSchema = z.array(
      z.enum(DELIVERY_EVENT_TYPES as unknown as [string, ...string[]])
    )

    it('accepts valid event types', () => {
      expect(eventTypesSchema.safeParse(['agent.response']).success).toBe(true)
      expect(eventTypesSchema.safeParse(['agent.blocked', 'agent.error']).success).toBe(true)
      expect(eventTypesSchema.safeParse([]).success).toBe(true)
    })

    it('rejects invalid event types', () => {
      expect(eventTypesSchema.safeParse(['invalid.event']).success).toBe(false)
      expect(eventTypesSchema.safeParse(['agent.response', 'unknown']).success).toBe(false)
    })
  })

  describe('Retry count validation', () => {
    const retrySchema = z.number().int().min(0).max(10)

    it('accepts valid retry counts', () => {
      expect(retrySchema.safeParse(0).success).toBe(true)
      expect(retrySchema.safeParse(3).success).toBe(true)
      expect(retrySchema.safeParse(10).success).toBe(true)
    })

    it('rejects invalid retry counts', () => {
      expect(retrySchema.safeParse(-1).success).toBe(false)
      expect(retrySchema.safeParse(11).success).toBe(false)
      expect(retrySchema.safeParse(1.5).success).toBe(false)
    })
  })

  describe('Timeout validation', () => {
    const timeoutSchema = z.number().int().min(1000).max(120000)

    it('accepts valid timeouts', () => {
      expect(timeoutSchema.safeParse(1000).success).toBe(true)
      expect(timeoutSchema.safeParse(30000).success).toBe(true)
      expect(timeoutSchema.safeParse(120000).success).toBe(true)
    })

    it('rejects invalid timeouts', () => {
      expect(timeoutSchema.safeParse(500).success).toBe(false)
      expect(timeoutSchema.safeParse(200000).success).toBe(false)
      expect(timeoutSchema.safeParse(1000.5).success).toBe(false)
    })
  })
})

// ============================================
// SECRET ENCRYPTION TESTS
// ============================================

describe('Secret encryption and decryption', () => {
  it('encrypts and decrypts secrets correctly', async () => {
    const originalSecret = generateWebhookSecret()
    const { encrypted, iv, prefix } = await encryptNewWebhookSecret(originalSecret, JWT_SECRET)

    // Verify prefix is correct
    expect(prefix).toBe(originalSecret.slice(0, 14))

    // Verify decryption works
    const decrypted = await decryptWebhookSecret(encrypted, iv, JWT_SECRET)
    expect(decrypted).toBe(originalSecret)
  })

  it('generates unique encrypted values for same secret', async () => {
    const secret = generateWebhookSecret()
    const result1 = await encryptNewWebhookSecret(secret, JWT_SECRET)
    const result2 = await encryptNewWebhookSecret(secret, JWT_SECRET)

    // IV should be different (random)
    expect(result1.iv).not.toBe(result2.iv)
    // Encrypted value should be different due to different IV
    expect(result1.encrypted).not.toBe(result2.encrypted)
  })

  it('fails decryption with wrong key', async () => {
    const originalSecret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(originalSecret, JWT_SECRET)

    await expect(
      decryptWebhookSecret(encrypted, iv, 'wrong-jwt-secret-with-32-chars!!')
    ).rejects.toThrow()
  })

  it('fails decryption with tampered ciphertext', async () => {
    const originalSecret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(originalSecret, JWT_SECRET)

    // Tamper with the encrypted data
    const tampered = encrypted.slice(0, -4) + 'XXXX'

    await expect(decryptWebhookSecret(tampered, iv, JWT_SECRET)).rejects.toThrow()
  })
})

// ============================================
// EVENT TYPES TESTS
// ============================================

describe('DELIVERY_EVENT_TYPES', () => {
  it('contains all expected event types', () => {
    expect(DELIVERY_EVENT_TYPES).toContain('agent.response')
    expect(DELIVERY_EVENT_TYPES).toContain('agent.blocked')
    expect(DELIVERY_EVENT_TYPES).toContain('agent.error')
    expect(DELIVERY_EVENT_TYPES).toContain('execution.started')
    expect(DELIVERY_EVENT_TYPES).toContain('execution.completed')
  })

  it('has exactly 5 event types', () => {
    expect(DELIVERY_EVENT_TYPES.length).toBe(5)
  })

  it('all event types follow naming convention', () => {
    for (const eventType of DELIVERY_EVENT_TYPES) {
      expect(eventType).toMatch(/^[a-z]+\.[a-z]+$/)
    }
  })
})

// ============================================
// WEBHOOK SECRET FORMAT TESTS
// ============================================

describe('Webhook secret generation', () => {
  it('generates secrets with correct prefix', () => {
    const secret = generateWebhookSecret()
    expect(secret.startsWith('whsec_')).toBe(true)
  })

  it('generates secrets with correct length', () => {
    const secret = generateWebhookSecret()
    // whsec_ (6) + 64 hex chars = 70
    expect(secret.length).toBe(70)
  })

  it('generates unique secrets', () => {
    const secrets = new Set<string>()
    for (let i = 0; i < 100; i++) {
      secrets.add(generateWebhookSecret())
    }
    expect(secrets.size).toBe(100)
  })

  it('generates secrets with valid hex characters', () => {
    const secret = generateWebhookSecret()
    const hexPart = secret.slice(6)
    expect(hexPart).toMatch(/^[0-9a-f]{64}$/)
  })
})

// Route handler tests are in webhook-endpoints.routes.test.ts
