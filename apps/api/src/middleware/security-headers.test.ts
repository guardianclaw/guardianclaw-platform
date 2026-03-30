/**
 * Security Headers Middleware Tests
 *
 * Tests: header presence, HSTS behavior, CSP content, skip paths
 */

import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { securityHeadersMiddleware } from './security-headers'

describe('Security Headers Middleware', () => {
  describe('default configuration', () => {
    it('adds all security headers to response', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Security-Policy')).toBeDefined()
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
      expect(res.headers.get('X-XSS-Protection')).toBe('0')
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(res.headers.get('Permissions-Policy')).toBeDefined()
      expect(res.headers.get('Cache-Control')).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
      expect(res.headers.get('Pragma')).toBe('no-cache')
      expect(res.headers.get('Expires')).toBe('0')
    })

    it('does not add HSTS in non-production environment', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.headers.get('Strict-Transport-Security')).toBeNull()
    })
  })

  describe('HSTS in production', () => {
    it('adds HSTS header in production environment', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      // Simulate production environment
      app.use('*', async (c, next) => {
        // @ts-expect-error - setting env for test
        c.env = { ENVIRONMENT: 'production' }
        await next()
      })
      app.use('*', securityHeadersMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains'
      )
    })

    it('respects custom HSTS max-age', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', async (c, next) => {
        // @ts-expect-error - setting env for test
        c.env = { ENVIRONMENT: 'production' }
        await next()
      })
      app.use('*', securityHeadersMiddleware({ hstsMaxAge: 86400 }))
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=86400; includeSubDomains')
    })

    it('can disable includeSubDomains', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', async (c, next) => {
        // @ts-expect-error - setting env for test
        c.env = { ENVIRONMENT: 'production' }
        await next()
      })
      app.use('*', securityHeadersMiddleware({ hstsIncludeSubDomains: false }))
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000')
    })

    it('can disable HSTS entirely', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', async (c, next) => {
        // @ts-expect-error - setting env for test
        c.env = { ENVIRONMENT: 'production' }
        await next()
      })
      app.use('*', securityHeadersMiddleware({ enableHSTS: false }))
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.headers.get('Strict-Transport-Security')).toBeNull()
    })
  })

  describe('Content-Security-Policy', () => {
    it('includes restrictive default directives', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')
      const csp = res.headers.get('Content-Security-Policy')

      expect(csp).toContain("default-src 'none'")
      expect(csp).toContain("script-src 'none'")
      expect(csp).toContain("frame-ancestors 'none'")
      expect(csp).toContain("form-action 'none'")
      expect(csp).toContain("object-src 'none'")
    })

    it('can add additional CSP directives', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use(
        '*',
        securityHeadersMiddleware({
          additionalCSP: {
            'report-uri': ['/csp-report'],
          },
        })
      )
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')
      const csp = res.headers.get('Content-Security-Policy')

      expect(csp).toContain('report-uri /csp-report')
    })
  })

  describe('Permissions-Policy', () => {
    it('denies all browser features', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')
      const policy = res.headers.get('Permissions-Policy')

      expect(policy).toContain('camera=()')
      expect(policy).toContain('microphone=()')
      expect(policy).toContain('geolocation=()')
      expect(policy).toContain('payment=()')
    })
  })

  describe('skip paths', () => {
    it('skips security headers for specified paths', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware({ skipPaths: ['/health', '/metrics'] }))
      app.get('/health', (c) => c.json({ status: 'ok' }))
      app.get('/api/test', (c) => c.json({ ok: true }))

      const healthRes = await app.request('/health')
      const apiRes = await app.request('/api/test')

      // Health endpoint should not have security headers
      expect(healthRes.headers.get('Content-Security-Policy')).toBeNull()
      expect(healthRes.headers.get('X-Frame-Options')).toBeNull()

      // API endpoint should have security headers
      expect(apiRes.headers.get('Content-Security-Policy')).toBeDefined()
      expect(apiRes.headers.get('X-Frame-Options')).toBe('DENY')
    })
  })

  describe('cache control', () => {
    it('sets cache control headers by default', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/test', (c) => c.json({ ok: true }))

      const res = await app.request('/test')

      expect(res.headers.get('Cache-Control')).toBe(
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
      expect(res.headers.get('Pragma')).toBe('no-cache')
      expect(res.headers.get('Expires')).toBe('0')
    })

    it('preserves existing cache control headers from route', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/cached', (c) => {
        c.header('Cache-Control', 'public, max-age=3600')
        return c.json({ ok: true })
      })

      const res = await app.request('/cached')

      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
    })
  })

  describe('edge cases', () => {
    it('handles errors in route gracefully', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/error', () => {
        throw new Error('Test error')
      })
      app.onError((err, c) => c.json({ error: err.message }, 500))

      const res = await app.request('/error')

      expect(res.status).toBe(500)
      // Security headers should still be present on error responses
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it('works with POST requests', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.post('/submit', (c) => c.json({ ok: true }))

      const res = await app.request('/submit', { method: 'POST' })

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Security-Policy')).toBeDefined()
    })

    it('works with non-JSON responses', async () => {
      const app = new Hono<{ Bindings: { ENVIRONMENT: string } }>()
      app.use('*', securityHeadersMiddleware())
      app.get('/text', (c) => c.text('Hello'))

      const res = await app.request('/text')

      expect(res.status).toBe(200)
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })
  })
})
