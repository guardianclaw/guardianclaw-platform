/**
 * Webhook Utilities Tests
 */

import { describe, it, expect } from 'vitest'
import { isValidWebhookUrl, getStatusColor, formatTimestamp, truncate } from './webhooks'

describe('isValidWebhookUrl', () => {
  describe('valid URLs', () => {
    it('accepts HTTPS URLs', () => {
      const result = isValidWebhookUrl('https://example.com/webhook')
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('accepts HTTPS URLs with path and query', () => {
      const result = isValidWebhookUrl('https://api.example.com/v1/webhook?key=123')
      expect(result.valid).toBe(true)
    })

    it('accepts HTTPS URLs with port', () => {
      const result = isValidWebhookUrl('https://example.com:8443/webhook')
      expect(result.valid).toBe(true)
    })

    it('accepts HTTP localhost', () => {
      const result = isValidWebhookUrl('http://localhost:3000/webhook')
      expect(result.valid).toBe(true)
    })

    it('accepts HTTP 127.0.0.1', () => {
      const result = isValidWebhookUrl('http://127.0.0.1:8080/webhook')
      expect(result.valid).toBe(true)
    })

    it('accepts HTTP private IP 10.x.x.x', () => {
      const result = isValidWebhookUrl('http://10.0.0.1/webhook')
      expect(result.valid).toBe(true)
    })

    it('accepts HTTP private IP 172.16.x.x', () => {
      const result = isValidWebhookUrl('http://172.16.0.1/webhook')
      expect(result.valid).toBe(true)
    })

    it('accepts HTTP private IP 192.168.x.x', () => {
      const result = isValidWebhookUrl('http://192.168.1.100/webhook')
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      const result = isValidWebhookUrl('')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('URL is required')
    })

    it('rejects whitespace only', () => {
      const result = isValidWebhookUrl('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('URL is required')
    })

    it('rejects invalid URL format', () => {
      const result = isValidWebhookUrl('not-a-url')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid URL format')
    })

    it('rejects FTP protocol', () => {
      const result = isValidWebhookUrl('ftp://example.com/file')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })

    it('rejects file protocol', () => {
      const result = isValidWebhookUrl('file:///etc/passwd')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('URL must use HTTP or HTTPS protocol')
    })

    it('rejects HTTP for public URLs', () => {
      const result = isValidWebhookUrl('http://example.com/webhook')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('HTTPS is required for public URLs')
    })

    it('rejects HTTP for non-private IPs', () => {
      const result = isValidWebhookUrl('http://8.8.8.8/webhook')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('HTTPS is required for public URLs')
    })
  })

  describe('edge cases', () => {
    it('handles URL with special characters', () => {
      const result = isValidWebhookUrl('https://example.com/webhook?param=hello%20world')
      expect(result.valid).toBe(true)
    })

    it('handles URL with authentication', () => {
      const result = isValidWebhookUrl('https://user:pass@example.com/webhook')
      expect(result.valid).toBe(true)
    })

    it('handles internationalized domain', () => {
      const result = isValidWebhookUrl('https://xn--nxasmq5b.com/webhook')
      expect(result.valid).toBe(true)
    })
  })
})

describe('getStatusColor', () => {
  it('returns green for success', () => {
    expect(getStatusColor('success')).toBe('bg-green-500')
  })

  it('returns red for failed', () => {
    expect(getStatusColor('failed')).toBe('bg-red-500')
  })

  it('returns yellow for pending', () => {
    expect(getStatusColor('pending')).toBe('bg-yellow-500')
  })

  it('returns blue for retrying', () => {
    expect(getStatusColor('retrying')).toBe('bg-blue-500')
  })

  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('bg-gray-500')
  })
})

describe('formatTimestamp', () => {
  it('formats valid timestamp', () => {
    const result = formatTimestamp('2024-01-15T10:30:00Z')
    expect(result).not.toBe('Never')
    expect(result).not.toBe('Invalid date')
  })

  it('returns Never for null', () => {
    expect(formatTimestamp(null)).toBe('Never')
  })

  it('returns Invalid Date for invalid timestamp', () => {
    expect(formatTimestamp('not-a-date')).toBe('Invalid Date')
  })
})

describe('truncate', () => {
  it('returns original string if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns original string if equal to maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates and adds ellipsis if longer than maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('')
  })

  it('handles maxLength of 3 (minimum for ellipsis)', () => {
    expect(truncate('hello', 3)).toBe('...')
  })
})
