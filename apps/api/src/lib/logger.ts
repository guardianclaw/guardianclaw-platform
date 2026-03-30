/**
 * Structured JSON Logger for Cloudflare Workers.
 *
 * Provides consistent logging format with context, levels, and serialization.
 * Designed for Cloudflare Workers environment (uses console for output).
 *
 * Security: Uses scrubPII from secure-logger for pattern-based PII detection.
 * Reference: SECURITY_SPEC.md Section 9.2
 */

import { scrubPII } from './secure-logger'

/**
 * Log levels with numeric priority.
 */
export enum LogLevel {
  DEBUG = 10,
  INFO = 20,
  WARN = 30,
  ERROR = 40,
}

/**
 * Log level names.
 */
const levelNames: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
}

/**
 * Base log entry structure.
 */
export interface LogEntry {
  timestamp: string
  level: string
  message: string
  requestId?: string
  [key: string]: unknown
}

/**
 * Request context for logging.
 *
 * Note: IP addresses should be hashed before being stored in this context.
 * Use hashIP from secure-logger or ipHash field instead of raw ip.
 */
export interface RequestContext {
  requestId: string
  method: string
  path: string
  userAgent?: string
  /** @deprecated Use ipHash instead - raw IPs should not be logged */
  ip?: string
  /** Hashed IP for GDPR compliance */
  ipHash?: string
  walletAddress?: string
  /** Hashed wallet for pseudonymized logs */
  walletHash?: string
}

/**
 * Logger configuration.
 */
export interface LoggerConfig {
  minLevel: LogLevel
  service: string
  version: string
  environment: string
}

/**
 * Default configuration.
 */
const defaultConfig: LoggerConfig = {
  minLevel: LogLevel.INFO,
  service: 'claw-api',
  version: '3.0.0',
  environment: 'development',
}

/**
 * Current logger configuration.
 */
let config: LoggerConfig = { ...defaultConfig }

/**
 * Configure the logger.
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  config = { ...config, ...options }
}

/**
 * Get current config (for testing).
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...config }
}

/**
 * Reset logger config to defaults (for testing).
 */
export function resetLoggerConfig(): void {
  config = { ...defaultConfig }
}

/**
 * Generate ISO timestamp.
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Serialize error for logging.
 */
function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 5).join('\n'),
  }
}

/**
 * Sanitize sensitive data from logs using advanced PII scrubbing.
 *
 * Uses scrubPII from secure-logger which:
 * - Detects PII patterns in string values (API keys, JWTs, emails, etc.)
 * - Redacts sensitive field names
 * - Handles nested objects and arrays
 *
 * Reference: SECURITY_SPEC.md Section 9.2.4
 */
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  return scrubPII(data)
}

/**
 * Flag to track if we've warned about raw IP usage (to avoid log spam).
 */
let rawIpWarningLogged = false
let rawWalletWarningLogged = false

/**
 * Sanitize request context to remove raw PII.
 *
 * SECURITY: This function enforces that only hashed values are logged.
 * - Raw IPs (ctx.ip) are REJECTED - must use ipHash
 * - Raw wallet addresses (ctx.walletAddress) are REJECTED - must use walletHash
 *
 * This ensures consistent use of SHA-256 hashing throughout the codebase.
 * Callers must hash values before passing them to the logger.
 */
function sanitizeRequestContext(ctx?: RequestContext): Record<string, unknown> | undefined {
  if (!ctx) return undefined

  const sanitized: Record<string, unknown> = {
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
  }

  // Use ipHash if provided
  if (ctx.ipHash) {
    sanitized.ipHash = ctx.ipHash
  } else if (ctx.ip && ctx.ip !== 'unknown') {
    // SECURITY: Never log raw IPs - warn once and skip
    if (!rawIpWarningLogged) {
      console.warn('[Security] Raw IP passed to logger - use ipHash instead. IP not logged.')
      rawIpWarningLogged = true
    }
    // Do NOT log the raw IP
  }

  // User agent can be logged (not PII per se)
  if (ctx.userAgent) {
    sanitized.userAgent = ctx.userAgent
  }

  // Use walletHash if provided
  if (ctx.walletHash) {
    sanitized.walletHash = ctx.walletHash
  } else if (ctx.walletAddress) {
    // SECURITY: Never log raw wallet addresses - warn once and skip
    if (!rawWalletWarningLogged) {
      console.warn(
        '[Security] Raw walletAddress passed to logger - use walletHash instead. Wallet not logged.'
      )
      rawWalletWarningLogged = true
    }
    // Do NOT log the raw wallet
  }

  return sanitized
}

/**
 * Reset warning flags (for testing).
 */
export function resetSecurityWarnings(): void {
  rawIpWarningLogged = false
  rawWalletWarningLogged = false
}

/**
 * Core logging function.
 */
function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  requestContext?: RequestContext
): void {
  if (level < config.minLevel) {
    return
  }

  const entry: LogEntry = {
    timestamp: getTimestamp(),
    level: levelNames[level],
    message,
    service: config.service,
    version: config.version,
    environment: config.environment,
    ...sanitizeRequestContext(requestContext),
    ...(context ? sanitize(context) : {}),
  }

  const output = JSON.stringify(entry)

  switch (level) {
    case LogLevel.ERROR:
      console.error(output)
      break
    case LogLevel.WARN:
      console.warn(output)
      break
    case LogLevel.DEBUG:
      console.debug(output)
      break
    default:
      console.log(output)
  }
}

/**
 * Logger instance with bound request context.
 */
export class Logger {
  private context?: RequestContext

  constructor(context?: RequestContext) {
    this.context = context
  }

  /**
   * Create a child logger with additional context.
   */
  child(additionalContext: Partial<RequestContext>): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext,
    } as RequestContext)
  }

  debug(message: string, data?: Record<string, unknown>): void {
    log(LogLevel.DEBUG, message, data, this.context)
  }

  info(message: string, data?: Record<string, unknown>): void {
    log(LogLevel.INFO, message, data, this.context)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    log(LogLevel.WARN, message, data, this.context)
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData: Record<string, unknown> = { ...data }

    if (error instanceof Error) {
      errorData.error = serializeError(error)
    } else if (error !== undefined) {
      errorData.error = error
    }

    log(LogLevel.ERROR, message, errorData, this.context)
  }
}

/**
 * Create a logger instance.
 */
export function createLogger(context?: RequestContext): Logger {
  return new Logger(context)
}

/**
 * Default logger instance (without request context).
 */
export const logger = new Logger()

/**
 * Log request start.
 */
export function logRequest(ctx: RequestContext, additionalData?: Record<string, unknown>): void {
  log(
    LogLevel.INFO,
    `${ctx.method} ${ctx.path}`,
    {
      event: 'request_start',
      ...additionalData,
    },
    ctx
  )
}

/**
 * Log request completion.
 */
export function logResponse(
  ctx: RequestContext,
  statusCode: number,
  durationMs: number,
  additionalData?: Record<string, unknown>
): void {
  const level =
    statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO

  log(
    level,
    `${ctx.method} ${ctx.path} ${statusCode} ${durationMs}ms`,
    {
      event: 'request_end',
      statusCode,
      durationMs,
      ...additionalData,
    },
    ctx
  )
}

/**
 * Log GuardianClaw validation event.
 */
export function logGuardianClaw(
  ctx: RequestContext,
  stage: 'input' | 'output',
  passed: boolean,
  violations?: string[],
  gate?: string
): void {
  const level = passed ? LogLevel.INFO : LogLevel.WARN

  log(
    level,
    `GuardianClaw ${stage} validation: ${passed ? 'passed' : 'blocked'}`,
    {
      event: 'claw_validation',
      stage,
      passed,
      violations,
      gate,
    },
    ctx
  )
}

/**
 * Log external service call.
 */
export function logExternalCall(
  ctx: RequestContext,
  service: string,
  success: boolean,
  durationMs: number,
  error?: string
): void {
  const level = success ? LogLevel.INFO : LogLevel.WARN

  log(
    level,
    `External call to ${service}: ${success ? 'success' : 'failed'}`,
    {
      event: 'external_call',
      service,
      success,
      durationMs,
      error,
    },
    ctx
  )
}
