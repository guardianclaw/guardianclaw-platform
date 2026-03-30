/**
 * API Request Service Tests
 *
 * Tests for HTTP request functionality including:
 * - URL validation (SSRF prevention)
 * - Authentication methods
 * - Request execution
 * - Response handling
 * - Template resolution
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  validateUrl,
  applyAuthentication,
  extractJsonPath,
  formatResponseForContext,
  executeApiRequest,
  resolveTemplateInString,
  resolveTemplateInUrl,
  resolveApiRequestConfig,
  hasTemplateVariables,
  type ApiRequestConfig,
  type ApiRequestResponse,
  type AuthConfig,
} from './api-request'
import { setApiRequestLogger, resetApiRequestLogger, clearAuditBuffer } from './api-request-logger'

// Mock DNS resolver to avoid external DNS calls in tests
vi.mock('./dns-resolver', () => ({
  resolveAndValidateUrl: vi.fn(() =>
    Promise.resolve({ safe: true, ip: '104.16.132.229', latencyMs: 1 })
  ),
}))

// ============================================
// URL VALIDATION TESTS
// ============================================

describe('validateUrl', () => {
  describe('valid URLs', () => {
    it('accepts valid HTTPS URLs', () => {
      expect(validateUrl('https://api.example.com/data')).toEqual({ valid: true })
      expect(validateUrl('https://api.github.com/repos')).toEqual({ valid: true })
      expect(validateUrl('https://jsonplaceholder.typicode.com/posts')).toEqual({ valid: true })
    })

    it('accepts valid HTTP URLs', () => {
      expect(validateUrl('http://api.example.com/data')).toEqual({ valid: true })
    })

    it('accepts URLs with ports', () => {
      expect(validateUrl('https://api.example.com:8080/data')).toEqual({ valid: true })
    })

    it('accepts URLs with query parameters', () => {
      expect(validateUrl('https://api.example.com/search?q=test&page=1')).toEqual({ valid: true })
    })

    it('accepts URLs with paths', () => {
      expect(validateUrl('https://api.example.com/v1/users/123/profile')).toEqual({ valid: true })
    })
  })

  describe('blocked URLs', () => {
    it('rejects empty URL', () => {
      const result = validateUrl('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('rejects invalid URL format', () => {
      const result = validateUrl('not-a-url')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid URL')
    })

    it('rejects non-HTTP protocols', () => {
      expect(validateUrl('ftp://files.example.com/data').valid).toBe(false)
      expect(validateUrl('file:///etc/passwd').valid).toBe(false)
      expect(validateUrl('javascript:alert(1)').valid).toBe(false)
    })

    it('rejects localhost', () => {
      expect(validateUrl('http://localhost/api').valid).toBe(false)
      expect(validateUrl('http://localhost:3000/api').valid).toBe(false)
      expect(validateUrl('https://localhost/api').valid).toBe(false)
    })

    it('rejects loopback IP (127.x.x.x)', () => {
      expect(validateUrl('http://127.0.0.1/api').valid).toBe(false)
      expect(validateUrl('http://127.0.0.1:8080/api').valid).toBe(false)
      expect(validateUrl('http://127.1.2.3/api').valid).toBe(false)
    })

    it('rejects private IP ranges', () => {
      // Class A private (10.x.x.x)
      expect(validateUrl('http://10.0.0.1/api').valid).toBe(false)
      expect(validateUrl('http://10.255.255.255/api').valid).toBe(false)

      // Class B private (172.16-31.x.x)
      expect(validateUrl('http://172.16.0.1/api').valid).toBe(false)
      expect(validateUrl('http://172.31.255.255/api').valid).toBe(false)

      // Class C private (192.168.x.x)
      expect(validateUrl('http://192.168.0.1/api').valid).toBe(false)
      expect(validateUrl('http://192.168.1.100/api').valid).toBe(false)
    })

    it('rejects link-local addresses', () => {
      expect(validateUrl('http://169.254.169.254/api').valid).toBe(false)
    })

    it('rejects cloud metadata endpoints', () => {
      expect(validateUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false)
      expect(validateUrl('http://metadata.google.internal/computeMetadata').valid).toBe(false)
    })

    it('rejects 0.0.0.0', () => {
      expect(validateUrl('http://0.0.0.0/api').valid).toBe(false)
    })

    it('rejects internal-looking hostnames', () => {
      expect(validateUrl('http://internal.company.com/api').valid).toBe(false)
      expect(validateUrl('http://intranet.example.com/api').valid).toBe(false)
    })
  })
})

// ============================================
// AUTHENTICATION TESTS
// ============================================

describe('applyAuthentication', () => {
  it('returns unchanged headers when no auth', () => {
    const headers = { 'Content-Type': 'application/json' }
    const url = new URL('https://api.example.com/data')

    const result = applyAuthentication(headers, undefined, url)

    expect(result.headers).toEqual(headers)
    expect(result.url.toString()).toBe(url.toString())
  })

  it('returns unchanged headers for auth type none', () => {
    const headers = { 'Content-Type': 'application/json' }
    const url = new URL('https://api.example.com/data')
    const auth: AuthConfig = { type: 'none' }

    const result = applyAuthentication(headers, auth, url)

    expect(result.headers).toEqual(headers)
  })

  describe('API Key authentication', () => {
    it('adds API key to header by default', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'api_key',
        apiKey: 'my-secret-key',
      }

      const result = applyAuthentication(headers, auth, url)

      expect(result.headers['X-API-Key']).toBe('my-secret-key')
    })

    it('uses custom header name', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'api_key',
        apiKey: 'my-secret-key',
        apiKeyName: 'Authorization',
      }

      const result = applyAuthentication(headers, auth, url)

      expect(result.headers['Authorization']).toBe('my-secret-key')
    })

    it('adds API key to query parameter when specified', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'api_key',
        apiKey: 'my-secret-key',
        apiKeyName: 'api_key',
        apiKeyPlacement: 'query',
      }

      const result = applyAuthentication(headers, auth, url)

      expect(result.url.searchParams.get('api_key')).toBe('my-secret-key')
      expect(result.headers['api_key']).toBeUndefined()
    })
  })

  describe('Bearer token authentication', () => {
    it('adds Bearer token to Authorization header', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'bearer',
        token: 'jwt-token-here',
      }

      const result = applyAuthentication(headers, auth, url)

      expect(result.headers['Authorization']).toBe('Bearer jwt-token-here')
    })

    it('does not add header if token is missing', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'bearer',
      }

      const result = applyAuthentication(headers, auth, url)

      expect(result.headers['Authorization']).toBeUndefined()
    })
  })

  describe('Basic authentication', () => {
    it('adds Basic auth header', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'basic',
        username: 'user',
        password: 'pass',
      }

      const result = applyAuthentication(headers, auth, url)

      // Base64 of "user:pass" = "dXNlcjpwYXNz"
      expect(result.headers['Authorization']).toBe('Basic dXNlcjpwYXNz')
    })

    it('does not add header if credentials missing', () => {
      const headers = {}
      const url = new URL('https://api.example.com/data')
      const auth: AuthConfig = {
        type: 'basic',
        username: 'user',
        // Missing password
      }

      const result = applyAuthentication(headers, auth, url)

      expect(result.headers['Authorization']).toBeUndefined()
    })
  })
})

// ============================================
// JSON PATH EXTRACTION TESTS
// ============================================

describe('extractJsonPath', () => {
  it('returns original value for empty path', () => {
    const obj = { data: 'test' }
    expect(extractJsonPath(obj, '')).toEqual(obj)
  })

  it('extracts simple property', () => {
    const obj = { name: 'John' }
    expect(extractJsonPath(obj, 'name')).toBe('John')
  })

  it('extracts nested property', () => {
    const obj = { data: { user: { name: 'John' } } }
    expect(extractJsonPath(obj, 'data.user.name')).toBe('John')
  })

  it('extracts array element by index', () => {
    const obj = { items: ['a', 'b', 'c'] }
    expect(extractJsonPath(obj, 'items.0')).toBe('a')
    expect(extractJsonPath(obj, 'items.2')).toBe('c')
  })

  it('extracts from nested arrays', () => {
    const obj = { data: { items: [{ id: 1 }, { id: 2 }] } }
    expect(extractJsonPath(obj, 'data.items.0.id')).toBe(1)
    expect(extractJsonPath(obj, 'data.items.1.id')).toBe(2)
  })

  it('returns undefined for non-existent path', () => {
    const obj = { data: { name: 'test' } }
    expect(extractJsonPath(obj, 'data.missing.property')).toBeUndefined()
  })

  it('returns undefined for null value', () => {
    expect(extractJsonPath(null, 'any')).toBeUndefined()
  })

  it('returns undefined for non-object when path provided', () => {
    // Cannot extract path from primitives
    expect(extractJsonPath('string', 'any')).toBeUndefined()
    expect(extractJsonPath(123, 'any')).toBeUndefined()
  })

  it('returns original value when path is empty', () => {
    // Without path, return original
    expect(extractJsonPath('string', '')).toBe('string')
    expect(extractJsonPath(123, '')).toBe(123)
    expect(extractJsonPath({ key: 'value' }, '')).toEqual({ key: 'value' })
  })
})

// ============================================
// RESPONSE FORMATTING TESTS
// ============================================

describe('formatResponseForContext', () => {
  it('formats successful response', () => {
    const response: ApiRequestResponse = {
      success: true,
      status: 200,
      statusText: 'OK',
      body: { data: 'test' },
      latencyMs: 150,
    }

    const result = formatResponseForContext(response, {} as ApiRequestConfig)

    expect(result).toContain('200 OK')
    expect(result).toContain('"data": "test"')
    expect(result).toContain('150ms')
  })

  it('formats error response', () => {
    const response: ApiRequestResponse = {
      success: false,
      error: 'Connection timeout',
      latencyMs: 30000,
    }

    const result = formatResponseForContext(response, {} as ApiRequestConfig)

    expect(result).toContain('failed')
    expect(result).toContain('Connection timeout')
  })

  it('truncates large responses', () => {
    const largeData = 'x'.repeat(10000)
    const response: ApiRequestResponse = {
      success: true,
      status: 200,
      statusText: 'OK',
      body: largeData,
      latencyMs: 100,
    }

    const result = formatResponseForContext(response, {} as ApiRequestConfig)

    expect(result.length).toBeLessThan(6000)
  })
})

// ============================================
// TEMPLATE RESOLUTION TESTS
// ============================================

describe('resolveTemplateInString', () => {
  const context = {
    currentInput: 'current value',
    initialInput: 'initial value',
    items: [{ id: 1 }, { id: 2 }],
    variables: {
      api_key: 'secret123',
      user_id: 42,
    },
  }

  it('resolves {{current_input}}', () => {
    const result = resolveTemplateInString('Query: {{current_input}}', context)
    expect(result).toBe('Query: current value')
  })

  it('resolves {{initial_input}}', () => {
    const result = resolveTemplateInString('Original: {{initial_input}}', context)
    expect(result).toBe('Original: initial value')
  })

  it('resolves {{items}} as JSON', () => {
    const result = resolveTemplateInString('Data: {{items}}', context)
    expect(result).toBe('Data: [{"id":1},{"id":2}]')
  })

  it('resolves custom variables', () => {
    const result = resolveTemplateInString('Key: {{api_key}}, User: {{user_id}}', context)
    expect(result).toBe('Key: secret123, User: 42')
  })

  it('keeps unknown variables unchanged', () => {
    const result = resolveTemplateInString('Unknown: {{unknown_var}}', context)
    expect(result).toBe('Unknown: {{unknown_var}}')
  })

  it('resolves multiple templates', () => {
    const result = resolveTemplateInString(
      'Input: {{current_input}}, Initial: {{initial_input}}',
      context
    )
    expect(result).toBe('Input: current value, Initial: initial value')
  })

  it('handles empty string', () => {
    const result = resolveTemplateInString('', context)
    expect(result).toBe('')
  })
})

describe('resolveApiRequestConfig', () => {
  const context = {
    currentInput: 'search term',
    initialInput: 'original',
  }

  it('resolves templates in URL with encoding', () => {
    const config: ApiRequestConfig = {
      method: 'GET',
      url: 'https://api.example.com/search?q={{current_input}}',
    }

    const result = resolveApiRequestConfig(config, context)

    // URL templates are now URL encoded
    expect(result.url).toBe('https://api.example.com/search?q=search%20term')
  })

  it('resolves templates in body', () => {
    const config: ApiRequestConfig = {
      method: 'POST',
      url: 'https://api.example.com/data',
      body: JSON.stringify({ query: '{{current_input}}' }),
    }

    const result = resolveApiRequestConfig(config, context)

    expect(result.body).toContain('search term')
  })

  it('resolves templates in headers', () => {
    const config: ApiRequestConfig = {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: {
        'X-Query': '{{current_input}}',
        'X-Original': '{{initial_input}}',
      },
    }

    const result = resolveApiRequestConfig(config, context)

    expect(result.headers?.['X-Query']).toBe('search term')
    expect(result.headers?.['X-Original']).toBe('original')
  })
})

// ============================================
// REQUEST EXECUTION TESTS
// ============================================

describe('executeApiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('successful requests', () => {
    it('executes GET request successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
      expect(result.body).toEqual({ data: 'test' })
    })

    it('executes POST request with body', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 123 }), {
          status: 201,
          statusText: 'Created',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeApiRequest({
        method: 'POST',
        url: 'https://api.example.com/data',
        body: JSON.stringify({ name: 'test' }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(201)
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      )
    })

    it('executes PUT request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ updated: true }), {
          status: 200,
          statusText: 'OK',
        })
      )

      const result = await executeApiRequest({
        method: 'PUT',
        url: 'https://api.example.com/data/123',
        body: JSON.stringify({ name: 'updated' }),
      })

      expect(result.success).toBe(true)
    })

    it('executes DELETE request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 200, statusText: 'OK' })
      )

      const result = await executeApiRequest({
        method: 'DELETE',
        url: 'https://api.example.com/data/123',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe(200)
    })

    it('parses JSON response automatically', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{"nested":{"data":"value"}}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
      })

      expect(result.body).toEqual({ nested: { data: 'value' } })
    })

    it('extracts JSON path when specified', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{"data":{"items":[{"name":"first"},{"name":"second"}]}}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        extractJsonPath: 'data.items',
      })

      expect(result.body).toEqual([{ name: 'first' }, { name: 'second' }])
    })
  })

  describe('error handling', () => {
    it('returns error for invalid URL', async () => {
      const result = await executeApiRequest({
        method: 'GET',
        url: 'not-a-url',
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_URL')
    })

    it('returns error for blocked URL', async () => {
      const result = await executeApiRequest({
        method: 'GET',
        url: 'http://localhost:3000/api',
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_URL')
    })

    it('returns error for invalid method', async () => {
      const result = await executeApiRequest({
        method: 'INVALID' as unknown,
        url: 'https://api.example.com/data',
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_METHOD')
    })

    it('handles HTTP error responses', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{"error":"Not found"}', {
          status: 404,
          statusText: 'Not Found',
        })
      )

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/missing',
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(result.errorCode).toBe('HTTP_404')
    })

    it('handles timeout', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/slow',
        timeout: 100,
        enableRetry: false, // Disable retry so mock only needs one call
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('TIMEOUT')
    })

    it('handles network errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed'))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        enableRetry: false, // Disable retry so mock only needs one call
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NETWORK_ERROR')
    })

    it('handles DNS errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://nonexistent.example.com/data',
        enableRetry: false, // Disable retry so mock only needs one call
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('DNS_ERROR')
    })
  })

  describe('authentication', () => {
    it('applies bearer token', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        auth: {
          type: 'bearer',
          token: 'my-token',
        },
      })

      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
      expect(callHeaders['Authorization']).toBe('Bearer my-token')
    })

    it('applies API key in header', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        auth: {
          type: 'api_key',
          apiKey: 'secret-key',
          apiKeyName: 'X-Custom-Key',
        },
      })

      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
      expect(callHeaders['X-Custom-Key']).toBe('secret-key')
    })

    it('applies API key in query', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        auth: {
          type: 'api_key',
          apiKey: 'secret-key',
          apiKeyName: 'apikey',
          apiKeyPlacement: 'query',
        },
      })

      const calledUrl = fetchSpy.mock.calls[0][0] as string
      expect(calledUrl).toContain('apikey=secret-key')
    })
  })

  describe('size limits', () => {
    it('rejects body larger than limit', async () => {
      const largeBody = 'x'.repeat(200000)

      const result = await executeApiRequest({
        method: 'POST',
        url: 'https://api.example.com/data',
        body: largeBody,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('BODY_TOO_LARGE')
    })
  })

  describe('content type handling', () => {
    it('auto-sets JSON content type for JSON body', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await executeApiRequest({
        method: 'POST',
        url: 'https://api.example.com/data',
        body: '{"key":"value"}',
      })

      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
      expect(callHeaders['Content-Type']).toBe('application/json')
    })

    it('preserves existing content type', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await executeApiRequest({
        method: 'POST',
        url: 'https://api.example.com/data',
        body: '{"key":"value"}',
        headers: { 'Content-Type': 'text/plain' },
      })

      const callHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
      expect(callHeaders['Content-Type']).toBe('text/plain')
    })
  })

  describe('retry logic', () => {
    beforeEach(() => {
      // Disable logging during retry tests to reduce noise
      setApiRequestLogger(() => {})
      clearAuditBuffer()
    })

    afterEach(() => {
      resetApiRequestLogger()
    })

    it('retries on 5xx errors', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('{"success":true}', { status: 200 }))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        maxRetries: 2,
      })

      expect(result.success).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('does not retry on 4xx errors', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        maxRetries: 2,
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe(404)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('respects maxRetries setting', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('Server Error', { status: 500 }))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        maxRetries: 1,
      })

      expect(result.success).toBe(false)
      // Initial attempt + 1 retry = 2 calls
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('can disable retry', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/data',
        enableRetry: false,
      })

      expect(result.success).toBe(false)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('redirect handling', () => {
    beforeEach(() => {
      setApiRequestLogger(() => {})
      clearAuditBuffer()
    })

    afterEach(() => {
      resetApiRequestLogger()
    })

    it('follows valid redirects', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { Location: 'https://api.example.com/new-location' },
          })
        )
        .mockResolvedValueOnce(new Response('{"redirected":true}', { status: 200 }))

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/old-location',
        enableRetry: false,
      })

      expect(result.success).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('blocks redirects to private IPs', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/admin' },
        })
      )

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/redirect',
        enableRetry: false,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('REDIRECT_BLOCKED')
    })

    it('limits redirect count', async () => {
      // Create infinite redirect loop
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { Location: 'https://api.example.com/loop' },
        })
      )

      const result = await executeApiRequest({
        method: 'GET',
        url: 'https://api.example.com/loop',
        enableRetry: false,
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('TOO_MANY_REDIRECTS')
    })
  })
})

// ============================================
// URL TEMPLATE ENCODING TESTS
// ============================================

describe('resolveTemplateInUrl', () => {
  const context = {
    currentInput: 'hello world',
    initialInput: 'foo & bar',
    items: [{ id: 1 }],
    variables: {
      search: 'query=test&page=1',
      safe: 'safevalue',
    },
  }

  it('URL encodes {{current_input}}', () => {
    const result = resolveTemplateInUrl(
      'https://api.example.com/search?q={{current_input}}',
      context
    )
    expect(result).toBe('https://api.example.com/search?q=hello%20world')
  })

  it('URL encodes {{initial_input}}', () => {
    const result = resolveTemplateInUrl(
      'https://api.example.com/search?q={{initial_input}}',
      context
    )
    expect(result).toBe('https://api.example.com/search?q=foo%20%26%20bar')
  })

  it('URL encodes special characters in variables', () => {
    const result = resolveTemplateInUrl('https://api.example.com/search?{{search}}', context)
    expect(result).toBe('https://api.example.com/search?query%3Dtest%26page%3D1')
  })

  it('URL encodes {{items}} as JSON', () => {
    const result = resolveTemplateInUrl('https://api.example.com/data?items={{items}}', context)
    expect(result).toBe('https://api.example.com/data?items=%5B%7B%22id%22%3A1%7D%5D')
  })

  it('preserves safe characters', () => {
    const result = resolveTemplateInUrl('https://api.example.com/data?q={{safe}}', context)
    expect(result).toBe('https://api.example.com/data?q=safevalue')
  })

  it('keeps unknown variables unchanged', () => {
    const result = resolveTemplateInUrl('https://api.example.com/data?q={{unknown}}', context)
    expect(result).toBe('https://api.example.com/data?q={{unknown}}')
  })
})

describe('hasTemplateVariables', () => {
  it('detects template variables', () => {
    expect(hasTemplateVariables('{{current_input}}')).toBe(true)
    expect(hasTemplateVariables('https://api.com?q={{search}}')).toBe(true)
    expect(hasTemplateVariables('{{a}} and {{b}}')).toBe(true)
  })

  it('returns false for strings without templates', () => {
    expect(hasTemplateVariables('https://api.example.com/data')).toBe(false)
    expect(hasTemplateVariables('plain text')).toBe(false)
    expect(hasTemplateVariables('{not a template}')).toBe(false)
  })
})

describe('resolveApiRequestConfig URL encoding', () => {
  const context = {
    currentInput: 'hello world',
    initialInput: 'initial',
  }

  it('URL encodes templates in URL but not in body', () => {
    const config: ApiRequestConfig = {
      method: 'POST',
      url: 'https://api.example.com/search?q={{current_input}}',
      body: JSON.stringify({ query: '{{current_input}}' }),
    }

    const result = resolveApiRequestConfig(config, context)

    // URL should be encoded
    expect(result.url).toBe('https://api.example.com/search?q=hello%20world')
    // Body should NOT be encoded (preserve JSON structure)
    expect(result.body).toBe('{"query":"hello world"}')
  })

  it('does not URL encode headers', () => {
    const config: ApiRequestConfig = {
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: {
        'X-Query': '{{current_input}}',
      },
    }

    const result = resolveApiRequestConfig(config, context)

    // Headers should NOT be URL encoded
    expect(result.headers?.['X-Query']).toBe('hello world')
  })
})
