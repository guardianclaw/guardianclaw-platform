/**
 * API Request Logger Tests
 *
 * Tests for request logging, audit trail, and security event logging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  maskUrlForLogging,
  maskHeadersForLogging,
  truncateBodyForLogging,
  generateRequestId,
  createRequestLogEntry,
  createSecurityLogEntry,
  setApiRequestLogger,
  resetApiRequestLogger,
  logApiRequest,
  logApiSecurityEvent,
  bufferAuditEntry,
  getBufferedAuditEntries,
  clearAuditBuffer,
  getAuditBufferStats,
} from './api-request-logger'
import type { ApiRequestConfig, ApiRequestResponse } from './api-request'

describe('api-request-logger', () => {
  beforeEach(() => {
    resetApiRequestLogger()
    clearAuditBuffer()
    vi.restoreAllMocks()
  })

  // ============================================
  // URL MASKING
  // ============================================

  describe('maskUrlForLogging', () => {
    it('should mask api_key query parameter', () => {
      const url = 'https://api.example.com/search?api_key=secret123&q=test'
      const masked = maskUrlForLogging(url)

      expect(masked).toContain('api_key=%5BREDACTED%5D')
      expect(masked).toContain('q=test')
      expect(masked).not.toContain('secret123')
    })

    it('should mask token query parameter', () => {
      const url = 'https://api.example.com/data?token=abc123xyz'
      const masked = maskUrlForLogging(url)

      expect(masked).toContain('token=%5BREDACTED%5D')
      expect(masked).not.toContain('abc123xyz')
    })

    it('should mask access_token query parameter', () => {
      const url = 'https://api.example.com/data?access_token=my-secret-token'
      const masked = maskUrlForLogging(url)

      expect(masked).toContain('access_token=%5BREDACTED%5D')
    })

    it('should truncate very long URLs', () => {
      const longUrl = 'https://api.example.com/search?' + 'a'.repeat(300)
      const masked = maskUrlForLogging(longUrl)

      expect(masked.length).toBeLessThanOrEqual(220) // 200 + truncation indicator
      expect(masked).toContain('...[truncated]')
    })

    it('should handle invalid URLs gracefully', () => {
      const invalid = 'not-a-valid-url'
      const masked = maskUrlForLogging(invalid)

      expect(masked).toBe(invalid)
    })

    it('should preserve non-sensitive query parameters', () => {
      const url = 'https://api.example.com/search?q=hello&page=1&limit=10'
      const masked = maskUrlForLogging(url)

      expect(masked).toContain('q=hello')
      expect(masked).toContain('page=1')
      expect(masked).toContain('limit=10')
    })

    it('should mask parameters with key/token/secret in name', () => {
      const url = 'https://api.example.com?my_secret_key=value&auth_token=abc'
      const masked = maskUrlForLogging(url)

      expect(masked).toContain('my_secret_key=%5BREDACTED%5D')
      expect(masked).toContain('auth_token=%5BREDACTED%5D')
    })
  })

  // ============================================
  // HEADER MASKING
  // ============================================

  describe('maskHeadersForLogging', () => {
    it('should mask Authorization header', () => {
      const headers = {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
        'Content-Type': 'application/json',
      }
      const masked = maskHeadersForLogging(headers)

      expect(masked).toBeDefined()
      // Shows first 4 and last 4 chars of value longer than 12 chars
      expect(masked!['Authorization']).toMatch(/^Bear\.\.\./)
      expect(masked!['Content-Type']).toBe('application/json')
    })

    it('should mask X-API-Key header', () => {
      const headers = {
        'X-API-Key': 'sk-proj-abc123def456',
      }
      const masked = maskHeadersForLogging(headers)

      // Shows first 4 and last 4 chars
      expect(masked!['X-API-Key']).toMatch(/^sk-p\.\.\./)
      expect(masked!['X-API-Key']).toContain('...')
    })

    it('should mask Cookie header', () => {
      const headers = {
        Cookie: 'session=abc123xyz789',
      }
      const masked = maskHeadersForLogging(headers)

      // Shows first 4 and last 4 chars
      expect(masked!['Cookie']).toMatch(/^sess\.\.\./)
      expect(masked!['Cookie']).toContain('...')
    })

    it('should handle short sensitive values', () => {
      const headers = {
        Authorization: 'short',
      }
      const masked = maskHeadersForLogging(headers)

      expect(masked!['Authorization']).toBe('[REDACTED]')
    })

    it('should return undefined for undefined input', () => {
      const masked = maskHeadersForLogging(undefined)
      expect(masked).toBeUndefined()
    })

    it('should preserve non-sensitive headers', () => {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Test/1.0',
      }
      const masked = maskHeadersForLogging(headers)

      expect(masked).toEqual(headers)
    })
  })

  // ============================================
  // BODY TRUNCATION
  // ============================================

  describe('truncateBodyForLogging', () => {
    it('should return short bodies unchanged', () => {
      const body = '{"key": "value"}'
      const truncated = truncateBodyForLogging(body)

      expect(truncated).toBe(body)
    })

    it('should truncate long bodies', () => {
      const body = 'x'.repeat(600)
      const truncated = truncateBodyForLogging(body)

      expect(truncated).toBeDefined()
      expect(truncated!.length).toBeLessThan(body.length)
      expect(truncated).toContain('...[truncated, 600 total]')
    })

    it('should return undefined for undefined input', () => {
      const truncated = truncateBodyForLogging(undefined)
      expect(truncated).toBeUndefined()
    })
  })

  // ============================================
  // REQUEST ID GENERATION
  // ============================================

  describe('generateRequestId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId())
      }
      expect(ids.size).toBe(100)
    })

    it('should start with req_ prefix', () => {
      const id = generateRequestId()
      expect(id).toMatch(/^req_/)
    })

    it('should have reasonable length', () => {
      const id = generateRequestId()
      expect(id.length).toBeGreaterThan(10)
      expect(id.length).toBeLessThan(30)
    })
  })

  // ============================================
  // LOG ENTRY CREATION
  // ============================================

  describe('createRequestLogEntry', () => {
    const mockConfig: ApiRequestConfig = {
      method: 'GET',
      url: 'https://api.example.com/data?api_key=secret',
      headers: { Accept: 'application/json' },
    }

    const mockResponse: ApiRequestResponse = {
      success: true,
      status: 200,
      statusText: 'OK',
      latencyMs: 150,
    }

    it('should create log entry with masked URL', () => {
      const entry = createRequestLogEntry('req_123', mockConfig, mockResponse)

      expect(entry.requestId).toBe('req_123')
      expect(entry.method).toBe('GET')
      expect(entry.url).toContain('%5BREDACTED%5D') // URL encoded [REDACTED]
      expect(entry.host).toBe('api.example.com')
      expect(entry.success).toBe(true)
      expect(entry.status).toBe(200)
      expect(entry.latencyMs).toBe(150)
    })

    it('should include optional fields', () => {
      const entry = createRequestLogEntry('req_123', mockConfig, mockResponse, {
        executionId: 'exec_456',
        retryAttempt: 2,
      })

      expect(entry.executionId).toBe('exec_456')
      expect(entry.retryAttempt).toBe(2)
    })

    it('should handle failed responses', () => {
      const failedResponse: ApiRequestResponse = {
        success: false,
        latencyMs: 50,
        error: 'Connection refused',
        errorCode: 'CONNECTION_REFUSED',
      }

      const entry = createRequestLogEntry('req_123', mockConfig, failedResponse)

      expect(entry.success).toBe(false)
      expect(entry.errorCode).toBe('CONNECTION_REFUSED')
      expect(entry.errorMessage).toBe('Connection refused')
    })
  })

  describe('createSecurityLogEntry', () => {
    it('should create security event entry', () => {
      const entry = createSecurityLogEntry(
        'api_ssrf_blocked',
        'req_123',
        { url: 'http://127.0.0.1/admin', credentialId: 'cred_456' },
        { reason: 'Private IP address blocked' }
      )

      expect(entry.level).toBe('security')
      expect(entry.event).toBe('api_ssrf_blocked')
      expect(entry.requestId).toBe('req_123')
      expect(entry.credentialId).toBe('cred_456')
      expect(entry.details?.reason).toBe('Private IP address blocked')
    })

    it('should mask URL in security entry', () => {
      const entry = createSecurityLogEntry('api_rate_limit_host', 'req_123', {
        url: 'https://api.example.com/data?api_key=secret',
      })

      expect(entry.url).toContain('%5BREDACTED%5D')
    })
  })

  // ============================================
  // LOGGING FUNCTIONS
  // ============================================

  describe('logApiRequest', () => {
    it('should call custom logger', () => {
      const mockLogger = vi.fn()
      setApiRequestLogger(mockLogger)

      const config: ApiRequestConfig = {
        method: 'POST',
        url: 'https://api.example.com/data',
      }
      const response: ApiRequestResponse = {
        success: true,
        status: 201,
        statusText: 'Created',
        latencyMs: 100,
      }

      logApiRequest('req_123', config, response)

      expect(mockLogger).toHaveBeenCalledTimes(1)
      const entry = mockLogger.mock.calls[0][0]
      expect(entry.requestId).toBe('req_123')
      expect(entry.method).toBe('POST')
      expect(entry.success).toBe(true)
    })
  })

  describe('logApiSecurityEvent', () => {
    it('should call custom logger for security events', () => {
      const mockLogger = vi.fn()
      setApiRequestLogger(mockLogger)

      logApiSecurityEvent(
        'api_redirect_blocked',
        'req_456',
        { url: 'https://evil.com' },
        { originalUrl: 'https://api.example.com' }
      )

      expect(mockLogger).toHaveBeenCalledTimes(1)
      const entry = mockLogger.mock.calls[0][0]
      expect(entry.level).toBe('security')
      expect(entry.event).toBe('api_redirect_blocked')
    })
  })

  // ============================================
  // AUDIT BUFFER
  // ============================================

  describe('audit buffer', () => {
    it('should buffer audit entries', () => {
      const entry = createRequestLogEntry(
        'req_1',
        {
          method: 'GET',
          url: 'https://example.com',
        },
        {
          success: true,
          status: 200,
          statusText: 'OK',
          latencyMs: 100,
        }
      )

      bufferAuditEntry(entry)

      const entries = getBufferedAuditEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].requestId).toBe('req_1')
    })

    it('should return entries without clearing by default', () => {
      bufferAuditEntry(
        createRequestLogEntry(
          'req_1',
          {
            method: 'GET',
            url: 'https://example.com',
          },
          {
            success: true,
            status: 200,
            statusText: 'OK',
            latencyMs: 100,
          }
        )
      )

      getBufferedAuditEntries()
      const entries = getBufferedAuditEntries()
      expect(entries).toHaveLength(1)
    })

    it('should clear entries when requested', () => {
      bufferAuditEntry(
        createRequestLogEntry(
          'req_1',
          {
            method: 'GET',
            url: 'https://example.com',
          },
          {
            success: true,
            status: 200,
            statusText: 'OK',
            latencyMs: 100,
          }
        )
      )

      const entries = getBufferedAuditEntries(true)
      expect(entries).toHaveLength(1)

      const afterClear = getBufferedAuditEntries()
      expect(afterClear).toHaveLength(0)
    })

    it('should limit buffer size', () => {
      // Add more than max buffer size
      for (let i = 0; i < 150; i++) {
        bufferAuditEntry(
          createRequestLogEntry(
            `req_${i}`,
            {
              method: 'GET',
              url: 'https://example.com',
            },
            {
              success: true,
              status: 200,
              statusText: 'OK',
              latencyMs: 100,
            }
          )
        )
      }

      const stats = getAuditBufferStats()
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize)
    })

    it('should clear buffer', () => {
      bufferAuditEntry(
        createRequestLogEntry(
          'req_1',
          {
            method: 'GET',
            url: 'https://example.com',
          },
          {
            success: true,
            status: 200,
            statusText: 'OK',
            latencyMs: 100,
          }
        )
      )

      clearAuditBuffer()

      expect(getBufferedAuditEntries()).toHaveLength(0)
    })

    it('should provide buffer stats', () => {
      const stats = getAuditBufferStats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats.maxSize).toBe(100)
    })
  })
})
