/**
 * Standardized API error handling.
 *
 * Provides consistent error format across all endpoints with machine-readable
 * codes and human-friendly messages.
 */

/**
 * Error codes for machine parsing.
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export enum ErrorCode {
  // Authentication (1xx)
  AUTH_MISSING_TOKEN = 'AUTH_MISSING_TOKEN',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN = 'AUTH_EXPIRED_TOKEN',
  AUTH_INVALID_SIGNATURE = 'AUTH_INVALID_SIGNATURE',
  AUTH_NONCE_EXPIRED = 'AUTH_NONCE_EXPIRED',

  // Authorization (2xx)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED',

  // Validation (3xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Rate Limiting (4xx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Resource (5xx)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // GuardianClaw (6xx)
  GCLAW_INPUT_BLOCKED = 'GCLAW_INPUT_BLOCKED',
  GCLAW_OUTPUT_BLOCKED = 'GCLAW_OUTPUT_BLOCKED',
  GCLAW_VALIDATION_FAILED = 'GCLAW_VALIDATION_FAILED',

  // External Services (7xx)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  MODAL_RUNTIME_ERROR = 'MODAL_RUNTIME_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SOLANA_RPC_ERROR = 'SOLANA_RPC_ERROR',

  // Server (9xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Standard API error response format.
 */
export interface ApiErrorResponse {
  error: string
  code: ErrorCode
  details?: unknown
  requestId?: string
}

/**
 * HTTP status codes for each error category.
 */
const errorStatusMap: Record<ErrorCode, number> = {
  // Auth - 401
  [ErrorCode.AUTH_MISSING_TOKEN]: 401,
  [ErrorCode.AUTH_INVALID_TOKEN]: 401,
  [ErrorCode.AUTH_EXPIRED_TOKEN]: 401,
  [ErrorCode.AUTH_INVALID_SIGNATURE]: 401,
  [ErrorCode.AUTH_NONCE_EXPIRED]: 401,

  // Authorization - 403
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.PLAN_LIMIT_EXCEEDED]: 403,

  // Validation - 400
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST_BODY]: 400,
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,

  // Rate Limiting - 429
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  // Resource - 404/409
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.AGENT_NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,

  // GuardianClaw - 200 (blocked but valid response)
  [ErrorCode.GCLAW_INPUT_BLOCKED]: 200,
  [ErrorCode.GCLAW_OUTPUT_BLOCKED]: 200,
  [ErrorCode.GCLAW_VALIDATION_FAILED]: 400,

  // External - 502
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.MODAL_RUNTIME_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 502,
  [ErrorCode.SOLANA_RPC_ERROR]: 502,

  // Server - 500/503
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
}

/**
 * Custom error class for API errors.
 * Provides consistent error formatting and HTTP status mapping.
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly details?: unknown
  readonly requestId?: string

  constructor(code: ErrorCode, message: string, details?: unknown, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = errorStatusMap[code]
    this.details = details
    this.requestId = requestId
  }

  /**
   * Convert to JSON response format.
   */
  toJSON(): ApiErrorResponse {
    return {
      error: this.message,
      code: this.code,
      ...(this.details !== undefined && { details: this.details }),
      ...(this.requestId && { requestId: this.requestId }),
    }
  }
}

/**
 * Helper factory functions for common errors.
 */
export const Errors = {
  // Auth
  missingToken: (requestId?: string) =>
    new ApiError(ErrorCode.AUTH_MISSING_TOKEN, 'Authentication required', undefined, requestId),

  invalidToken: (requestId?: string) =>
    new ApiError(
      ErrorCode.AUTH_INVALID_TOKEN,
      'Invalid authentication token',
      undefined,
      requestId
    ),

  expiredToken: (requestId?: string) =>
    new ApiError(
      ErrorCode.AUTH_EXPIRED_TOKEN,
      'Authentication token has expired',
      undefined,
      requestId
    ),

  invalidSignature: (requestId?: string) =>
    new ApiError(ErrorCode.AUTH_INVALID_SIGNATURE, 'Invalid signature', undefined, requestId),

  nonceExpired: (requestId?: string) =>
    new ApiError(
      ErrorCode.AUTH_NONCE_EXPIRED,
      'Nonce has expired, please request a new one',
      undefined,
      requestId
    ),

  // Authorization
  forbidden: (message = 'Access denied', requestId?: string) =>
    new ApiError(ErrorCode.FORBIDDEN, message, undefined, requestId),

  planLimitExceeded: (resource: string, limit: number, requestId?: string) =>
    new ApiError(
      ErrorCode.PLAN_LIMIT_EXCEEDED,
      `Plan limit exceeded: maximum ${limit} ${resource} allowed`,
      { resource, limit },
      requestId
    ),

  // Validation
  validation: (details: unknown, requestId?: string) =>
    new ApiError(ErrorCode.VALIDATION_ERROR, 'Validation failed', details, requestId),

  invalidRequestBody: (details?: unknown, requestId?: string) =>
    new ApiError(ErrorCode.INVALID_REQUEST_BODY, 'Invalid request body', details, requestId),

  invalidParameter: (param: string, message: string, requestId?: string) =>
    new ApiError(
      ErrorCode.INVALID_PARAMETER,
      `Invalid parameter '${param}': ${message}`,
      { parameter: param },
      requestId
    ),

  missingField: (field: string, requestId?: string) =>
    new ApiError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `Missing required field: ${field}`,
      { field },
      requestId
    ),

  // Rate Limiting
  rateLimitExceeded: (limit: number, retryAfter: number, requestId?: string) =>
    new ApiError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { limit, retryAfter },
      requestId
    ),

  // Resources
  notFound: (resource = 'Resource', requestId?: string) =>
    new ApiError(ErrorCode.NOT_FOUND, `${resource} not found`, undefined, requestId),

  agentNotFound: (id: string, requestId?: string) =>
    new ApiError(ErrorCode.AGENT_NOT_FOUND, 'Agent not found', { agentId: id }, requestId),

  alreadyExists: (resource: string, requestId?: string) =>
    new ApiError(ErrorCode.ALREADY_EXISTS, `${resource} already exists`, undefined, requestId),

  conflict: (message: string, requestId?: string) =>
    new ApiError(ErrorCode.CONFLICT, message, undefined, requestId),

  // GuardianClaw
  clawBlocked: (
    stage: 'input' | 'output',
    gate: string,
    violations: string[],
    requestId?: string
  ) =>
    new ApiError(
      stage === 'input' ? ErrorCode.GCLAW_INPUT_BLOCKED : ErrorCode.GCLAW_OUTPUT_BLOCKED,
      `Request blocked by GuardianClaw at ${stage} stage`,
      { stage, gate, violations },
      requestId
    ),

  // External
  externalService: (service: string, message: string, requestId?: string) =>
    new ApiError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `${service} error: ${message}`,
      { service },
      requestId
    ),

  modalRuntime: (message: string, requestId?: string) =>
    new ApiError(
      ErrorCode.MODAL_RUNTIME_ERROR,
      `Modal runtime error: ${message}`,
      undefined,
      requestId
    ),

  database: (message: string, requestId?: string) =>
    new ApiError(ErrorCode.DATABASE_ERROR, `Database error: ${message}`, undefined, requestId),

  solanaRpc: (message: string, requestId?: string) =>
    new ApiError(ErrorCode.SOLANA_RPC_ERROR, `Solana RPC error: ${message}`, undefined, requestId),

  // Server
  internal: (message = 'An unexpected error occurred', requestId?: string) =>
    new ApiError(ErrorCode.INTERNAL_ERROR, message, undefined, requestId),

  unavailable: (requestId?: string) =>
    new ApiError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable',
      undefined,
      requestId
    ),
}

/**
 * Check if an error is an ApiError instance.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Convert any error to ApiError.
 * Unknown errors become INTERNAL_ERROR.
 */
export function toApiError(error: unknown, requestId?: string): ApiError {
  if (isApiError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new ApiError(ErrorCode.INTERNAL_ERROR, error.message, undefined, requestId)
  }

  return new ApiError(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    undefined,
    requestId
  )
}
