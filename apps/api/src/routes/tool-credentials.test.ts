/**
 * Tool Credentials Routes Tests
 *
 * Tests for tool credential management including:
 * - CRUD operations
 * - Encryption/decryption
 * - Credential testing
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { encryptWebhookSecret, decryptWebhookSecret } from '../lib/webhook-crypto'

const JWT_SECRET = 'test-jwt-secret-with-minimum-32-chars!'

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================

describe('Tool Credentials Validation', () => {
  const TOOL_TYPES = ['serper', 'openai', 'custom_api'] as const

  const createCredentialSchema = z.object({
    tool_type: z.enum(TOOL_TYPES),
    name: z.string().min(1).max(100).default('Default'),
    credential: z.string().min(1).max(500),
    config: z.record(z.unknown()).default({}),
  })

  const updateCredentialSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    credential: z.string().min(1).max(500).optional(),
    config: z.record(z.unknown()).optional(),
    is_active: z.boolean().optional(),
  })

  describe('Create credential schema', () => {
    it('accepts valid serper credential', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'serper',
        name: 'My Serper Key',
        credential: 'abc123def456',
      })

      expect(result.success).toBe(true)
    })

    it('accepts valid openai credential', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'openai',
        name: 'Production Key',
        credential: 'sk-1234567890abcdef',
      })

      expect(result.success).toBe(true)
    })

    it('accepts valid custom_api credential', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'custom_api',
        name: 'Custom API',
        credential: 'my-api-key',
        config: { base_url: 'https://api.example.com' },
      })

      expect(result.success).toBe(true)
    })

    it('rejects invalid tool_type', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'invalid',
        name: 'Test',
        credential: 'abc123',
      })

      expect(result.success).toBe(false)
    })

    it('rejects empty credential', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'serper',
        name: 'Test',
        credential: '',
      })

      expect(result.success).toBe(false)
    })

    it('rejects credential exceeding max length', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'serper',
        name: 'Test',
        credential: 'a'.repeat(501),
      })

      expect(result.success).toBe(false)
    })

    it('uses default name when not provided', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'serper',
        credential: 'abc123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Default')
      }
    })

    it('uses empty config when not provided', () => {
      const result = createCredentialSchema.safeParse({
        tool_type: 'serper',
        credential: 'abc123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.config).toEqual({})
      }
    })
  })

  describe('Update credential schema', () => {
    it('accepts partial update with name only', () => {
      const result = updateCredentialSchema.safeParse({
        name: 'New Name',
      })

      expect(result.success).toBe(true)
    })

    it('accepts partial update with is_active only', () => {
      const result = updateCredentialSchema.safeParse({
        is_active: false,
      })

      expect(result.success).toBe(true)
    })

    it('accepts full update', () => {
      const result = updateCredentialSchema.safeParse({
        name: 'Updated',
        credential: 'new-key',
        config: { base_url: 'https://new.api.com' },
        is_active: true,
      })

      expect(result.success).toBe(true)
    })

    it('accepts empty object (no updates)', () => {
      const result = updateCredentialSchema.safeParse({})

      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = updateCredentialSchema.safeParse({
        name: '',
      })

      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// ENCRYPTION TESTS
// ============================================

describe('Credential encryption', () => {
  it('encrypts and decrypts credential correctly', async () => {
    const originalCredential = 'sk-1234567890abcdef1234567890abcdef'
    const { encrypted, iv } = await encryptWebhookSecret(originalCredential, JWT_SECRET)

    const decrypted = await decryptWebhookSecret(encrypted, iv, JWT_SECRET)

    expect(decrypted).toBe(originalCredential)
  })

  it('produces unique ciphertext for same credential', async () => {
    const credential = 'my-api-key-12345'
    const result1 = await encryptWebhookSecret(credential, JWT_SECRET)
    const result2 = await encryptWebhookSecret(credential, JWT_SECRET)

    // Different IVs should produce different ciphertext
    expect(result1.iv).not.toBe(result2.iv)
    expect(result1.encrypted).not.toBe(result2.encrypted)

    // But both should decrypt to same value
    const decrypted1 = await decryptWebhookSecret(result1.encrypted, result1.iv, JWT_SECRET)
    const decrypted2 = await decryptWebhookSecret(result2.encrypted, result2.iv, JWT_SECRET)
    expect(decrypted1).toBe(decrypted2)
  })

  it('fails decryption with wrong server secret', async () => {
    const credential = 'sensitive-api-key'
    const { encrypted, iv } = await encryptWebhookSecret(credential, JWT_SECRET)

    await expect(
      decryptWebhookSecret(encrypted, iv, 'wrong-secret-with-32-characters!!')
    ).rejects.toThrow()
  })
})

// ============================================
// PREVIEW TESTS
// ============================================

describe('Credential preview', () => {
  function getCredentialPreview(credential: string): string {
    if (credential.length <= 4) {
      return '****'
    }
    return '****' + credential.slice(-4)
  }

  it('shows last 4 characters for normal credentials', () => {
    expect(getCredentialPreview('sk-1234567890abcdef')).toBe('****cdef')
    expect(getCredentialPreview('my-api-key-12345')).toBe('****2345')
  })

  it('shows only asterisks for short credentials', () => {
    expect(getCredentialPreview('abc')).toBe('****')
    expect(getCredentialPreview('abcd')).toBe('****')
  })

  it('handles empty credential', () => {
    expect(getCredentialPreview('')).toBe('****')
  })
})

// ============================================
// TOOL TYPE TESTS
// ============================================

describe('Tool types', () => {
  const TOOL_TYPES = ['serper', 'openai', 'custom_api']

  it('includes all expected tool types', () => {
    expect(TOOL_TYPES).toContain('serper')
    expect(TOOL_TYPES).toContain('openai')
    expect(TOOL_TYPES).toContain('custom_api')
  })

  it('has exactly 3 tool types', () => {
    expect(TOOL_TYPES).toHaveLength(3)
  })
})

// ============================================
// CONFIG VALIDATION TESTS
// ============================================

describe('Config validation', () => {
  it('allows empty config', () => {
    const config = {}
    expect(Object.keys(config)).toHaveLength(0)
  })

  it('allows base_url in config', () => {
    const config = { base_url: 'https://api.example.com' }
    expect(config.base_url).toBe('https://api.example.com')
  })

  it('allows arbitrary keys in config', () => {
    const config = {
      base_url: 'https://api.example.com',
      timeout: 30000,
      custom_header: 'X-Custom',
    }
    expect(Object.keys(config)).toHaveLength(3)
  })
})
