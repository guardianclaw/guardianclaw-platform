/**
 * Input Sanitization Utilities
 *
 * Security controls per SECURITY_SPEC Section 3.2.
 *
 * CURRENTLY IN USE:
 * - sanitizeError() - Used in global error handler (index.ts)
 * - createSafeErrorResponse() - Used in global error handler (index.ts)
 *
 * UTILITY FUNCTIONS (available for future use):
 * - escapeHtml() - XSS prevention for HTML outputs
 * - validateExternalUrl() - SSRF prevention for user-provided URLs
 * - validateJsonDepth() - DoS prevention (Cloudflare already limits)
 * - validateBodySize() - Size limits (Cloudflare already limits)
 */

import { scrubPII } from '../lib/secure-logger'

/**
 * HTML escape a string to prevent XSS.
 * Escapes: & < > " '
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') {
    return str
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Patterns that should be redacted from error messages.
 */
const ERROR_REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys
  { pattern: /sk-[a-zA-Z0-9-]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /sk_live_[a-f0-9]{64}/g, replacement: '[REDACTED_API_KEY]' },

  // JWT tokens
  {
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*/g,
    replacement: '[REDACTED_TOKEN]',
  },

  // IP addresses
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED_IP]' },
  { pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, replacement: '[REDACTED_IP]' },

  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },

  // File paths
  { pattern: /\/(?:home|Users|var|etc|tmp)\/[^\s\]"')]+/g, replacement: '[REDACTED_PATH]' },
  {
    pattern: /[A-Z]:\\(?:Users|Windows|Program Files)[^\s\]"')]+/gi,
    replacement: '[REDACTED_PATH]',
  },

  // Database connection strings
  { pattern: /postgres(?:ql)?:\/\/[^\s]+/gi, replacement: '[REDACTED_DB_URL]' },
  { pattern: /mysql:\/\/[^\s]+/gi, replacement: '[REDACTED_DB_URL]' },

  // Internal URLs
  {
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)[^\s]*/g,
    replacement: '[REDACTED_INTERNAL_URL]',
  },

  // Supabase/service keys
  { pattern: /supabase[a-zA-Z0-9_-]{30,}/gi, replacement: '[REDACTED_SERVICE_KEY]' },

  // Wallet addresses (keep first/last 4 chars)
  { pattern: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, replacement: '[WALLET]' },
]

/**
 * Sanitize an error message by removing potential PII and sensitive data.
 *
 * @param error - The error to sanitize
 * @returns Safe error object with message and optional code
 */
export function sanitizeError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    let message = error.message

    // Apply all redaction patterns
    for (const { pattern, replacement } of ERROR_REDACTION_PATTERNS) {
      message = message.replace(pattern, replacement)
    }

    // Truncate very long messages
    if (message.length > 500) {
      message = message.substring(0, 497) + '...'
    }

    return {
      message,
      code: error.name !== 'Error' ? error.name : undefined,
    }
  }

  // Unknown error types get generic message
  return { message: 'An unexpected error occurred' }
}

/**
 * Create a safe error response object.
 * Removes stack traces and sanitizes messages.
 */
export function createSafeErrorResponse(
  error: unknown,
  requestId?: string
): {
  error: string
  code: string
  requestId?: string
} {
  const sanitized = sanitizeError(error)

  return {
    error: sanitized.message,
    code: sanitized.code || 'INTERNAL_ERROR',
    ...(requestId && { requestId }),
  }
}

/**
 * Blocked IP ranges for SSRF prevention.
 */
const BLOCKED_IP_RANGES = [
  // Private networks
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // Loopback
  /^127\./,
  // Link-local
  /^169\.254\./,
  // Cloud metadata
  /^169\.254\.169\.254/,
]

/**
 * Blocked hostnames for SSRF prevention.
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
]

/**
 * Validate a URL is safe to fetch (SSRF prevention).
 *
 * @param url - The URL to validate
 * @returns Validation result with error message if invalid
 */
export function validateExternalUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url)

    // Must be HTTPS in production
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'Only HTTP(S) URLs are allowed' }
    }

    // Check hostname against blocklist
    const hostname = parsed.hostname.toLowerCase()
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, error: 'Internal hostnames are not allowed' }
    }

    // Check if hostname is an IP address
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4Match) {
      // Check against blocked IP ranges
      for (const range of BLOCKED_IP_RANGES) {
        if (range.test(hostname)) {
          return { valid: false, error: 'Internal IP addresses are not allowed' }
        }
      }
    }

    // Block our own infrastructure
    if (
      hostname.endsWith('.guardianclaw.org') ||
      hostname.endsWith('.guardianclaw-api.workers.dev')
    ) {
      return { valid: false, error: 'Cannot access GuardianClaw infrastructure' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Sanitize request data recursively.
 * Uses the PII scrubbing from secure-logger.
 */
export function sanitizeRequestData<T>(data: T): T {
  return scrubPII(data)
}

/**
 * Validate JSON depth to prevent DoS via deeply nested objects.
 *
 * @param data - The data to check
 * @param maxDepth - Maximum allowed nesting depth (default: 10)
 * @returns True if depth is acceptable
 */
export function validateJsonDepth(data: unknown, maxDepth: number = 10): boolean {
  function checkDepth(obj: unknown, currentDepth: number): boolean {
    if (currentDepth > maxDepth) {
      return false
    }

    if (obj === null || typeof obj !== 'object') {
      return true
    }

    if (Array.isArray(obj)) {
      return obj.every((item) => checkDepth(item, currentDepth + 1))
    }

    return Object.values(obj).every((value) => checkDepth(value, currentDepth + 1))
  }

  return checkDepth(data, 0)
}

/**
 * Validate request body size.
 *
 * @param body - Request body as string
 * @param maxSizeBytes - Maximum size in bytes (default: 1MB)
 * @returns True if size is acceptable
 */
export function validateBodySize(body: string, maxSizeBytes: number = 1024 * 1024): boolean {
  return new TextEncoder().encode(body).length <= maxSizeBytes
}
