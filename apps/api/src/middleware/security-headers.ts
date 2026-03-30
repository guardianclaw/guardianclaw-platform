/**
 * Security Headers Middleware
 *
 * Adds standard HTTP security headers to all responses.
 * Implements defense-in-depth for XSS, clickjacking, MIME sniffing, etc.
 *
 * Headers implemented:
 * - Strict-Transport-Security (HSTS)
 * - Content-Security-Policy (CSP)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - X-XSS-Protection (legacy browsers)
 * - Referrer-Policy
 * - Permissions-Policy
 *
 * Reference: OWASP Secure Headers Project
 */

import { createMiddleware } from 'hono/factory'

type Env = {
  Bindings: {
    ENVIRONMENT?: string
  }
}

export interface SecurityHeadersOptions {
  /**
   * Enable HSTS header. Should be true in production.
   * @default true
   */
  enableHSTS?: boolean

  /**
   * HSTS max-age in seconds.
   * @default 31536000 (1 year)
   */
  hstsMaxAge?: number

  /**
   * Include subdomains in HSTS.
   * @default true
   */
  hstsIncludeSubDomains?: boolean

  /**
   * Additional CSP directives to merge with defaults.
   */
  additionalCSP?: Record<string, string[]>

  /**
   * Paths to skip (e.g., health checks that need minimal overhead).
   * @default []
   */
  skipPaths?: string[]
}

const DEFAULT_OPTIONS: Required<SecurityHeadersOptions> = {
  enableHSTS: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  additionalCSP: {},
  skipPaths: [],
}

/**
 * Build Content-Security-Policy header value.
 *
 * API-specific CSP - primarily focused on preventing XSS in JSON responses
 * and blocking framing attempts.
 */
function buildCSP(additional: Record<string, string[]> = {}): string {
  const directives: Record<string, string[]> = {
    // Default: deny everything
    'default-src': ["'none'"],

    // Scripts: only inline for JSON-P (if ever needed, deny by default)
    'script-src': ["'none'"],

    // Styles: none for API
    'style-src': ["'none'"],

    // Images: none for API
    'img-src': ["'none'"],

    // Fonts: none for API
    'font-src': ["'none'"],

    // Connections: allow self for potential redirects
    'connect-src': ["'self'"],

    // Media: none for API
    'media-src': ["'none'"],

    // Objects (Flash, etc.): block
    'object-src': ["'none'"],

    // Frames: block all framing
    'frame-src': ["'none'"],
    'child-src': ["'none'"],

    // Workers: none for API
    'worker-src': ["'none'"],

    // Form actions: none (API shouldn't have forms)
    'form-action': ["'none'"],

    // Frame ancestors: deny (clickjacking prevention)
    'frame-ancestors': ["'none'"],

    // Base URI: self only
    'base-uri': ["'self'"],

    // Manifest: none
    'manifest-src': ["'none'"],

    // Merge additional directives
    ...additional,
  }

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

/**
 * Build Permissions-Policy header value.
 *
 * Restricts access to browser features. For an API, we deny everything.
 */
function buildPermissionsPolicy(): string {
  const policies = [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()',
  ]

  return policies.join(', ')
}

/**
 * Security headers middleware.
 *
 * Adds comprehensive security headers to all responses.
 */
export const securityHeadersMiddleware = (options: SecurityHeadersOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const csp = buildCSP(opts.additionalCSP)
  const permissionsPolicy = buildPermissionsPolicy()

  return createMiddleware<Env>(async (c, next) => {
    // Check if path should be skipped
    const path = new URL(c.req.url).pathname
    if (opts.skipPaths.some((p) => path.startsWith(p))) {
      await next()
      return
    }

    // Execute route handler first
    await next()

    // Add security headers to response

    // HSTS - only in production (Cloudflare handles TLS)
    const isProduction = c.env?.ENVIRONMENT === 'production'
    if (opts.enableHSTS && isProduction) {
      const hstsValue = `max-age=${opts.hstsMaxAge}${opts.hstsIncludeSubDomains ? '; includeSubDomains' : ''}`
      c.res.headers.set('Strict-Transport-Security', hstsValue)
    }

    // Content-Security-Policy
    c.res.headers.set('Content-Security-Policy', csp)

    // X-Content-Type-Options - prevent MIME sniffing
    c.res.headers.set('X-Content-Type-Options', 'nosniff')

    // X-Frame-Options - prevent clickjacking (legacy, CSP frame-ancestors is preferred)
    c.res.headers.set('X-Frame-Options', 'DENY')

    // X-XSS-Protection - legacy browsers (modern browsers use CSP)
    // Setting to 0 as recommended by OWASP (can cause issues in some browsers)
    c.res.headers.set('X-XSS-Protection', '0')

    // Referrer-Policy - control referrer information
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Permissions-Policy - restrict browser features
    c.res.headers.set('Permissions-Policy', permissionsPolicy)

    // Cache-Control for API responses - no caching by default
    // Individual routes can override this
    if (!c.res.headers.has('Cache-Control')) {
      c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    }

    // Pragma - legacy cache control
    if (!c.res.headers.has('Pragma')) {
      c.res.headers.set('Pragma', 'no-cache')
    }

    // Expires - legacy cache control
    if (!c.res.headers.has('Expires')) {
      c.res.headers.set('Expires', '0')
    }
  })
}

/**
 * Default export for convenience.
 */
export default securityHeadersMiddleware
