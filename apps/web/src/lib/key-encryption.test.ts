import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptApiKey,
  decryptApiKey,
  deriveKeyFromSignature,
  validateApiKeyFormat,
  getKeyEncryptionMessage,
  LLM_PROVIDERS,
} from './key-encryption'

// Mock wallet signature (64 bytes like Ed25519)
function createMockSignature(): Uint8Array {
  const signature = new Uint8Array(64)
  crypto.getRandomValues(signature)
  return signature
}

// Helper to convert Uint8Array to ArrayBuffer for SubtleCrypto compatibility
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.length)
  new Uint8Array(buffer).set(data)
  return buffer
}

describe('key-encryption', () => {
  // Note: SubtleCrypto tests are skipped in jsdom environment
  // They work correctly in real browsers and Node.js
  // See: https://github.com/jsdom/jsdom/issues/1612
  describe.skip('deriveKeyFromSignature', () => {
    it('should derive a valid CryptoKey from signature', async () => {
      const signature = createMockSignature()
      const salt = crypto.getRandomValues(new Uint8Array(16))

      const key = await deriveKeyFromSignature(signature, salt)

      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
      expect(key.algorithm.name).toBe('AES-GCM')
    })

    it('should derive the same key with same signature and salt', async () => {
      const signature = createMockSignature()
      const salt = crypto.getRandomValues(new Uint8Array(16))

      const key1 = await deriveKeyFromSignature(signature, salt)
      const key2 = await deriveKeyFromSignature(signature, salt)

      // Keys should be usable with the same ciphertext
      const testData = new TextEncoder().encode('test')
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key1,
        toArrayBuffer(testData)
      )

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key2,
        encrypted
      )

      expect(new TextDecoder().decode(decrypted)).toBe('test')
    })

    it('should derive different keys with different salts', async () => {
      const signature = createMockSignature()
      const salt1 = crypto.getRandomValues(new Uint8Array(16))
      const salt2 = crypto.getRandomValues(new Uint8Array(16))

      const key1 = await deriveKeyFromSignature(signature, salt1)
      const key2 = await deriveKeyFromSignature(signature, salt2)

      // Encrypt with key1
      const testData = new TextEncoder().encode('test')
      const iv = crypto.getRandomValues(new Uint8Array(12))

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key1,
        toArrayBuffer(testData)
      )

      // Decryption with key2 should fail
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key2, encrypted)
      ).rejects.toThrow()
    })
  })

  describe.skip('encryptApiKey', () => {
    it('should encrypt an API key and return all required fields', async () => {
      const apiKey = 'sk-test-key-12345678'
      const signature = createMockSignature()

      const result = await encryptApiKey(apiKey, signature)

      expect(result.ciphertext).toBeDefined()
      expect(result.iv).toBeDefined()
      expect(result.salt).toBeDefined()
      expect(result.key_preview).toBeDefined()
    })

    it('should generate valid base64 strings', async () => {
      const apiKey = 'sk-test-key-12345678'
      const signature = createMockSignature()

      const result = await encryptApiKey(apiKey, signature)

      // Should not throw when decoding
      expect(() => atob(result.ciphertext)).not.toThrow()
      expect(() => atob(result.iv)).not.toThrow()
      expect(() => atob(result.salt)).not.toThrow()
    })

    it('should extract correct key preview (last 4 chars)', async () => {
      const apiKey = 'sk-test-key-ABCD'
      const signature = createMockSignature()

      const result = await encryptApiKey(apiKey, signature)

      expect(result.key_preview).toBe('...ABCD')
    })

    it('should generate unique ciphertexts for same key (due to random IV)', async () => {
      const apiKey = 'sk-test-key-12345678'
      const signature = createMockSignature()

      const result1 = await encryptApiKey(apiKey, signature)
      const result2 = await encryptApiKey(apiKey, signature)

      // Ciphertexts should be different due to different random IVs
      expect(result1.ciphertext).not.toBe(result2.ciphertext)
      expect(result1.iv).not.toBe(result2.iv)
      expect(result1.salt).not.toBe(result2.salt)
    })
  })

  describe.skip('decryptApiKey', () => {
    it('should decrypt an encrypted API key correctly', async () => {
      const apiKey = 'sk-test-key-12345678'
      const signature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, signature)
      const decrypted = await decryptApiKey(encrypted, signature)

      expect(decrypted).toBe(apiKey)
    })

    it('should handle various API key formats', async () => {
      const signature = createMockSignature()
      const testKeys = [
        'sk-1234567890abcdef',
        'sk-ant-api03-very-long-key-with-many-characters-here',
        'sk-or-v1-short',
        'some-random-api-key-format',
      ]

      for (const apiKey of testKeys) {
        const encrypted = await encryptApiKey(apiKey, signature)
        const decrypted = await decryptApiKey(encrypted, signature)
        expect(decrypted).toBe(apiKey)
      }
    })

    it('should fail with wrong signature', async () => {
      const apiKey = 'sk-test-key-12345678'
      const correctSignature = createMockSignature()
      const wrongSignature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, correctSignature)

      await expect(decryptApiKey(encrypted, wrongSignature)).rejects.toThrow('Decryption failed')
    })

    it('should fail with tampered ciphertext', async () => {
      const apiKey = 'sk-test-key-12345678'
      const signature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, signature)

      // Tamper with ciphertext
      const tamperedCiphertext = encrypted.ciphertext.slice(0, -4) + 'XXXX'
      const tampered = { ...encrypted, ciphertext: tamperedCiphertext }

      await expect(decryptApiKey(tampered, signature)).rejects.toThrow()
    })

    it('should fail with tampered IV', async () => {
      const apiKey = 'sk-test-key-12345678'
      const signature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, signature)

      // Generate different IV
      const newIv = crypto.getRandomValues(new Uint8Array(12))
      let binary = ''
      for (let i = 0; i < newIv.length; i++) {
        binary += String.fromCharCode(newIv[i])
      }
      const tamperedIv = btoa(binary)
      const tampered = { ...encrypted, iv: tamperedIv }

      await expect(decryptApiKey(tampered, signature)).rejects.toThrow()
    })
  })

  describe.skip('encryptApiKey + decryptApiKey roundtrip', () => {
    it('should successfully roundtrip with Unicode characters', async () => {
      // Some API keys might have special chars
      const apiKey = 'sk-test-key-with-special-chars-!@#$%'
      const signature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, signature)
      const decrypted = await decryptApiKey(encrypted, signature)

      expect(decrypted).toBe(apiKey)
    })

    it('should successfully roundtrip with very long keys', async () => {
      const apiKey = 'sk-' + 'a'.repeat(500)
      const signature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, signature)
      const decrypted = await decryptApiKey(encrypted, signature)

      expect(decrypted).toBe(apiKey)
    })

    it('should successfully roundtrip with minimum length key', async () => {
      const apiKey = 'x'
      const signature = createMockSignature()

      const encrypted = await encryptApiKey(apiKey, signature)
      const decrypted = await decryptApiKey(encrypted, signature)

      expect(decrypted).toBe(apiKey)
    })
  })

  describe('validateApiKeyFormat', () => {
    it('should reject empty keys', () => {
      const result = validateApiKeyFormat('openai', '')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should reject whitespace-only keys', () => {
      const result = validateApiKeyFormat('openai', '   ')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    describe('OpenAI keys', () => {
      it('should accept valid OpenAI keys', () => {
        const result = validateApiKeyFormat('openai', 'sk-1234567890abcdef')
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject keys not starting with sk-', () => {
        const result = validateApiKeyFormat('openai', 'invalid-key')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('sk-')
      })
    })

    describe('Anthropic keys', () => {
      it('should accept valid Anthropic keys', () => {
        const result = validateApiKeyFormat('anthropic', 'sk-ant-api03-xxxxx')
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject keys not starting with sk-ant-', () => {
        const result = validateApiKeyFormat('anthropic', 'sk-1234567890')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('sk-ant-')
      })
    })

    describe('OpenRouter keys', () => {
      it('should accept valid OpenRouter keys', () => {
        const result = validateApiKeyFormat('openrouter', 'sk-or-v1-xxxxx')
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      })

      it('should reject keys not starting with sk-or-', () => {
        const result = validateApiKeyFormat('openrouter', 'sk-1234567890')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('sk-or-')
      })
    })

    describe('Unknown providers', () => {
      it('should accept any non-empty key for unknown providers', () => {
        const result = validateApiKeyFormat('unknown-provider', 'any-key-format')
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('getKeyEncryptionMessage', () => {
    it('should return a consistent message', () => {
      const msg1 = getKeyEncryptionMessage()
      const msg2 = getKeyEncryptionMessage()

      expect(msg1).toBe(msg2)
    })

    it('should contain meaningful text', () => {
      const message = getKeyEncryptionMessage()

      expect(message).toContain('GuardianClaw')
      expect(message).toContain('encrypt')
    })
  })

  describe('LLM_PROVIDERS', () => {
    it('should contain all expected providers', () => {
      const providers = LLM_PROVIDERS.map((p) => p.value)

      expect(providers).toContain('openai')
      expect(providers).toContain('anthropic')
      expect(providers).toContain('openrouter')
    })

    it('should have labels and placeholders for all providers', () => {
      for (const provider of LLM_PROVIDERS) {
        expect(provider.value).toBeDefined()
        expect(provider.label).toBeDefined()
        expect(provider.placeholder).toBeDefined()
        expect(provider.label.length).toBeGreaterThan(0)
        expect(provider.placeholder.length).toBeGreaterThan(0)
      }
    })
  })
})
