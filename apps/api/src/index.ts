import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { agentsRoutes } from './routes/agents'
import { conversationsRoutes } from './routes/conversations'
import { deployRoutes } from './routes/deploy'
import { invokeRoutes } from './routes/invoke'
import { demoRoutes } from './routes/demo'
import { governanceRoutes } from './routes/governance'
import { metricsRoutes } from './routes/metrics'
import { llmKeysRoutes } from './routes/llm-keys'
import { paymentsRoutes } from './routes/payments'
import { creditsRoutes } from './routes/credits'
import { pricesRoutes } from './routes/prices'
import { userRoutes } from './routes/user'
import { adminRoutes } from './routes/admin'
import { webhookRoutes, webhookTriggerRoutes } from './routes/webhooks'
import { webhookEndpointRoutes } from './routes/webhook-endpoints'
import { toolCredentialRoutes } from './routes/tool-credentials'
import { executionLogsRoutes } from './routes/execution-logs'
import { alertsRoutes } from './routes/alerts'
import { characterRoutes } from './routes/character'
import { memoriesRoutes } from './routes/memories'
import { agentExportRoutes } from './routes/agent-export'
import { complianceRoutes } from './routes/compliance'
import { contactRoutes } from './routes/contact'
import { socialDeliveriesRoutes } from './routes/social-deliveries'
import { loggingMiddleware, getRequestId } from './middleware/logging'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { securityHeadersMiddleware } from './middleware/security-headers'
import { isApiError, toApiError, ErrorCode, type ApiErrorResponse } from './lib/errors'
import { validateRequiredEnv } from './lib/env-validation'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { scrubPII } from './lib/secure-logger'
import { createSafeErrorResponse } from './middleware/sanitize'
import { scheduled } from './scheduled'

type Bindings = {
  ENVIRONMENT: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  // Security - IP hashing for GDPR compliance
  IP_HASH_SECRET?: string
  // Modal.com Runtime URLs
  MODAL_RUNTIME_URL?: string
  MODAL_HEALTH_URL?: string
  MODAL_VALIDATE_INPUT_URL?: string
  MODAL_VALIDATE_OUTPUT_URL?: string
  // Optional fallback
  OPENAI_API_KEY?: string
  API_BASE_URL?: string
  // KV Namespaces
  RATE_LIMIT_KV?: KVNamespace
  // Payments
  TREASURY_WALLET?: string
  SOLANA_RPC_URL?: string
  // Contact form (Resend)
  RESEND_API_KEY?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Environment validation middleware — returns 503 if critical vars are missing
app.use('*', async (c, next) => {
  // Skip for health endpoint (it does its own checks)
  if (c.req.path === '/health' || c.req.path === '/health/ready') {
    return next()
  }

  const result = validateRequiredEnv(c.env)

  if (!result.valid) {
    console.error(`[STARTUP] Missing required env vars: ${result.missing.join(', ')}`)
    return c.json(
      {
        error: 'Service not configured — missing required environment variables',
        code: ErrorCode.SERVICE_UNAVAILABLE,
        missing: result.missing,
      } satisfies ApiErrorResponse & { missing: string[] },
      503 as ContentfulStatusCode
    )
  }

  // Log warnings once (cached, so this only logs on first request)
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`[ENV] ${warning}`)
    }
  }

  return next()
})

// Logging middleware (adds request ID, structured logging, metrics)
app.use('*', loggingMiddleware({ skipPaths: ['/health', '/metrics'] }))

// Security headers middleware (CSP, HSTS, X-Frame-Options, etc.)
// Skip for health checks to minimize overhead
app.use('*', securityHeadersMiddleware({ skipPaths: ['/health', '/metrics'] }))

// CORS - Hardened configuration with explicit methods and headers
// Production origins only allow HTTPS, localhost allowed only in development
// MUST run before rate limiting so 429 responses include CORS headers
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      // Production origins (HTTPS only)
      const productionOrigins = [
        'https://guardianclaw.org',
        'https://www.guardianclaw.org',
        'https://staging.guardianclaw.org',
      ]

      // Development origin (only in non-production)
      const env = c.env.ENVIRONMENT || 'development'
      const allowedOrigins =
        env === 'production' ? productionOrigins : [...productionOrigins, 'http://localhost:3000']

      // Check exact match first
      if (allowedOrigins.includes(origin || '')) {
        return origin
      }

      // Allow Vercel preview deployments (must be HTTPS)
      if (origin && /^https:\/\/guardianclaw-platform[a-z0-9-]*\.vercel\.app$/.test(origin)) {
        return origin
      }

      // No origin header (same-origin requests, curl, etc.) - allow
      if (!origin) {
        return productionOrigins[0]
      }

      // Origin not allowed - return first allowed origin (CORS will block)
      return productionOrigins[0]
    },
    // Explicit allowed methods
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Explicit allowed headers
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Wallet-Address',
      'X-LLM-Key',
      'Accept',
      'Origin',
    ],
    // Exposed headers (readable by client)
    exposeHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    // Allow credentials (cookies, auth headers)
    credentials: true,
    // Preflight cache duration (1 hour)
    maxAge: 3600,
  })
)

// Rate limiting middleware (global 1000/min per IP, endpoint-specific limits)
// SECURITY_SPEC Section 3.1.2
// Runs after CORS so error responses (429) still include CORS headers
app.use('*', rateLimitMiddleware({ skipPaths: ['/health', '/metrics'] }))

// Request body size limit (2MB) — first line of defense before route-level validation
app.use('*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return next()
  }
  const contentLength = c.req.header('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (!isNaN(size) && size > 2_097_152) {
      return c.json({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413)
    }
  }
  return next()
})

// Routes
app.route('/health', healthRoutes)
app.route('/metrics', metricsRoutes)
app.route('/auth', authRoutes)
app.route('/agents', agentsRoutes)
app.route('/agents', conversationsRoutes) // Nested under /agents/:id/conversations
app.route('/deploy', deployRoutes)
app.route('/invoke', invokeRoutes)
app.route('/demo', demoRoutes)
app.route('/governance', governanceRoutes)
app.route('/llm-keys', llmKeysRoutes)
app.route('/payments', paymentsRoutes)
app.route('/credits', creditsRoutes)
app.route('/prices', pricesRoutes)
app.route('/user', userRoutes)
app.route('/admin', adminRoutes)
app.route('/', webhookRoutes) // /agents/:id/webhooks (authenticated)
app.route('/webhooks', webhookTriggerRoutes) // /webhooks/:id/trigger (public)
app.route('/', webhookEndpointRoutes) // /agents/:id/endpoints (authenticated)
app.route('/', toolCredentialRoutes) // /tool-credentials (authenticated)
app.route('/agents', executionLogsRoutes) // /agents/:id/executions (authenticated)
app.route('/agents', alertsRoutes) // /agents/:id/alerts (authenticated)
app.route('/agents', characterRoutes) // /agents/:id/character (authenticated)
app.route('/agents', memoriesRoutes) // /agents/:id/memories (authenticated)
app.route('/agents', agentExportRoutes) // /agents/:id/export, /agents/import (authenticated)
app.route('/compliance', complianceRoutes) // /compliance/check, /compliance/frameworks (public with rate limit)
app.route('/contact', contactRoutes) // /contact (public with rate limit)
app.route('/social-deliveries', socialDeliveriesRoutes) // /social-deliveries (authenticated)

// Root
app.get('/', (c) => {
  return c.json({
    name: 'GuardianClaw API',
    version: '3.0.0',
    status: 'operational',
    environment: c.env.ENVIRONMENT,
  })
})

// 404 handler
app.notFound((c) => {
  const requestId = getRequestId(c)
  const response: ApiErrorResponse = {
    error: 'Not Found',
    code: ErrorCode.NOT_FOUND,
    ...(requestId && { requestId }),
  }
  return c.json(response, 404 as ContentfulStatusCode)
})

// Error handler with sanitization (SECURITY_SPEC Section 8.6)
app.onError((err, c) => {
  const requestId = getRequestId(c)

  // Handle known API errors
  if (isApiError(err)) {
    return c.json(err.toJSON(), err.statusCode as ContentfulStatusCode)
  }

  // Convert unknown errors
  const apiError = toApiError(err, requestId)

  // Log unexpected errors with PII scrubbing (internal log only)
  console.error(
    JSON.stringify(
      scrubPII({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Unhandled error',
        requestId,
        error: {
          name: err.name,
          message: err.message,
          // Only log first 5 lines of stack, scrubbed
          stack: err.stack?.split('\n').slice(0, 5).join('\n'),
        },
      })
    )
  )

  // Return sanitized error to client (no stack traces, no PII)
  const safeResponse = createSafeErrorResponse(err, requestId)
  return c.json(safeResponse, apiError.statusCode as ContentfulStatusCode)
})

// Export both fetch and scheduled handlers for Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled,
}
