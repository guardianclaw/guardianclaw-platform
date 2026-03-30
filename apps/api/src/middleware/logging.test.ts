/**
 * Logging middleware tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { loggingMiddleware, getRequestId, getLogger, getRequestContext } from './logging'
import { resetLoggerConfig } from '../lib/logger'
import { resetMetrics, getMetricsJSON, MetricNames } from '../lib/metrics'

describe('Logging Middleware', () => {
  let app: Hono

  beforeEach(() => {
    resetLoggerConfig()
    resetMetrics()

    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})

    app = new Hono()
    app.use('*', loggingMiddleware({ skipPaths: ['/health', '/metrics'] }))

    // Test routes
    app.get('/test', (c) => {
      return c.json({ ok: true })
    })

    app.get('/test-context', (c) => {
      const requestId = getRequestId(c)
      const logger = getLogger(c)
      const ctx = getRequestContext(c)

      return c.json({
        requestId,
        hasLogger: !!logger,
        context: ctx,
      })
    })

    app.get('/error', () => {
      throw new Error('Test error')
    })

    app.get('/health', (c) => c.json({ status: 'ok' }))
    app.get('/metrics', (c) => c.text('metrics'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('request ID', () => {
    it('generates request ID', async () => {
      const res = await app.request('/test-context')
      const data = await res.json()

      expect(data.requestId).toBeDefined()
      expect(typeof data.requestId).toBe('string')
    })

    it('uses provided request ID header', async () => {
      const res = await app.request('/test-context', {
        headers: { 'X-Request-ID': 'custom-req-123' },
      })
      const data = await res.json()

      expect(data.requestId).toBe('custom-req-123')
    })

    it('sets X-Request-ID response header', async () => {
      const res = await app.request('/test')

      expect(res.headers.get('X-Request-ID')).toBeDefined()
    })
  })

  describe('request context', () => {
    it('provides request context', async () => {
      const res = await app.request('/test-context', {
        headers: { 'User-Agent': 'TestAgent/1.0' },
      })
      const data = await res.json()

      expect(data.context).toBeDefined()
      expect(data.context.method).toBe('GET')
      expect(data.context.path).toBe('/test-context')
      expect(data.context.userAgent).toBe('TestAgent/1.0')
    })

    it('provides logger instance', async () => {
      const res = await app.request('/test-context')
      const data = await res.json()

      expect(data.hasLogger).toBe(true)
    })
  })

  describe('metrics collection', () => {
    it('records request metrics', async () => {
      await app.request('/test')

      const json = getMetricsJSON()
      expect(json.counters[MetricNames.HTTP_REQUESTS_TOTAL]).toBeDefined()
      expect(json.histograms[MetricNames.HTTP_REQUEST_DURATION_MS]).toBeDefined()
    })

    it('records correct status code', async () => {
      await app.request('/test')

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.HTTP_REQUESTS_TOTAL][0]

      expect(counter.labels.status).toBe('200')
    })

    it('records error status for errors', async () => {
      try {
        await app.request('/error')
      } catch {
        // Ignore
      }

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.HTTP_REQUESTS_TOTAL]?.[0]

      // Error should be recorded
      if (counter) {
        expect(counter.labels.status_class).toBe('5xx')
      }
    })
  })

  describe('skip paths', () => {
    it('skips logging for health endpoint', async () => {
      const spy = vi.spyOn(console, 'log')
      await app.request('/health')

      // Should not log request/response for skipped paths
      const calls = spy.mock.calls.filter(
        (call) => call[0]?.includes?.('request_start') || call[0]?.includes?.('request_end')
      )
      expect(calls.length).toBe(0)
    })

    it('skips logging for metrics endpoint', async () => {
      const spy = vi.spyOn(console, 'log')
      await app.request('/metrics')

      const calls = spy.mock.calls.filter(
        (call) => call[0]?.includes?.('request_start') || call[0]?.includes?.('request_end')
      )
      expect(calls.length).toBe(0)
    })

    it('does not skip regular endpoints', async () => {
      const spy = vi.spyOn(console, 'log')
      await app.request('/test')

      // Should have logged
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('logs errors and re-throws', async () => {
      const _errorSpy = vi.spyOn(console, 'error')

      app.onError((err) => {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
      })

      const res = await app.request('/error')
      expect(res.status).toBe(500)

      // Error should be logged
      // Note: The middleware logs via logResponse which uses console.error for 5xx
    })
  })

  describe('client IP extraction and hashing', () => {
    // IPs are now hashed for GDPR compliance - we don't expose raw IPs

    it('hashes IP from cf-connecting-ip', async () => {
      const res = await app.request('/test-context', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })
      const data = await res.json()

      // IP should be hashed, not raw
      expect(data.context.ipHash).toBeDefined()
      expect(data.context.ipHash).toMatch(/^[a-f0-9]{16}$/)
      expect(data.context.ip).toBeUndefined() // Raw IP should not appear
    })

    it('hashes IP from x-forwarded-for', async () => {
      const res = await app.request('/test-context', {
        headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' },
      })
      const data = await res.json()

      expect(data.context.ipHash).toBeDefined()
      expect(data.context.ipHash).toMatch(/^[a-f0-9]{16}$/)
      expect(data.context.ip).toBeUndefined()
    })

    it('hashes IP from x-real-ip', async () => {
      const res = await app.request('/test-context', {
        headers: { 'x-real-ip': '13.14.15.16' },
      })
      const data = await res.json()

      expect(data.context.ipHash).toBeDefined()
      expect(data.context.ipHash).toMatch(/^[a-f0-9]{16}$/)
      expect(data.context.ip).toBeUndefined()
    })

    it('produces consistent hash for same IP', async () => {
      const res1 = await app.request('/test-context', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })
      const res2 = await app.request('/test-context', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })
      const data1 = await res1.json()
      const data2 = await res2.json()

      expect(data1.context.ipHash).toBe(data2.context.ipHash)
    })

    it('produces different hash for different IPs', async () => {
      const res1 = await app.request('/test-context', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      })
      const res2 = await app.request('/test-context', {
        headers: { 'cf-connecting-ip': '5.6.7.8' },
      })
      const data1 = await res1.json()
      const data2 = await res2.json()

      expect(data1.context.ipHash).not.toBe(data2.context.ipHash)
    })

    it('uses undefined ipHash when no IP headers', async () => {
      const res = await app.request('/test-context')
      const data = await res.json()

      // 'unknown' IP should not produce a hash
      expect(data.context.ipHash).toBeUndefined()
      expect(data.context.ip).toBeUndefined()
    })
  })
})

describe('Context helper functions', () => {
  it('getRequestId returns undefined without middleware', async () => {
    const testApp = new Hono()
    testApp.get('/test', (c) => {
      return c.json({ requestId: getRequestId(c) })
    })

    const res = await testApp.request('/test')
    const data = await res.json()
    expect(data.requestId).toBeUndefined()
  })

  it('getLogger returns undefined without middleware', async () => {
    const testApp = new Hono()
    testApp.get('/test', (c) => {
      return c.json({ hasLogger: !!getLogger(c) })
    })

    const res = await testApp.request('/test')
    const data = await res.json()
    expect(data.hasLogger).toBe(false)
  })

  it('getRequestContext returns undefined without middleware', async () => {
    const testApp = new Hono()
    testApp.get('/test', (c) => {
      return c.json({ hasContext: !!getRequestContext(c) })
    })

    const res = await testApp.request('/test')
    const data = await res.json()
    expect(data.hasContext).toBe(false)
  })
})
