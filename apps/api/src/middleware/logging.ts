/**
 * Request logging middleware for Hono.
 *
 * Provides structured logging, request ID generation, and metrics collection.
 *
 * Security: IPs are hashed using SHA-256 with daily salt for GDPR compliance.
 * Reference: SECURITY_SPEC.md Section 9.2.6
 */

import type { Context, Next, MiddlewareHandler } from 'hono'
import {
  type RequestContext,
  logRequest,
  logResponse,
  createLogger,
  configureLogger,
  LogLevel,
} from '../lib/logger'
import { recordRequest } from '../lib/metrics'
import { hashIP } from '../lib/secure-logger'

/**
 * Variable keys for storing context in Hono's c.set/c.get.
 */
export const ContextKeys = {
  REQUEST_ID: 'requestId',
  REQUEST_START: 'requestStart',
  REQUEST_CONTEXT: 'requestContext',
  LOGGER: 'logger',
} as const

/**
 * Generate a unique request ID.
 * Uses crypto.randomUUID() when available, fallback to timestamp-based ID.
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older environments
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${random}`
}

/**
 * Extract client IP from Cloudflare headers or fallback.
 */
export function getClientIP(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Build request context from Hono context.
 *
 * Security: IP is hashed using SHA-256 with daily salt before being included.
 * This ensures no raw IP addresses appear in logs while allowing rate limiting.
 *
 * @param c - Hono context
 * @param requestId - Generated request ID
 * @param ipHashSecret - Secret for IP hashing (from env)
 */
async function buildRequestContext(
  c: Context,
  requestId: string,
  ipHashSecret?: string
): Promise<RequestContext> {
  const url = new URL(c.req.url)
  const rawIP = getClientIP(c)

  // Hash IP using SHA-256 with daily salt
  let ipHash: string | undefined
  if (rawIP !== 'unknown') {
    // Use provided secret or fall back to a default (with warning in dev)
    const secret = ipHashSecret || 'default-ip-hash-secret'
    ipHash = await hashIP(rawIP, secret)
  }

  return {
    requestId,
    method: c.req.method,
    path: url.pathname,
    userAgent: c.req.header('user-agent'),
    ipHash,
  }
}

/**
 * Logging middleware options.
 */
export interface LoggingMiddlewareOptions {
  /** Skip logging for these paths */
  skipPaths?: string[]
  /** Include query params in path (default: false) */
  includeQuery?: boolean
  /** Log request body (careful with sensitive data) */
  logBody?: boolean
  /** Environment for log level configuration */
  environment?: string
}

/**
 * Environment bindings that the middleware expects.
 * Uses intersection with Record to allow additional properties.
 */
interface LoggingEnv {
  ENVIRONMENT?: string
  IP_HASH_SECRET?: string
}

/**
 * Create logging middleware.
 *
 * Adds request ID, logs request/response, and collects metrics.
 * IP addresses are hashed using SHA-256 with daily salt rotation.
 */
export function loggingMiddleware(options: LoggingMiddlewareOptions = {}): MiddlewareHandler {
  const { skipPaths = ['/health', '/metrics'] } = options

  return async (c: Context<{ Bindings: LoggingEnv }>, next: Next) => {
    const url = new URL(c.req.url)

    // Skip logging for certain paths
    if (skipPaths.some((p) => url.pathname.startsWith(p))) {
      return next()
    }

    // Get environment from bindings
    const environment = options.environment || c.env?.ENVIRONMENT || 'development'

    // Configure logger based on environment
    configureLogger({
      environment,
      minLevel: environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
    })

    // Generate request ID and start time
    const requestId = c.req.header('x-request-id') || generateRequestId()
    const startTime = Date.now()

    // Build request context with SHA-256 hashed IP
    const ipHashSecret = c.env?.IP_HASH_SECRET
    const requestContext = await buildRequestContext(c, requestId, ipHashSecret)

    // Store in Hono context for use by route handlers
    // Using type assertion as Hono's strict typing doesn't allow custom keys by default
    ;(c as unknown as { set: (key: string, value: unknown) => void }).set(
      ContextKeys.REQUEST_ID,
      requestId
    )
    ;(c as unknown as { set: (key: string, value: unknown) => void }).set(
      ContextKeys.REQUEST_START,
      startTime
    )
    ;(c as unknown as { set: (key: string, value: unknown) => void }).set(
      ContextKeys.REQUEST_CONTEXT,
      requestContext
    )
    ;(c as unknown as { set: (key: string, value: unknown) => void }).set(
      ContextKeys.LOGGER,
      createLogger(requestContext)
    )

    // Set response header
    c.header('X-Request-ID', requestId)

    // Log request start
    logRequest(requestContext)

    try {
      // Execute route handler
      await next()

      // Calculate duration
      const duration = Date.now() - startTime

      // Log response
      logResponse(requestContext, c.res.status, duration)

      // Record metrics
      recordRequest(c.req.method, url.pathname, c.res.status, duration)
    } catch (error) {
      // Calculate duration for error case
      const duration = Date.now() - startTime

      // Log error response
      logResponse(requestContext, 500, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Record error metrics
      recordRequest(c.req.method, url.pathname, 500, duration)

      // Re-throw for error handler
      throw error
    }
  }
}

/**
 * Get request ID from context.
 */
export function getRequestId(c: Context): string | undefined {
  return c.get(ContextKeys.REQUEST_ID)
}

/**
 * Get logger from context.
 */
export function getLogger(c: Context): ReturnType<typeof createLogger> | undefined {
  return c.get(ContextKeys.LOGGER)
}

/**
 * Get request context from Hono context.
 */
export function getRequestContext(c: Context): RequestContext | undefined {
  return c.get(ContextKeys.REQUEST_CONTEXT)
}
