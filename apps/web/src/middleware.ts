/**
 * Security Middleware
 * Reference: SECURITY_SPEC.md Section 8.4 and 8.5
 *
 * Implements:
 * - CSRF protection via origin validation (fail-secure)
 * - Security headers (backup for next.config.js)
 *
 * Security Principle: Fail secure - when in doubt, block the request
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Allowed origins for mutation requests (POST, PUT, DELETE, PATCH)
 * Must be exact matches - no wildcards for security
 */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  // Production
  'https://guardianclaw.org',
  'https://www.guardianclaw.org',
  'https://claw-platform.pages.dev',
  // Development (only active in non-production)
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://127.0.0.1:3000']
    : []),
])

/**
 * HTTP methods that modify data and REQUIRE origin validation
 * These methods are vulnerable to CSRF attacks
 */
const MUTATION_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

/**
 * Paths that are exempt from CSRF validation
 * Only add paths that are truly safe (e.g., public webhooks with their own auth)
 */
const CSRF_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  // Currently none - all mutations require CSRF protection
])

/**
 * Validate if the origin is allowed
 * @returns true if origin is explicitly allowed, false otherwise
 */
function isOriginAllowed(origin: string): boolean {
  // Check exact match in allowlist
  if (ALLOWED_ORIGINS.has(origin)) {
    return true
  }

  return false
}

/**
 * Validate CSRF for mutation requests
 * Implements fail-secure: blocks if validation cannot be performed
 *
 * @returns { allowed: boolean, reason?: string }
 */
function validateCsrf(request: NextRequest): { allowed: boolean; reason?: string } {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Case 1: Origin header present - validate it
  if (origin) {
    if (isOriginAllowed(origin)) {
      return { allowed: true }
    }
    return { allowed: false, reason: `origin_not_allowed: ${origin}` }
  }

  // Case 2: No origin but referer present - validate referer's origin
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (isOriginAllowed(refererOrigin)) {
        return { allowed: true }
      }
      return { allowed: false, reason: `referer_origin_not_allowed: ${refererOrigin}` }
    } catch {
      return { allowed: false, reason: 'referer_invalid_url' }
    }
  }

  // Case 3: No origin AND no referer
  // This is suspicious for browser-based mutation requests
  // Browsers always send Origin header for cross-origin requests
  // Same-origin POST requests may not send Origin but should have Referer
  //
  // FAIL SECURE: Block the request
  // This may block legitimate API clients (curl, scripts) but that's acceptable
  // for a browser-focused web application. API clients should use the API directly.
  return { allowed: false, reason: 'no_origin_or_referer' }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CSRF Protection: Validate origin for mutation methods
  if (MUTATION_METHODS.has(request.method)) {
    // Check if path is exempt
    if (!CSRF_EXEMPT_PATHS.has(pathname)) {
      const validation = validateCsrf(request)

      if (!validation.allowed) {
        // Log blocked request (sanitized - no PII)
        console.warn('[Security] CSRF blocked:', {
          method: request.method,
          path: pathname,
          reason: validation.reason,
          timestamp: new Date().toISOString(),
        })

        return new NextResponse(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Request blocked by security policy',
            },
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }
    }
  }

  // Continue with request
  const response = NextResponse.next()

  // Add security headers (backup - primary headers are in next.config.js)
  // These ensure headers are present even if next.config.js is misconfigured
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}

/**
 * Middleware matcher configuration
 * Excludes static files and assets for performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
}
