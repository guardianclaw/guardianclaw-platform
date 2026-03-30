/**
 * Error handling tests.
 */

import { describe, it, expect } from 'vitest'
import { ApiError, ErrorCode, Errors, isApiError, toApiError } from './errors'

describe('Errors', () => {
  describe('ApiError class', () => {
    it('creates error with all properties', () => {
      const error = new ApiError(
        ErrorCode.AUTH_MISSING_TOKEN,
        'Token required',
        { hint: 'use header' },
        'req-123'
      )

      expect(error.code).toBe(ErrorCode.AUTH_MISSING_TOKEN)
      expect(error.message).toBe('Token required')
      expect(error.details).toEqual({ hint: 'use header' })
      expect(error.requestId).toBe('req-123')
      expect(error.statusCode).toBe(401)
      expect(error.name).toBe('ApiError')
    })

    it('extends Error', () => {
      const error = new ApiError(ErrorCode.NOT_FOUND, 'Not found')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ApiError)
    })

    it('toJSON returns correct format', () => {
      const error = new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Invalid input',
        { field: 'email' },
        'req-456'
      )

      const json = error.toJSON()

      expect(json).toEqual({
        error: 'Invalid input',
        code: ErrorCode.VALIDATION_ERROR,
        details: { field: 'email' },
        requestId: 'req-456',
      })
    })

    it('toJSON excludes undefined fields', () => {
      const error = new ApiError(ErrorCode.NOT_FOUND, 'Not found')

      const json = error.toJSON()

      expect(json).toEqual({
        error: 'Not found',
        code: ErrorCode.NOT_FOUND,
      })
      expect('details' in json).toBe(false)
      expect('requestId' in json).toBe(false)
    })

    describe('status code mapping', () => {
      it('maps auth errors to 401', () => {
        expect(new ApiError(ErrorCode.AUTH_MISSING_TOKEN, '').statusCode).toBe(401)
        expect(new ApiError(ErrorCode.AUTH_INVALID_TOKEN, '').statusCode).toBe(401)
        expect(new ApiError(ErrorCode.AUTH_EXPIRED_TOKEN, '').statusCode).toBe(401)
        expect(new ApiError(ErrorCode.AUTH_INVALID_SIGNATURE, '').statusCode).toBe(401)
        expect(new ApiError(ErrorCode.AUTH_NONCE_EXPIRED, '').statusCode).toBe(401)
      })

      it('maps authorization errors to 403', () => {
        expect(new ApiError(ErrorCode.FORBIDDEN, '').statusCode).toBe(403)
        expect(new ApiError(ErrorCode.INSUFFICIENT_PERMISSIONS, '').statusCode).toBe(403)
        expect(new ApiError(ErrorCode.PLAN_LIMIT_EXCEEDED, '').statusCode).toBe(403)
      })

      it('maps validation errors to 400', () => {
        expect(new ApiError(ErrorCode.VALIDATION_ERROR, '').statusCode).toBe(400)
        expect(new ApiError(ErrorCode.INVALID_REQUEST_BODY, '').statusCode).toBe(400)
        expect(new ApiError(ErrorCode.INVALID_PARAMETER, '').statusCode).toBe(400)
        expect(new ApiError(ErrorCode.MISSING_REQUIRED_FIELD, '').statusCode).toBe(400)
      })

      it('maps rate limit to 429', () => {
        expect(new ApiError(ErrorCode.RATE_LIMIT_EXCEEDED, '').statusCode).toBe(429)
      })

      it('maps not found to 404', () => {
        expect(new ApiError(ErrorCode.NOT_FOUND, '').statusCode).toBe(404)
        expect(new ApiError(ErrorCode.RESOURCE_NOT_FOUND, '').statusCode).toBe(404)
        expect(new ApiError(ErrorCode.AGENT_NOT_FOUND, '').statusCode).toBe(404)
      })

      it('maps conflict to 409', () => {
        expect(new ApiError(ErrorCode.ALREADY_EXISTS, '').statusCode).toBe(409)
        expect(new ApiError(ErrorCode.CONFLICT, '').statusCode).toBe(409)
      })

      it('maps claw blocked to 200', () => {
        expect(new ApiError(ErrorCode.GCLAW_INPUT_BLOCKED, '').statusCode).toBe(200)
        expect(new ApiError(ErrorCode.GCLAW_OUTPUT_BLOCKED, '').statusCode).toBe(200)
      })

      it('maps external service errors to 502', () => {
        expect(new ApiError(ErrorCode.EXTERNAL_SERVICE_ERROR, '').statusCode).toBe(502)
        expect(new ApiError(ErrorCode.MODAL_RUNTIME_ERROR, '').statusCode).toBe(502)
        expect(new ApiError(ErrorCode.DATABASE_ERROR, '').statusCode).toBe(502)
        expect(new ApiError(ErrorCode.SOLANA_RPC_ERROR, '').statusCode).toBe(502)
      })

      it('maps internal error to 500', () => {
        expect(new ApiError(ErrorCode.INTERNAL_ERROR, '').statusCode).toBe(500)
      })

      it('maps unavailable to 503', () => {
        expect(new ApiError(ErrorCode.SERVICE_UNAVAILABLE, '').statusCode).toBe(503)
      })
    })
  })

  describe('Error factories', () => {
    it('creates missingToken error', () => {
      const error = Errors.missingToken('req-1')

      expect(error.code).toBe(ErrorCode.AUTH_MISSING_TOKEN)
      expect(error.message).toBe('Authentication required')
      expect(error.requestId).toBe('req-1')
    })

    it('creates invalidToken error', () => {
      const error = Errors.invalidToken()

      expect(error.code).toBe(ErrorCode.AUTH_INVALID_TOKEN)
      expect(error.message).toBe('Invalid authentication token')
    })

    it('creates expiredToken error', () => {
      const error = Errors.expiredToken()

      expect(error.code).toBe(ErrorCode.AUTH_EXPIRED_TOKEN)
      expect(error.message).toBe('Authentication token has expired')
    })

    it('creates invalidSignature error', () => {
      const error = Errors.invalidSignature()

      expect(error.code).toBe(ErrorCode.AUTH_INVALID_SIGNATURE)
    })

    it('creates nonceExpired error', () => {
      const error = Errors.nonceExpired()

      expect(error.code).toBe(ErrorCode.AUTH_NONCE_EXPIRED)
    })

    it('creates forbidden error with custom message', () => {
      const error = Errors.forbidden('Custom forbidden')

      expect(error.code).toBe(ErrorCode.FORBIDDEN)
      expect(error.message).toBe('Custom forbidden')
    })

    it('creates planLimitExceeded error', () => {
      const error = Errors.planLimitExceeded('agents', 10, 'req-2')

      expect(error.code).toBe(ErrorCode.PLAN_LIMIT_EXCEEDED)
      expect(error.message).toBe('Plan limit exceeded: maximum 10 agents allowed')
      expect(error.details).toEqual({ resource: 'agents', limit: 10 })
    })

    it('creates validation error', () => {
      const error = Errors.validation({ email: 'invalid' })

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.details).toEqual({ email: 'invalid' })
    })

    it('creates invalidRequestBody error', () => {
      const error = Errors.invalidRequestBody({ issue: 'malformed JSON' })

      expect(error.code).toBe(ErrorCode.INVALID_REQUEST_BODY)
      expect(error.details).toEqual({ issue: 'malformed JSON' })
    })

    it('creates invalidParameter error', () => {
      const error = Errors.invalidParameter('page', 'must be positive')

      expect(error.code).toBe(ErrorCode.INVALID_PARAMETER)
      expect(error.message).toBe("Invalid parameter 'page': must be positive")
      expect(error.details).toEqual({ parameter: 'page' })
    })

    it('creates missingField error', () => {
      const error = Errors.missingField('email')

      expect(error.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD)
      expect(error.message).toBe('Missing required field: email')
      expect(error.details).toEqual({ field: 'email' })
    })

    it('creates rateLimitExceeded error', () => {
      const error = Errors.rateLimitExceeded(100, 30)

      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
      expect(error.details).toEqual({ limit: 100, retryAfter: 30 })
    })

    it('creates notFound error', () => {
      const error = Errors.notFound('Agent')

      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.message).toBe('Agent not found')
    })

    it('creates agentNotFound error', () => {
      const error = Errors.agentNotFound('uuid-123')

      expect(error.code).toBe(ErrorCode.AGENT_NOT_FOUND)
      expect(error.details).toEqual({ agentId: 'uuid-123' })
    })

    it('creates alreadyExists error', () => {
      const error = Errors.alreadyExists('API key')

      expect(error.code).toBe(ErrorCode.ALREADY_EXISTS)
      expect(error.message).toBe('API key already exists')
    })

    it('creates conflict error', () => {
      const error = Errors.conflict('Version mismatch')

      expect(error.code).toBe(ErrorCode.CONFLICT)
      expect(error.message).toBe('Version mismatch')
    })

    it('creates clawBlocked error for input', () => {
      const error = Errors.clawBlocked('input', 'avoidance', ['avoidance:weapons'])

      expect(error.code).toBe(ErrorCode.GCLAW_INPUT_BLOCKED)
      expect(error.message).toBe('Request blocked by GuardianClaw at input stage')
      expect(error.details).toEqual({
        stage: 'input',
        gate: 'avoidance',
        violations: ['avoidance:weapons'],
      })
    })

    it('creates clawBlocked error for output', () => {
      const error = Errors.clawBlocked('output', 'credibility', ['credibility:unverified'])

      expect(error.code).toBe(ErrorCode.GCLAW_OUTPUT_BLOCKED)
    })

    it('creates externalService error', () => {
      const error = Errors.externalService('OpenAI', 'Rate limited')

      expect(error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR)
      expect(error.message).toBe('OpenAI error: Rate limited')
      expect(error.details).toEqual({ service: 'OpenAI' })
    })

    it('creates modalRuntime error', () => {
      const error = Errors.modalRuntime('Connection timeout')

      expect(error.code).toBe(ErrorCode.MODAL_RUNTIME_ERROR)
      expect(error.message).toBe('Modal runtime error: Connection timeout')
    })

    it('creates database error', () => {
      const error = Errors.database('Query failed')

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR)
    })

    it('creates solanaRpc error', () => {
      const error = Errors.solanaRpc('Node unavailable')

      expect(error.code).toBe(ErrorCode.SOLANA_RPC_ERROR)
    })

    it('creates internal error with default message', () => {
      const error = Errors.internal()

      expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(error.message).toBe('An unexpected error occurred')
    })

    it('creates internal error with custom message', () => {
      const error = Errors.internal('Something broke')

      expect(error.message).toBe('Something broke')
    })

    it('creates unavailable error', () => {
      const error = Errors.unavailable()

      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE)
      expect(error.message).toBe('Service temporarily unavailable')
    })
  })

  describe('isApiError', () => {
    it('returns true for ApiError', () => {
      const error = new ApiError(ErrorCode.NOT_FOUND, 'test')
      expect(isApiError(error)).toBe(true)
    })

    it('returns false for regular Error', () => {
      const error = new Error('test')
      expect(isApiError(error)).toBe(false)
    })

    it('returns false for plain object', () => {
      expect(isApiError({ code: 'NOT_FOUND', message: 'test' })).toBe(false)
    })

    it('returns false for null/undefined', () => {
      expect(isApiError(null)).toBe(false)
      expect(isApiError(undefined)).toBe(false)
    })
  })

  describe('toApiError', () => {
    it('returns same error if already ApiError', () => {
      const original = new ApiError(ErrorCode.NOT_FOUND, 'test', undefined, 'req-1')
      const converted = toApiError(original, 'req-2')

      expect(converted).toBe(original)
      expect(converted.requestId).toBe('req-1') // Original requestId preserved
    })

    it('converts regular Error', () => {
      const error = new Error('Something failed')
      const converted = toApiError(error, 'req-3')

      expect(converted.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(converted.message).toBe('Something failed')
      expect(converted.requestId).toBe('req-3')
    })

    it('converts unknown error type', () => {
      const converted = toApiError('string error', 'req-4')

      expect(converted.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(converted.message).toBe('An unexpected error occurred')
      expect(converted.requestId).toBe('req-4')
    })

    it('handles null/undefined', () => {
      expect(toApiError(null).code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(toApiError(undefined).code).toBe(ErrorCode.INTERNAL_ERROR)
    })
  })
})
