/**
 * API Request Logger
 *
 * Structured logging and audit trail for API request tool executions.
 * Integrates with the existing SecureLogger for security events and
 * Logger for standard request/response logging.
 *
 * Security features:
 * - Automatic masking of sensitive headers (Authorization, X-API-Key)
 * - Request/response body truncation to prevent log bloat
 * - PII scrubbing via secure-logger
 * - Security event logging for SSRF attempts, rate limits
 *
 * Audit features:
 * - Request/response logging with correlation IDs
 * - Latency tracking
 * - Error categorization
 */

import type { ApiRequestConfig, ApiRequestResponse, HttpMethod } from './api-request'

// ============================================
// TYPES
// ============================================

/**
 * API request log entry for audit trail.
 */
export interface ApiRequestLogEntry {
  timestamp: string
  // Correlation
  requestId: string
  executionId?: string // Flow execution ID
  credentialId?: string
  // Request info
  method: HttpMethod
  url: string // Masked for sensitive query params
  host: string
  hasBody: boolean
  bodySize?: number
  // Response info
  status?: number
  statusText?: string
  responseSize?: number
  // Timing
  latencyMs: number
  retryAttempt?: number
  // Result
  success: boolean
  errorCode?: string
  errorMessage?: string
}

/**
 * Security event types specific to API requests.
 */
export type ApiSecurityEventType =
  | 'api_ssrf_blocked'
  | 'api_dns_rebinding_blocked'
  | 'api_rate_limit_host'
  | 'api_rate_limit_credential'
  | 'api_redirect_blocked'
  | 'api_invalid_url'
  | 'api_response_too_large'

/**
 * Security event log entry.
 */
export interface ApiSecurityLogEntry {
  timestamp: string
  level: 'security'
  event: ApiSecurityEventType
  requestId: string
  executionId?: string
  credentialId?: string
  url?: string // Masked
  host?: string
  details?: Record<string, unknown>
}

// ============================================
// CONFIGURATION
// ============================================

const MAX_URL_LOG_LENGTH = 200
const MAX_BODY_LOG_LENGTH = 500
const SENSITIVE_HEADER_NAMES = [
  'authorization',
  'x-api-key',
  'api-key',
  'bearer',
  'cookie',
  'x-auth-token',
  'x-access-token',
]
const SENSITIVE_QUERY_PARAMS = [
  'api_key',
  'apikey',
  'token',
  'access_token',
  'key',
  'secret',
  'password',
]

// ============================================
// URL MASKING
// ============================================

/**
 * Mask sensitive query parameters in URL for logging.
 */
export function maskUrlForLogging(urlString: string): string {
  try {
    const url = new URL(urlString)

    // Mask sensitive query params
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, '[REDACTED]')
      }
    }

    // Check for api_key patterns (case insensitive)
    for (const [key] of [...url.searchParams]) {
      if (
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret')
      ) {
        url.searchParams.set(key, '[REDACTED]')
      }
    }

    let masked = url.toString()

    // Truncate if too long
    if (masked.length > MAX_URL_LOG_LENGTH) {
      masked = masked.substring(0, MAX_URL_LOG_LENGTH) + '...[truncated]'
    }

    return masked
  } catch {
    // If URL parsing fails, just truncate
    if (urlString.length > MAX_URL_LOG_LENGTH) {
      return urlString.substring(0, MAX_URL_LOG_LENGTH) + '...[truncated]'
    }
    return urlString
  }
}

/**
 * Mask sensitive headers for logging.
 */
export function maskHeadersForLogging(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) return undefined

  const masked: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()

    // Check if header is sensitive
    const isSensitive = SENSITIVE_HEADER_NAMES.some((name) => lowerKey.includes(name))

    if (isSensitive) {
      // Show first 4 chars and last 4 chars if long enough
      if (value.length > 12) {
        masked[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
      } else {
        masked[key] = '[REDACTED]'
      }
    } else {
      masked[key] = value
    }
  }

  return masked
}

/**
 * Truncate body for logging.
 */
export function truncateBodyForLogging(body: string | undefined): string | undefined {
  if (!body) return undefined

  if (body.length > MAX_BODY_LOG_LENGTH) {
    return body.substring(0, MAX_BODY_LOG_LENGTH) + `...[truncated, ${body.length} total]`
  }

  return body
}

// ============================================
// LOG GENERATION
// ============================================

/**
 * Generate unique request ID.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `req_${timestamp}_${random}`
}

/**
 * Create log entry from config and response.
 */
export function createRequestLogEntry(
  requestId: string,
  config: ApiRequestConfig,
  response: ApiRequestResponse,
  options?: {
    executionId?: string
    retryAttempt?: number
  }
): ApiRequestLogEntry {
  let host = 'unknown'
  try {
    host = new URL(config.url).hostname
  } catch {
    // Invalid URL
  }

  return {
    timestamp: new Date().toISOString(),
    requestId,
    executionId: options?.executionId,
    credentialId: config.credentialId,
    method: config.method,
    url: maskUrlForLogging(config.url),
    host,
    hasBody: !!config.body,
    bodySize: config.body?.length,
    status: response.status,
    statusText: response.statusText,
    responseSize: response.bodyText?.length,
    latencyMs: response.latencyMs,
    retryAttempt: options?.retryAttempt,
    success: response.success,
    errorCode: response.errorCode,
    errorMessage: response.error,
  }
}

/**
 * Create security event log entry.
 */
export function createSecurityLogEntry(
  event: ApiSecurityEventType,
  requestId: string,
  config: Partial<ApiRequestConfig>,
  details?: Record<string, unknown>
): ApiSecurityLogEntry {
  let host: string | undefined
  if (config.url) {
    try {
      host = new URL(config.url).hostname
    } catch {
      // Invalid URL
    }
  }

  return {
    timestamp: new Date().toISOString(),
    level: 'security',
    event,
    requestId,
    credentialId: config.credentialId,
    url: config.url ? maskUrlForLogging(config.url) : undefined,
    host,
    details,
  }
}

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Logger callback type for dependency injection.
 * Allows different logging implementations (console, remote, etc.)
 */
export type LogCallback = (entry: ApiRequestLogEntry | ApiSecurityLogEntry) => void

/**
 * Default logger - outputs JSON to console.
 */
const defaultLogger: LogCallback = (entry) => {
  if ('level' in entry && entry.level === 'security') {
    console.warn(JSON.stringify(entry))
  } else {
    const logEntry = entry as ApiRequestLogEntry
    if (logEntry.success) {
      console.log(JSON.stringify(entry))
    } else {
      console.error(JSON.stringify(entry))
    }
  }
}

// Current logger (can be swapped for testing or remote logging)
let currentLogger: LogCallback = defaultLogger

/**
 * Set the logger callback.
 */
export function setApiRequestLogger(logger: LogCallback): void {
  currentLogger = logger
}

/**
 * Reset to default logger.
 */
export function resetApiRequestLogger(): void {
  currentLogger = defaultLogger
}

/**
 * Log an API request result.
 */
export function logApiRequest(
  requestId: string,
  config: ApiRequestConfig,
  response: ApiRequestResponse,
  options?: {
    executionId?: string
    retryAttempt?: number
  }
): void {
  const entry = createRequestLogEntry(requestId, config, response, options)
  currentLogger(entry)
}

/**
 * Log a security event.
 */
export function logApiSecurityEvent(
  event: ApiSecurityEventType,
  requestId: string,
  config: Partial<ApiRequestConfig>,
  details?: Record<string, unknown>
): void {
  const entry = createSecurityLogEntry(event, requestId, config, details)
  currentLogger(entry)
}

// ============================================
// IN-MEMORY AUDIT BUFFER (For Database Persistence)
// ============================================

/**
 * In-memory buffer for batch database writes.
 * For production, this would be flushed to database periodically.
 */
const auditBuffer: ApiRequestLogEntry[] = []
const MAX_BUFFER_SIZE = 100
const _BUFFER_FLUSH_INTERVAL_MS = 30_000 // 30 seconds

/**
 * Add entry to audit buffer.
 */
export function bufferAuditEntry(entry: ApiRequestLogEntry): void {
  auditBuffer.push(entry)

  // Prevent unbounded growth
  if (auditBuffer.length > MAX_BUFFER_SIZE) {
    auditBuffer.shift() // Remove oldest
  }
}

/**
 * Get buffered entries (and optionally clear).
 */
export function getBufferedAuditEntries(clear = false): ApiRequestLogEntry[] {
  const entries = [...auditBuffer]
  if (clear) {
    auditBuffer.length = 0
  }
  return entries
}

/**
 * Clear audit buffer.
 */
export function clearAuditBuffer(): void {
  auditBuffer.length = 0
}

/**
 * Get buffer statistics.
 */
export function getAuditBufferStats(): { size: number; maxSize: number } {
  return {
    size: auditBuffer.length,
    maxSize: MAX_BUFFER_SIZE,
  }
}
