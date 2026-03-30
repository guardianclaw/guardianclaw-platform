/**
 * Logger tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Logger,
  createLogger,
  logger,
  configureLogger,
  getLoggerConfig,
  resetLoggerConfig,
  resetSecurityWarnings,
  logRequest,
  logResponse,
  logGuardianClaw,
  logExternalCall,
  LogLevel,
  type RequestContext,
} from './logger'

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    debug: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    resetLoggerConfig()
    resetSecurityWarnings()
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('configureLogger', () => {
    it('updates configuration', () => {
      configureLogger({ environment: 'production', minLevel: LogLevel.WARN })

      const config = getLoggerConfig()
      expect(config.environment).toBe('production')
      expect(config.minLevel).toBe(LogLevel.WARN)
    })

    it('preserves unset values', () => {
      configureLogger({ environment: 'staging' })

      const config = getLoggerConfig()
      expect(config.environment).toBe('staging')
      expect(config.service).toBe('claw-api')
      expect(config.version).toBe('3.0.0')
    })
  })

  describe('resetLoggerConfig', () => {
    it('resets to defaults', () => {
      configureLogger({ environment: 'test', minLevel: LogLevel.ERROR })
      resetLoggerConfig()

      const config = getLoggerConfig()
      expect(config.environment).toBe('development')
      expect(config.minLevel).toBe(LogLevel.INFO)
    })
  })

  describe('Logger class', () => {
    it('logs info message', () => {
      const log = new Logger()
      log.info('Test message')

      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.level).toBe('info')
      expect(output.message).toBe('Test message')
    })

    it('logs error with error object', () => {
      const log = new Logger()
      const error = new Error('Something broke')
      log.error('Failed', error)

      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0])
      expect(output.level).toBe('error')
      expect(output.error.name).toBe('Error')
      expect(output.error.message).toBe('Something broke')
    })

    it('logs warning', () => {
      const log = new Logger()
      log.warn('Deprecation notice')

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0])
      expect(output.level).toBe('warn')
    })

    it('logs debug when level allows', () => {
      configureLogger({ minLevel: LogLevel.DEBUG })
      const log = new Logger()
      log.debug('Debug info')

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1)
    })

    it('skips debug when level is higher', () => {
      configureLogger({ minLevel: LogLevel.INFO })
      const log = new Logger()
      log.debug('Debug info')

      expect(consoleSpy.debug).not.toHaveBeenCalled()
    })

    it('includes request context', () => {
      const context: RequestContext = {
        requestId: 'req-123',
        method: 'GET',
        path: '/test',
      }
      const log = new Logger(context)
      log.info('With context')

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.requestId).toBe('req-123')
      expect(output.method).toBe('GET')
      expect(output.path).toBe('/test')
    })

    it('includes additional data', () => {
      const log = new Logger()
      log.info('With data', { userId: '123', action: 'login' })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.userId).toBe('123')
      expect(output.action).toBe('login')
    })

    it('sanitizes sensitive data', () => {
      const log = new Logger()
      log.info('With secrets', {
        password: 'secret123',
        apiKey: 'sk-xxx',
        // Short auth value that doesn't match Bearer pattern
        authorization: 'Basic abc',
        normal: 'value',
      })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.password).toBe('[REDACTED]')
      expect(output.apiKey).toBe('[REDACTED]')
      expect(output.authorization).toBe('[REDACTED]')
      expect(output.normal).toBe('value')
    })

    it('sanitizes PII patterns in values', () => {
      const log = new Logger()
      log.info('With PII patterns', {
        message: 'User email is user@example.com',
        // Long Bearer token that matches pattern
        header: 'Bearer abc123xyz789tokenabc',
      })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.message).toContain('[REDACTED_EMAIL]')
      expect(output.header).toContain('[REDACTED_BEARER_TOKEN]')
    })

    it('sanitizes nested sensitive data', () => {
      const log = new Logger()
      log.info('Nested', {
        user: {
          name: 'John',
          password: 'secret',
        },
      })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.user.name).toBe('John')
      expect(output.user.password).toBe('[REDACTED]')
    })

    it('includes timestamp', () => {
      const log = new Logger()
      log.info('Timestamped')

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.timestamp).toBeDefined()
      expect(new Date(output.timestamp).getTime()).not.toBeNaN()
    })

    it('includes service metadata', () => {
      const log = new Logger()
      log.info('With metadata')

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.service).toBe('claw-api')
      expect(output.version).toBe('3.0.0')
    })
  })

  describe('child logger', () => {
    it('inherits parent context with walletHash', () => {
      const parent = new Logger({
        requestId: 'req-1',
        method: 'POST',
        path: '/api',
      })

      // Proper usage: pass pre-computed walletHash (not raw walletAddress)
      const child = parent.child({ walletHash: 'abc123def456' })
      child.info('Child log')

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.requestId).toBe('req-1')
      expect(output.walletHash).toBe('abc123def456')
    })

    it('rejects raw walletAddress with warning', () => {
      const parent = new Logger({
        requestId: 'req-1',
        method: 'POST',
        path: '/api',
      })

      // Bad usage: passing raw walletAddress (should trigger warning)
      const child = parent.child({ walletAddress: '0x123' })
      child.info('Child log')

      // Warning should be logged
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Raw walletAddress passed to logger')
      )

      // Raw wallet should NOT appear in output
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.walletAddress).toBeUndefined()
      expect(output.walletHash).toBeUndefined() // Not hashed, just rejected
    })
  })

  describe('createLogger', () => {
    it('creates logger with context', () => {
      const log = createLogger({
        requestId: 'req-abc',
        method: 'DELETE',
        path: '/resource',
      })

      log.info('Created')
      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.requestId).toBe('req-abc')
    })

    it('creates logger without context', () => {
      const log = createLogger()
      log.info('No context')

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.requestId).toBeUndefined()
    })
  })

  describe('default logger', () => {
    it('exists and works', () => {
      logger.info('Default logger')

      expect(consoleSpy.log).toHaveBeenCalledTimes(1)
    })
  })

  describe('logRequest', () => {
    it('logs request start', () => {
      const ctx: RequestContext = {
        requestId: 'req-1',
        method: 'GET',
        path: '/health',
      }

      logRequest(ctx)

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.event).toBe('request_start')
      expect(output.message).toBe('GET /health')
    })

    it('includes additional data', () => {
      const ctx: RequestContext = {
        requestId: 'req-2',
        method: 'POST',
        path: '/api',
      }

      logRequest(ctx, { contentLength: 1024 })

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.contentLength).toBe(1024)
    })
  })

  describe('logResponse', () => {
    it('logs successful response', () => {
      const ctx: RequestContext = {
        requestId: 'req-1',
        method: 'GET',
        path: '/api',
      }

      logResponse(ctx, 200, 50)

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.event).toBe('request_end')
      expect(output.statusCode).toBe(200)
      expect(output.durationMs).toBe(50)
      expect(output.level).toBe('info')
    })

    it('logs 4xx as warning', () => {
      const ctx: RequestContext = {
        requestId: 'req-2',
        method: 'GET',
        path: '/api',
      }

      logResponse(ctx, 404, 25)

      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0])
      expect(output.level).toBe('warn')
      expect(output.statusCode).toBe(404)
    })

    it('logs 5xx as error', () => {
      const ctx: RequestContext = {
        requestId: 'req-3',
        method: 'POST',
        path: '/api',
      }

      logResponse(ctx, 500, 100)

      const output = JSON.parse(consoleSpy.error.mock.calls[0][0])
      expect(output.level).toBe('error')
      expect(output.statusCode).toBe(500)
    })
  })

  describe('logGuardianClaw', () => {
    it('logs passed validation', () => {
      const ctx: RequestContext = {
        requestId: 'req-1',
        method: 'POST',
        path: '/invoke',
      }

      logGuardianClaw(ctx, 'input', true)

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.event).toBe('claw_validation')
      expect(output.stage).toBe('input')
      expect(output.passed).toBe(true)
    })

    it('logs blocked validation', () => {
      const ctx: RequestContext = {
        requestId: 'req-2',
        method: 'POST',
        path: '/invoke',
      }

      logGuardianClaw(ctx, 'output', false, ['avoidance:weapons'], 'avoidance')

      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0])
      expect(output.passed).toBe(false)
      // Violations array is spread via sanitize, check content exists
      expect(output.violations).toBeDefined()
      expect(Object.values(output.violations)).toContain('avoidance:weapons')
      expect(output.gate).toBe('avoidance')
    })
  })

  describe('logExternalCall', () => {
    it('logs successful call', () => {
      const ctx: RequestContext = {
        requestId: 'req-1',
        method: 'POST',
        path: '/api',
      }

      logExternalCall(ctx, 'Modal', true, 150)

      const output = JSON.parse(consoleSpy.log.mock.calls[0][0])
      expect(output.event).toBe('external_call')
      expect(output.service).toBe('Modal')
      expect(output.success).toBe(true)
      expect(output.durationMs).toBe(150)
    })

    it('logs failed call', () => {
      const ctx: RequestContext = {
        requestId: 'req-2',
        method: 'POST',
        path: '/api',
      }

      logExternalCall(ctx, 'OpenAI', false, 5000, 'Timeout')

      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0])
      expect(output.success).toBe(false)
      expect(output.error).toBe('Timeout')
    })
  })
})
