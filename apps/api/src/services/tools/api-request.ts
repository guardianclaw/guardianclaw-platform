/**
 * API Request Tool Service
 *
 * Provides HTTP request functionality for agent flows.
 * Allows agents to interact with external REST APIs.
 *
 * Features:
 * - HTTP methods: GET, POST, PUT, PATCH, DELETE
 * - Authentication: API Key, Bearer Token, Basic Auth
 * - Template variable resolution in URL and body
 * - URL validation (blocks private IPs, localhost)
 * - Response size limits and timeout handling
 * - JSON response parsing
 * - Automatic retry with exponential backoff
 * - Rate limiting per host and credential
 * - Audit logging for all requests
 *
 * Security considerations:
 * - Private IP ranges are blocked to prevent SSRF attacks
 * - Localhost and internal hostnames are blocked
 * - Manual redirect following with SSRF protection on each hop
 * - Response size is limited to prevent memory exhaustion
 * - Configurable timeout to prevent hanging requests
 * - Security events logged for blocked requests
 *
 * @example
 * const result = await executeApiRequest({
 *   method: 'POST',
 *   url: 'https://api.example.com/data',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ query: '{{current_input}}' }),
 *   auth: { type: 'bearer', token: 'xxx' },
 *   timeout: 10000,
 * })
 */

import {
  generateRequestId,
  logApiRequest,
  logApiSecurityEvent,
  bufferAuditEntry,
  createRequestLogEntry,
} from './api-request-logger'
import { resolveAndValidateUrl } from './dns-resolver'

// ============================================
// TYPES
// ============================================

/**
 * Supported HTTP methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Authentication types.
 */
export type AuthType = 'none' | 'api_key' | 'bearer' | 'basic'

/**
 * API Key placement options.
 */
export type ApiKeyPlacement = 'header' | 'query'

/**
 * Authentication configuration.
 */
export interface AuthConfig {
  type: AuthType
  // For api_key
  apiKey?: string
  apiKeyName?: string // Header name or query param name
  apiKeyPlacement?: ApiKeyPlacement
  // For bearer
  token?: string
  // For basic
  username?: string
  password?: string
}

/**
 * API request configuration.
 */
export interface ApiRequestConfig {
  method: HttpMethod
  url: string
  headers?: Record<string, string>
  body?: string
  auth?: AuthConfig
  timeout?: number
  // Response handling
  extractJsonPath?: string // Simple dot notation path like "data.items"
  // Rate limiting (optional, for tracking)
  credentialId?: string // Used for per-credential rate limiting
  // Retry configuration
  enableRetry?: boolean // Enable retry for 5xx errors (default: true)
  maxRetries?: number // Override default max retries
  // Logging/audit
  executionId?: string // Flow execution ID for correlation
  requestId?: string // Pre-generated request ID (optional)
  enableLogging?: boolean // Enable request logging (default: true)
  // Security
  skipDnsValidation?: boolean // Skip DNS rebinding check (for testing only)
}

/**
 * API request execution result.
 */
export interface ApiRequestResponse {
  success: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: unknown
  bodyText?: string // Raw response text (truncated if too large)
  latencyMs: number
  error?: string
  errorCode?: string
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 60_000
const MAX_RESPONSE_SIZE = 1_000_000 // 1MB max response
const MAX_BODY_SIZE = 100_000 // 100KB max request body
const MAX_REDIRECTS = 5 // Maximum redirects to follow

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute window
const MAX_REQUESTS_PER_HOST = 100 // Max requests per host per minute
const MAX_REQUESTS_PER_CREDENTIAL = 1000 // Max requests per credential per minute

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000 // 1 second
const RETRY_BACKOFF_MULTIPLIER = 2 // Exponential backoff: 1s, 2s, 4s

// In-memory rate limiting (resets on worker restart)
// For production, use KV-based rate limiting
const hostRateLimits = new Map<string, { count: number; windowStart: number }>()
const credentialRateLimits = new Map<string, { count: number; windowStart: number }>()

// Private IP ranges to block (SSRF prevention)
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^224\./, // Multicast
  /^240\./, // Reserved
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 private
  /^fe80:/i, // IPv6 link-local
]

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '[::]',
  '[::1]',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254', // AWS/Azure metadata
  'metadata.google.com',
]

// ============================================
// RATE LIMITING
// ============================================

/**
 * Check and update rate limit for a given key.
 * Returns true if request is allowed, false if rate limited.
 */
function checkRateLimit(
  limitsMap: Map<string, { count: number; windowStart: number }>,
  key: string,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = limitsMap.get(key)

  // If no entry or window expired, create new window
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    limitsMap.set(key, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    }
  }

  // Check if limit exceeded
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
    }
  }

  // Increment counter
  entry.count++
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
  }
}

/**
 * Check rate limits for host and credential.
 * Returns error response if rate limited, null if allowed.
 */
function checkAllRateLimits(
  host: string,
  credentialId?: string
): { error: string; errorCode: string } | null {
  // Check host rate limit
  const hostLimit = checkRateLimit(hostRateLimits, host, MAX_REQUESTS_PER_HOST)
  if (!hostLimit.allowed) {
    return {
      error: `Rate limit exceeded for host ${host}. Try again in ${Math.ceil((hostLimit.resetAt - Date.now()) / 1000)}s`,
      errorCode: 'RATE_LIMIT_HOST',
    }
  }

  // Check credential rate limit if provided
  if (credentialId) {
    const credLimit = checkRateLimit(
      credentialRateLimits,
      credentialId,
      MAX_REQUESTS_PER_CREDENTIAL
    )
    if (!credLimit.allowed) {
      return {
        error: `Rate limit exceeded for credential. Try again in ${Math.ceil((credLimit.resetAt - Date.now()) / 1000)}s`,
        errorCode: 'RATE_LIMIT_CREDENTIAL',
      }
    }
  }

  return null
}

// ============================================
// URL VALIDATION
// ============================================

/**
 * Validate URL for security.
 * Blocks private IPs, localhost, and potentially dangerous URLs.
 *
 * @param urlString - URL to validate
 * @returns Validation result with error message if invalid
 */
export function validateUrl(urlString: string): { valid: boolean; error?: string } {
  // Check empty
  if (!urlString || urlString.trim().length === 0) {
    return { valid: false, error: 'URL cannot be empty' }
  }

  // Parse URL
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Only allow HTTP and HTTPS
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: `Protocol not allowed: ${url.protocol}` }
  }

  // Check hostname against blocklist
  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Hostname not allowed' }
  }

  // Check for private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private IP addresses not allowed' }
    }
  }

  // Block numeric IPs that might resolve to private ranges
  // Allow only if it looks like a domain name (contains at least one letter)
  const isNumericIp = /^[\d.:[\]]+$/.test(hostname)
  if (isNumericIp && !hostname.includes('.') && hostname !== '::1') {
    return { valid: false, error: 'Invalid IP address format' }
  }

  // Check for suspicious patterns
  if (hostname.includes('internal') || hostname.includes('intranet')) {
    return { valid: false, error: 'Internal hostnames not allowed' }
  }

  return { valid: true }
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Apply authentication to request headers.
 *
 * @param headers - Existing headers
 * @param auth - Authentication configuration
 * @param url - URL object (for query param auth)
 * @returns Modified headers and URL
 */
export function applyAuthentication(
  headers: Record<string, string>,
  auth: AuthConfig | undefined,
  url: URL
): { headers: Record<string, string>; url: URL } {
  if (!auth || auth.type === 'none') {
    return { headers, url }
  }

  const newHeaders = { ...headers }
  const newUrl = new URL(url.toString())

  switch (auth.type) {
    case 'api_key':
      if (auth.apiKey) {
        const keyName = auth.apiKeyName || 'X-API-Key'
        if (auth.apiKeyPlacement === 'query') {
          newUrl.searchParams.set(keyName, auth.apiKey)
        } else {
          // Default to header
          newHeaders[keyName] = auth.apiKey
        }
      }
      break

    case 'bearer':
      if (auth.token) {
        newHeaders['Authorization'] = `Bearer ${auth.token}`
      }
      break

    case 'basic':
      if (auth.username && auth.password) {
        const credentials = btoa(`${auth.username}:${auth.password}`)
        newHeaders['Authorization'] = `Basic ${credentials}`
      }
      break
  }

  return { headers: newHeaders, url: newUrl }
}

// ============================================
// RESPONSE HANDLING
// ============================================

/**
 * Extract value from object using dot notation path.
 *
 * @param obj - Source object
 * @param path - Dot notation path (e.g., "data.items.0.name")
 * @returns Extracted value or undefined
 */
export function extractJsonPath(obj: unknown, path: string): unknown {
  if (!path) {
    return obj
  }

  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return undefined
  }

  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (typeof current !== 'object') {
      return undefined
    }

    // Handle array index
    const arrayIndex = parseInt(part, 10)
    if (!isNaN(arrayIndex) && Array.isArray(current)) {
      current = current[arrayIndex]
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }

  return current
}

/**
 * Format response for LLM context.
 * Creates a human-readable summary of the API response.
 *
 * @param response - API response
 * @param config - Request configuration
 * @returns Formatted text
 */
export function formatResponseForContext(
  response: ApiRequestResponse,
  _config: ApiRequestConfig
): string {
  if (!response.success) {
    return `API request failed: ${response.error || 'Unknown error'}`
  }

  const parts: string[] = []

  // Status line
  parts.push(`API Response: ${response.status} ${response.statusText}`)

  // Response body
  if (response.body !== undefined) {
    if (typeof response.body === 'object') {
      const jsonStr = JSON.stringify(response.body, null, 2)
      // Limit output size for LLM context
      if (jsonStr.length > 5000) {
        parts.push(`Response (truncated):\n${jsonStr.slice(0, 5000)}...`)
      } else {
        parts.push(`Response:\n${jsonStr}`)
      }
    } else {
      parts.push(`Response: ${String(response.body).slice(0, 5000)}`)
    }
  } else if (response.bodyText) {
    parts.push(`Response: ${response.bodyText.slice(0, 5000)}`)
  }

  // Latency info
  parts.push(`(${response.latencyMs}ms)`)

  return parts.join('\n')
}

// ============================================
// RETRY LOGIC
// ============================================

/**
 * Determine if an error is retryable.
 * Retryable: 5xx errors, timeouts, network errors
 * Not retryable: 4xx errors, validation errors, rate limits
 */
function isRetryableError(errorCode: string | undefined, status?: number): boolean {
  // Retryable error codes
  const retryableErrorCodes = ['TIMEOUT', 'NETWORK_ERROR', 'DNS_ERROR', 'CONNECTION_REFUSED']
  if (errorCode && retryableErrorCodes.includes(errorCode)) {
    return true
  }

  // Retryable HTTP status codes (5xx server errors)
  if (status && status >= 500 && status < 600) {
    return true
  }

  return false
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate retry delay with exponential backoff.
 */
function getRetryDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt)
}

// ============================================
// MAIN EXECUTION
// ============================================

/**
 * Execute an API request with SSRF protection and retry support.
 *
 * Security features:
 * - URL validation before request
 * - Manual redirect following with validation
 * - Redirect count limit
 * - Response size limit
 * - Rate limiting per host and credential
 *
 * Reliability features:
 * - Automatic retry for 5xx errors and network failures
 * - Exponential backoff between retries
 *
 * Audit features:
 * - Request/response logging with correlation IDs
 * - Security event logging for blocked requests
 * - Audit buffer for database persistence
 *
 * @param config - Request configuration
 * @returns Request result
 */
export async function executeApiRequest(config: ApiRequestConfig): Promise<ApiRequestResponse> {
  const enableRetry = config.enableRetry !== false // Default: true
  const enableLogging = config.enableLogging !== false // Default: true
  const maxRetries = config.maxRetries ?? MAX_RETRIES
  const requestId = config.requestId || generateRequestId()

  // If retry disabled, execute once
  if (!enableRetry || maxRetries === 0) {
    const result = await executeApiRequestOnce(config, requestId)

    // Log the request
    if (enableLogging) {
      logApiRequest(requestId, config, result, { executionId: config.executionId })
      bufferAuditEntry(
        createRequestLogEntry(requestId, config, result, { executionId: config.executionId })
      )
    }

    return result
  }

  // Execute with retry
  let lastResult: ApiRequestResponse | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Execute request
    const result = await executeApiRequestOnce(config, requestId)

    // Log each attempt
    if (enableLogging) {
      logApiRequest(requestId, config, result, {
        executionId: config.executionId,
        retryAttempt: attempt > 0 ? attempt : undefined,
      })
    }

    // If successful or not retryable, return immediately
    if (result.success || !isRetryableError(result.errorCode, result.status)) {
      // Buffer final result for audit
      if (enableLogging) {
        bufferAuditEntry(
          createRequestLogEntry(requestId, config, result, {
            executionId: config.executionId,
            retryAttempt: attempt > 0 ? attempt : undefined,
          })
        )
      }
      return result
    }

    // Store last result for potential return
    lastResult = result

    // If we have more retries left, wait and retry
    if (attempt < maxRetries) {
      const delay = getRetryDelay(attempt)
      await sleep(delay)
    }
  }

  // Buffer final failed result
  if (enableLogging && lastResult) {
    bufferAuditEntry(
      createRequestLogEntry(requestId, config, lastResult, {
        executionId: config.executionId,
        retryAttempt: maxRetries,
      })
    )
  }

  // Return last result (all retries exhausted)
  return lastResult!
}

/**
 * Execute a single API request attempt (no retry).
 */
async function executeApiRequestOnce(
  config: ApiRequestConfig,
  requestId: string
): Promise<ApiRequestResponse> {
  const startTime = Date.now()
  const enableLogging = config.enableLogging !== false

  // Validate initial URL
  const urlValidation = validateUrl(config.url)
  if (!urlValidation.valid) {
    // Log security event for invalid/blocked URL
    if (enableLogging) {
      logApiSecurityEvent('api_invalid_url', requestId, config, {
        reason: urlValidation.error,
      })
    }
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: urlValidation.error,
      errorCode: 'INVALID_URL',
    }
  }

  // DNS rebinding protection: resolve and validate IP before connecting
  // Skip for tests (config.skipDnsValidation) to avoid external calls
  if (config.skipDnsValidation !== true) {
    const dnsResult = await resolveAndValidateUrl(config.url)
    if (!dnsResult.safe) {
      // Log DNS rebinding security event
      if (enableLogging) {
        logApiSecurityEvent('api_dns_rebinding_blocked', requestId, config, {
          reason: dnsResult.error,
          resolvedIp: dnsResult.ip,
          errorCode: dnsResult.errorCode,
        })
      }
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: dnsResult.error || 'DNS resolution blocked',
        errorCode: dnsResult.errorCode || 'DNS_REBINDING_BLOCKED',
      }
    }
  }

  // Check rate limits
  let host: string
  try {
    host = new URL(config.url).hostname
  } catch {
    host = 'unknown'
  }

  const rateLimitError = checkAllRateLimits(host, config.credentialId)
  if (rateLimitError) {
    // Log rate limit security event
    if (enableLogging) {
      const eventType =
        rateLimitError.errorCode === 'RATE_LIMIT_HOST'
          ? 'api_rate_limit_host'
          : 'api_rate_limit_credential'
      logApiSecurityEvent(
        eventType as 'api_rate_limit_host' | 'api_rate_limit_credential',
        requestId,
        config,
        {
          host,
        }
      )
    }
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: rateLimitError.error,
      errorCode: rateLimitError.errorCode,
    }
  }

  // Validate method
  const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  const method = config.method?.toUpperCase() as HttpMethod
  if (!validMethods.includes(method)) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: `Invalid HTTP method: ${config.method}`,
      errorCode: 'INVALID_METHOD',
    }
  }

  // Validate body size
  if (config.body && config.body.length > MAX_BODY_SIZE) {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: `Request body too large (max ${MAX_BODY_SIZE} bytes)`,
      errorCode: 'BODY_TOO_LARGE',
    }
  }

  // Parse URL and apply auth
  let url: URL
  try {
    url = new URL(config.url)
  } catch {
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: 'Failed to parse URL',
      errorCode: 'URL_PARSE_ERROR',
    }
  }

  // Prepare headers
  let headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'GuardianClaw-Agent/1.0',
    ...config.headers,
  }

  // Apply authentication
  const authResult = applyAuthentication(headers, config.auth, url)
  headers = authResult.headers
  url = authResult.url

  // Set Content-Type for request body if needed
  if (config.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      try {
        JSON.parse(config.body)
        headers['Content-Type'] = 'application/json'
      } catch {
        // Not JSON, leave Content-Type unset
      }
    }
  }

  // Prepare timeout
  const timeout = Math.min(config.timeout || DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // Execute request with manual redirect handling (SSRF protection)
    const result = await executeWithRedirectProtection(
      url.toString(),
      method,
      headers,
      config.body,
      controller.signal,
      0 // Initial redirect count
    )

    clearTimeout(timeoutId)

    // Handle redirect limit exceeded or blocked redirect
    if ('redirectError' in result) {
      // Log security event for redirect blocks
      if (enableLogging) {
        if (result.errorCode === 'REDIRECT_BLOCKED') {
          logApiSecurityEvent('api_redirect_blocked', requestId, config, {
            reason: result.redirectError,
          })
        } else if (result.errorCode === 'TOO_MANY_REDIRECTS') {
          logApiSecurityEvent('api_ssrf_blocked', requestId, config, {
            reason: result.redirectError,
          })
        }
      }
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: result.redirectError,
        errorCode: result.errorCode,
      }
    }

    const response = result.response

    // Get response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    // Read response body with size limit
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      // Log response size security event
      if (enableLogging) {
        logApiSecurityEvent('api_response_too_large', requestId, config, {
          contentLength: parseInt(contentLength, 10),
          maxSize: MAX_RESPONSE_SIZE,
        })
      }
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        latencyMs: Date.now() - startTime,
        error: `Response too large (${contentLength} bytes, max ${MAX_RESPONSE_SIZE})`,
        errorCode: 'RESPONSE_TOO_LARGE',
      }
    }

    // Read response text
    const bodyText = await response.text()

    // Check actual size
    if (bodyText.length > MAX_RESPONSE_SIZE) {
      // Log response size security event
      if (enableLogging) {
        logApiSecurityEvent('api_response_too_large', requestId, config, {
          actualSize: bodyText.length,
          maxSize: MAX_RESPONSE_SIZE,
        })
      }
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        bodyText: bodyText.slice(0, 1000) + '... (truncated)',
        latencyMs: Date.now() - startTime,
        error: `Response too large (${bodyText.length} bytes, max ${MAX_RESPONSE_SIZE})`,
        errorCode: 'RESPONSE_TOO_LARGE',
      }
    }

    // Try to parse as JSON
    let body: unknown = bodyText
    const contentType = response.headers.get('content-type') || ''
    if (
      contentType.includes('application/json') ||
      bodyText.startsWith('{') ||
      bodyText.startsWith('[')
    ) {
      try {
        body = JSON.parse(bodyText)
      } catch {
        // Keep as text
      }
    }

    // Extract specific path if configured
    if (config.extractJsonPath && typeof body === 'object') {
      body = extractJsonPath(body, config.extractJsonPath)
    }

    // Determine success based on status code
    const isSuccess = response.status >= 200 && response.status < 300

    return {
      success: isSuccess,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body,
      bodyText: typeof body === 'string' ? body : undefined,
      latencyMs: Date.now() - startTime,
      error: isSuccess ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      errorCode: isSuccess ? undefined : `HTTP_${response.status}`,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          latencyMs,
          error: `Request timed out after ${timeout}ms`,
          errorCode: 'TIMEOUT',
        }
      }

      // Network errors
      if (error.message.includes('fetch failed') || error.message.includes('network')) {
        return {
          success: false,
          latencyMs,
          error: 'Network error: Unable to reach the server',
          errorCode: 'NETWORK_ERROR',
        }
      }

      // DNS errors
      if (error.message.includes('getaddrinfo') || error.message.includes('ENOTFOUND')) {
        return {
          success: false,
          latencyMs,
          error: 'DNS error: Unable to resolve hostname',
          errorCode: 'DNS_ERROR',
        }
      }

      // Connection refused
      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          latencyMs,
          error: 'Connection refused by the server',
          errorCode: 'CONNECTION_REFUSED',
        }
      }

      return {
        success: false,
        latencyMs,
        error: error.message,
        errorCode: 'REQUEST_ERROR',
      }
    }

    return {
      success: false,
      latencyMs,
      error: 'Unknown error occurred',
      errorCode: 'UNKNOWN_ERROR',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Execute request with manual redirect handling for SSRF protection.
 * Validates each redirect URL before following.
 */
async function executeWithRedirectProtection(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal,
  redirectCount: number
): Promise<{ response: Response } | { redirectError: string; errorCode: string }> {
  // Check redirect limit
  if (redirectCount > MAX_REDIRECTS) {
    return {
      redirectError: `Too many redirects (max ${MAX_REDIRECTS})`,
      errorCode: 'TOO_MANY_REDIRECTS',
    }
  }

  // Prepare request options - manual redirect handling
  const requestInit: RequestInit = {
    method,
    headers,
    signal,
    redirect: 'manual', // Don't follow redirects automatically
  }

  // Add body for methods that support it
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    requestInit.body = body
  }

  // Execute request
  const response = await fetch(url, requestInit)

  // Check if this is a redirect
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')

    if (!location) {
      // Redirect without location header - treat as error
      return {
        redirectError: `Redirect response (${response.status}) without Location header`,
        errorCode: 'INVALID_REDIRECT',
      }
    }

    // Resolve redirect URL (handle relative URLs)
    let redirectUrl: string
    try {
      redirectUrl = new URL(location, url).toString()
    } catch {
      return {
        redirectError: `Invalid redirect URL: ${location}`,
        errorCode: 'INVALID_REDIRECT_URL',
      }
    }

    // Validate redirect URL (SSRF protection)
    const redirectValidation = validateUrl(redirectUrl)
    if (!redirectValidation.valid) {
      return {
        redirectError: `Redirect blocked: ${redirectValidation.error}`,
        errorCode: 'REDIRECT_BLOCKED',
      }
    }

    // Follow redirect (POST becomes GET on 301/302/303)
    const newMethod =
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === 'POST')
        ? 'GET'
        : method

    // Don't send body on GET requests
    const newBody = newMethod === 'GET' ? undefined : body

    // Recursively follow the redirect
    return executeWithRedirectProtection(
      redirectUrl,
      newMethod,
      headers,
      newBody,
      signal,
      redirectCount + 1
    )
  }

  // Not a redirect - return the response
  return { response }
}

// ============================================
// TEMPLATE RESOLUTION
// ============================================

/**
 * Context for template variable resolution.
 */
export interface TemplateContext {
  currentInput: string
  initialInput: string
  items?: unknown[]
  variables?: Record<string, unknown>
}

/**
 * Resolve template variables in a string (no encoding).
 * Use this for request bodies, headers, and other non-URL contexts.
 *
 * Supports: {{current_input}}, {{initial_input}}, {{items}}, {{var_name}}
 *
 * @param template - Template string
 * @param context - Execution context
 * @returns Resolved string
 */
export function resolveTemplateInString(template: string, context: TemplateContext): string {
  if (!template) return template

  return template
    .replace(/\{\{current_input\}\}/g, context.currentInput)
    .replace(/\{\{initial_input\}\}/g, context.initialInput)
    .replace(/\{\{items\}\}/g, JSON.stringify(context.items || []))
    .replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (context.variables && varName in context.variables) {
        const value = context.variables[varName]
        return typeof value === 'string' ? value : JSON.stringify(value)
      }
      return match
    })
}

/**
 * Resolve template variables in a URL with proper encoding.
 * Applies encodeURIComponent to all template values.
 *
 * This ensures that special characters in user input (spaces, &, =, etc.)
 * don't break the URL structure.
 *
 * @param urlTemplate - URL template string
 * @param context - Execution context
 * @returns Resolved and properly encoded URL
 */
export function resolveTemplateInUrl(urlTemplate: string, context: TemplateContext): string {
  if (!urlTemplate) return urlTemplate

  /**
   * Helper to encode a value for URL usage.
   * encodeURIComponent encodes everything except: A-Z a-z 0-9 - _ . ! ~ * ' ( )
   */
  const encodeValue = (value: unknown): string => {
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    return encodeURIComponent(str)
  }

  return urlTemplate
    .replace(/\{\{current_input\}\}/g, encodeValue(context.currentInput))
    .replace(/\{\{initial_input\}\}/g, encodeValue(context.initialInput))
    .replace(/\{\{items\}\}/g, encodeValue(context.items || []))
    .replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (context.variables && varName in context.variables) {
        return encodeValue(context.variables[varName])
      }
      return match // Keep original if variable not found
    })
}

/**
 * Check if a URL template contains template variables.
 */
export function hasTemplateVariables(template: string): boolean {
  return /\{\{[^}]+\}\}/.test(template)
}

/**
 * Resolve templates in API request configuration.
 *
 * URL templates are resolved with URL encoding to prevent injection.
 * Body and headers are resolved without encoding.
 *
 * @param config - Raw configuration
 * @param context - Execution context
 * @returns Configuration with resolved templates
 */
export function resolveApiRequestConfig(
  config: ApiRequestConfig,
  context: TemplateContext
): ApiRequestConfig {
  return {
    ...config,
    // URL: use URL-safe encoding for template values
    url: resolveTemplateInUrl(config.url, context),
    // Body: no encoding (JSON bodies should preserve structure)
    body: config.body ? resolveTemplateInString(config.body, context) : undefined,
    // Headers: no encoding (header values have their own rules)
    headers: config.headers
      ? Object.fromEntries(
          Object.entries(config.headers).map(([key, value]) => [
            key,
            resolveTemplateInString(value, context),
          ])
        )
      : undefined,
  }
}
