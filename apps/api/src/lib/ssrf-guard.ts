/**
 * SSRF guard helpers.
 *
 * Thin wrappers around `validateExternalUrl` so each route/service that turns
 * a user-controlled URL into an outbound fetch logs blocks consistently.
 *
 * Logging contract: only the hostname is logged, never the full URL. The path
 * and query may contain secrets (tokens, credentials).
 *
 * Audit ref: 2026-04-23 finding F-02 / P0.2.
 */

import {
  validateExternalUrl,
  type ValidateExternalUrlOptions,
} from '../middleware/sanitize'
import type { SecureLogger } from './secure-logger'

export interface SsrfGuardContext {
  /** Short identifier of the call site, e.g. 'webhook-endpoints.create' */
  surface: string
  /** Optional request id for log correlation */
  requestId?: string
}

/**
 * Strip path/query/credentials from a URL, return hostname only.
 * Returns '<unparseable>' for bad input so logging never throws.
 */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return '<unparseable>'
  }
}

/**
 * Log a structured `ssrf_blocked` event without leaking the URL path/query.
 */
export async function logSsrfBlock(
  logger: SecureLogger,
  url: string,
  context: SsrfGuardContext,
  reason: string
): Promise<void> {
  await logger.security(
    'ssrf_blocked',
    { surface: context.surface, reason, hostname: safeHostname(url) },
    undefined,
    undefined,
    context.requestId
  )
}

/**
 * Validate a URL and, when blocked, fire a structured security log entry.
 *
 * Returns the validator's verdict so callers can branch on it.
 */
export async function checkUrlOrLog(
  url: string,
  context: SsrfGuardContext,
  logger: SecureLogger,
  options?: ValidateExternalUrlOptions
): Promise<{ valid: boolean; error?: string }> {
  const result = validateExternalUrl(url, options)
  if (!result.valid) {
    await logSsrfBlock(logger, url, context, result.error || 'unknown')
  }
  return result
}
