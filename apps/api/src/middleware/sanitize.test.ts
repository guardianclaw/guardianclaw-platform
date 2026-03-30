/**
 * Sanitization Middleware Tests
 */

import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  sanitizeError,
  createSafeErrorResponse,
  validateExternalUrl,
  validateJsonDepth,
  validateBodySize,
} from './sanitize'

describe('Sanitization Middleware', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('escapes ampersands', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
    })

    it('escapes single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#039;s')
    })

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('passes through safe strings', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
    })
  })

  describe('sanitizeError', () => {
    it('redacts API keys', () => {
      const err = new Error('Failed with key sk-proj-abc123def456789012345678901234567890')
      const result = sanitizeError(err)
      expect(result.message).not.toContain('sk-proj-')
      expect(result.message).toContain('[REDACTED_API_KEY]')
    })

    it('redacts sk_live API keys', () => {
      const err = new Error('Key: sk_live_' + 'a'.repeat(64))
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_API_KEY]')
    })

    it('redacts JWT tokens', () => {
      const err = new Error(
        'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      )
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_TOKEN]')
    })

    it('redacts IPv4 addresses', () => {
      const err = new Error('Connection from 192.168.1.100 failed')
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_IP]')
      expect(result.message).not.toContain('192.168.1.100')
    })

    it('redacts email addresses', () => {
      const err = new Error('User user@example.com not found')
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_EMAIL]')
      expect(result.message).not.toContain('user@example.com')
    })

    it('redacts file paths', () => {
      const err = new Error('File not found: /home/user/secrets.txt')
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_PATH]')
      expect(result.message).not.toContain('/home/user/')
    })

    it('redacts database URLs', () => {
      const err = new Error('postgres://user:pass@host:5432/db connection failed')
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_DB_URL]')
    })

    it('redacts internal URLs', () => {
      const err = new Error('Connecting to http://localhost:3000/api failed')
      const result = sanitizeError(err)
      expect(result.message).toContain('[REDACTED_INTERNAL_URL]')
    })

    it('truncates long messages', () => {
      const err = new Error('x'.repeat(1000))
      const result = sanitizeError(err)
      expect(result.message.length).toBeLessThanOrEqual(500)
      expect(result.message).toContain('...')
    })

    it('handles non-Error objects', () => {
      const result = sanitizeError('string error')
      expect(result.message).toBe('An unexpected error occurred')
    })

    it('handles null', () => {
      const result = sanitizeError(null)
      expect(result.message).toBe('An unexpected error occurred')
    })

    it('returns error code for named errors', () => {
      const err = new TypeError('Invalid type')
      const result = sanitizeError(err)
      expect(result.code).toBe('TypeError')
    })
  })

  describe('createSafeErrorResponse', () => {
    it('creates safe response structure', () => {
      const err = new Error('Database error at postgres://user:pass@host/db')
      const response = createSafeErrorResponse(err, 'req-123')

      expect(response.error).toContain('[REDACTED_DB_URL]')
      expect(response.code).toBe('INTERNAL_ERROR')
      expect(response.requestId).toBe('req-123')
    })

    it('handles no requestId', () => {
      const err = new Error('Simple error')
      const response = createSafeErrorResponse(err)

      expect(response.error).toBe('Simple error')
      expect(response.requestId).toBeUndefined()
    })
  })

  describe('validateExternalUrl', () => {
    it('allows valid HTTPS URLs', () => {
      expect(validateExternalUrl('https://example.com')).toEqual({ valid: true })
      expect(validateExternalUrl('https://api.github.com/repos')).toEqual({ valid: true })
    })

    it('blocks localhost', () => {
      expect(validateExternalUrl('http://localhost:3000').valid).toBe(false)
      expect(validateExternalUrl('https://localhost/api').valid).toBe(false)
    })

    it('blocks 127.0.0.1', () => {
      expect(validateExternalUrl('http://127.0.0.1:8080').valid).toBe(false)
    })

    it('blocks private IP ranges (10.x.x.x)', () => {
      expect(validateExternalUrl('http://10.0.0.1').valid).toBe(false)
      expect(validateExternalUrl('http://10.255.255.255').valid).toBe(false)
    })

    it('blocks private IP ranges (192.168.x.x)', () => {
      expect(validateExternalUrl('http://192.168.1.1').valid).toBe(false)
    })

    it('blocks cloud metadata endpoints', () => {
      expect(validateExternalUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false)
    })

    it('blocks GuardianClaw infrastructure', () => {
      expect(validateExternalUrl('https://api.guardianclaw.org').valid).toBe(false)
      expect(validateExternalUrl('https://test.guardianclaw-api.workers.dev').valid).toBe(false)
    })

    it('blocks non-HTTP protocols', () => {
      expect(validateExternalUrl('file:///etc/passwd').valid).toBe(false)
      expect(validateExternalUrl('ftp://example.com').valid).toBe(false)
    })

    it('rejects invalid URLs', () => {
      expect(validateExternalUrl('not a url').valid).toBe(false)
      expect(validateExternalUrl('').valid).toBe(false)
    })
  })

  describe('validateJsonDepth', () => {
    it('allows shallow objects', () => {
      expect(validateJsonDepth({ a: 1, b: 2 })).toBe(true)
    })

    it('allows nested objects within limit', () => {
      const data = { a: { b: { c: { d: 1 } } } }
      expect(validateJsonDepth(data, 5)).toBe(true)
    })

    it('rejects deeply nested objects', () => {
      let data: unknown = { value: 1 }
      for (let i = 0; i < 15; i++) {
        data = { nested: data }
      }
      expect(validateJsonDepth(data, 10)).toBe(false)
    })

    it('handles arrays', () => {
      const data = [[[[1]]]]
      expect(validateJsonDepth(data, 5)).toBe(true)
      expect(validateJsonDepth(data, 3)).toBe(false)
    })

    it('handles primitives', () => {
      expect(validateJsonDepth('string')).toBe(true)
      expect(validateJsonDepth(123)).toBe(true)
      expect(validateJsonDepth(null)).toBe(true)
    })
  })

  describe('validateBodySize', () => {
    it('allows small bodies', () => {
      expect(validateBodySize('hello world')).toBe(true)
    })

    it('rejects large bodies', () => {
      const largeBody = 'x'.repeat(2 * 1024 * 1024) // 2MB
      expect(validateBodySize(largeBody, 1024 * 1024)).toBe(false)
    })

    it('handles exact limit', () => {
      const body = 'x'.repeat(100)
      expect(validateBodySize(body, 100)).toBe(true)
    })

    it('handles UTF-8 characters', () => {
      // UTF-8 chars are multi-byte (poop emoji U+1F4A9 = 4 bytes each)
      const emoji = '\u{1F4A9}'
      const body = emoji.repeat(100) // 100 emojis = 400 bytes
      expect(validateBodySize(body, 399)).toBe(false) // Less than 400 bytes
      expect(validateBodySize(body, 400)).toBe(true) // Exactly 400 bytes
      expect(validateBodySize(body, 500)).toBe(true) // More than 400 bytes
    })
  })
})
