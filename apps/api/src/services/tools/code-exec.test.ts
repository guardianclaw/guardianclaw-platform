/**
 * Code Execution Tool Tests
 *
 * Tests for sandboxed code execution via Modal.com.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  executeCode,
  validateCodeExecConfig,
  formatCodeExecResult,
  sanitizeCode,
  type CodeExecResult,
} from './code-exec'

describe('code-exec', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================
  // VALIDATION TESTS
  // ============================================

  describe('validateCodeExecConfig', () => {
    it('accepts valid Python config', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'print("hello")',
      })
      expect(result.valid).toBe(true)
    })

    it('accepts valid JavaScript config', () => {
      const result = validateCodeExecConfig({
        language: 'javascript',
        code: 'console.log("hello")',
      })
      expect(result.valid).toBe(true)
    })

    it('rejects invalid language', () => {
      const result = validateCodeExecConfig({
        language: 'ruby' as unknown,
        code: 'puts "hello"',
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_LANGUAGE')
    })

    it('rejects missing code', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: '',
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('MISSING_CODE')
    })

    it('rejects code too large', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'x'.repeat(200_000), // 200KB
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('CODE_TOO_LARGE')
    })

    it('rejects invalid timeout', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'print(1)',
        timeout_ms: 100, // Too short
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_TIMEOUT')
    })

    it('rejects timeout too long', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'print(1)',
        timeout_ms: 60000, // Too long
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_TIMEOUT')
    })

    it('rejects invalid memory', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'print(1)',
        memory_mb: 32, // Too small
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_MEMORY')
    })

    it('rejects memory too large', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'print(1)',
        memory_mb: 1024, // Too large
      })
      expect(result.valid).toBe(false)
      expect(result.errorCode).toBe('INVALID_MEMORY')
    })

    it('accepts valid optional parameters', () => {
      const result = validateCodeExecConfig({
        language: 'python',
        code: 'print(1)',
        timeout_ms: 5000,
        memory_mb: 128,
        allow_network: true,
        input_data: 'test input',
      })
      expect(result.valid).toBe(true)
    })
  })

  // ============================================
  // EXECUTION TESTS
  // ============================================

  describe('executeCode', () => {
    it('returns validation error for invalid config', async () => {
      const result = await executeCode({
        language: 'invalid' as unknown,
        code: 'print(1)',
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('INVALID_LANGUAGE')
    })

    it('calls Modal API with correct payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            stdout: 'Hello, World!\n',
            stderr: '',
            exit_code: 0,
            execution_time_ms: 150,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )

      const _result = await executeCode({
        language: 'python',
        code: 'print("Hello, World!")',
        timeout_ms: 5000,
        memory_mb: 128,
      })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('execute-code-web'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )

      // Verify request body
      const call = fetchSpy.mock.calls[0]
      const body = JSON.parse(call[1]?.body as string)
      expect(body.language).toBe('python')
      expect(body.code).toBe('print("Hello, World!")')
      expect(body.timeout_ms).toBe(5000)
      expect(body.memory_mb).toBe(128)
    })

    it('returns success result from Modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            stdout: 'Hello, World!\n',
            stderr: '',
            exit_code: 0,
            execution_time_ms: 150,
          }),
          { status: 200 }
        )
      )

      const result = await executeCode({
        language: 'python',
        code: 'print("Hello, World!")',
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('Hello, World!\n')
      expect(result.exit_code).toBe(0)
    })

    it('returns failure result from Modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            stdout: '',
            stderr: 'NameError: name "foo" is not defined',
            exit_code: 1,
            execution_time_ms: 50,
            error: 'Execution failed',
            error_code: 'EXECUTION_FAILED',
          }),
          { status: 200 }
        )
      )

      const result = await executeCode({
        language: 'python',
        code: 'print(foo)',
      })

      expect(result.success).toBe(false)
      expect(result.exit_code).toBe(1)
      expect(result.error_code).toBe('EXECUTION_FAILED')
    })

    it('handles API error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      )

      const result = await executeCode({
        language: 'python',
        code: 'print(1)',
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('API_ERROR')
    })

    it('handles network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network request failed'))

      const result = await executeCode({
        language: 'python',
        code: 'print(1)',
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('NETWORK_ERROR')
      expect(result.error).toBe('Network request failed')
    })

    it('handles timeout', async () => {
      // Simulate abort error
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

      const result = await executeCode({
        language: 'python',
        code: 'import time; time.sleep(100)',
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('API_TIMEOUT')
    })

    it('applies default values', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            stdout: '',
            stderr: '',
            exit_code: 0,
            execution_time_ms: 100,
          }),
          { status: 200 }
        )
      )

      await executeCode({
        language: 'python',
        code: 'pass',
      })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.timeout_ms).toBe(30000) // Default
      expect(body.memory_mb).toBe(256) // Default
      expect(body.allow_network).toBe(false) // Default
    })

    it('passes input_data to Modal', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            stdout: 'test data\n',
            stderr: '',
            exit_code: 0,
            execution_time_ms: 100,
          }),
          { status: 200 }
        )
      )

      await executeCode({
        language: 'python',
        code: 'print(INPUT)',
        input_data: 'test data',
      })

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.input_data).toBe('test data')
    })

    // ============================================
    // MODAL SERVER-SIDE ERROR CODES
    // ============================================

    it('handles DANGEROUS_CODE from Modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            stdout: '',
            stderr: '',
            exit_code: -1,
            execution_time_ms: 50,
            error:
              'Blocked pattern detected. This operation is not allowed in sandboxed execution.',
            error_code: 'DANGEROUS_CODE',
          }),
          { status: 200 }
        )
      )

      const result = await executeCode({
        language: 'python',
        code: 'x = 1', // The actual code doesn't matter, we mock the response
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('DANGEROUS_CODE')
      expect(result.error).toContain('Blocked pattern')
    })

    it('handles TIMEOUT from Modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            stdout: '',
            stderr: '',
            exit_code: -1,
            execution_time_ms: 30000,
            error: 'Execution timed out after 30000ms',
            error_code: 'TIMEOUT',
          }),
          { status: 200 }
        )
      )

      const result = await executeCode({
        language: 'python',
        code: 'x = 1', // The actual code doesn't matter, we mock the response
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('TIMEOUT')
    })

    it('handles SANDBOX_ERROR from Modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            stdout: '',
            stderr: '',
            exit_code: -1,
            execution_time_ms: 100,
            error: 'Failed to create sandbox container',
            error_code: 'SANDBOX_ERROR',
          }),
          { status: 200 }
        )
      )

      const result = await executeCode({
        language: 'python',
        code: 'print(1)',
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('SANDBOX_ERROR')
    })

    it('handles JavaScript execution', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            stdout: '42\n',
            stderr: '',
            exit_code: 0,
            execution_time_ms: 80,
          }),
          { status: 200 }
        )
      )

      const result = await executeCode({
        language: 'javascript',
        code: 'console.log(21 * 2)',
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toBe('42\n')
    })
  })

  // ============================================
  // FORMATTING TESTS
  // ============================================

  describe('formatCodeExecResult', () => {
    it('formats successful result', () => {
      const result: CodeExecResult = {
        success: true,
        stdout: 'Hello, World!\n',
        stderr: '',
        exit_code: 0,
        execution_time_ms: 150,
      }

      const formatted = formatCodeExecResult(result)

      expect(formatted).toContain('SUCCESS')
      expect(formatted).toContain('Exit code: 0')
      expect(formatted).toContain('150ms')
      expect(formatted).toContain('Hello, World!')
    })

    it('formats failed result', () => {
      const result: CodeExecResult = {
        success: false,
        stdout: '',
        stderr: 'NameError: name "x" is not defined',
        exit_code: 1,
        execution_time_ms: 50,
        error: 'Execution failed',
      }

      const formatted = formatCodeExecResult(result)

      expect(formatted).toContain('FAILED')
      expect(formatted).toContain('Execution failed')
      expect(formatted).toContain('NameError')
    })

    it('includes warnings/stderr in successful result', () => {
      const result: CodeExecResult = {
        success: true,
        stdout: 'Output\n',
        stderr: 'DeprecationWarning: something',
        exit_code: 0,
        execution_time_ms: 100,
      }

      const formatted = formatCodeExecResult(result)

      expect(formatted).toContain('Warnings/Errors')
      expect(formatted).toContain('DeprecationWarning')
    })
  })

  // ============================================
  // SANITIZATION TESTS
  // ============================================

  describe('sanitizeCode', () => {
    it('removes null bytes', () => {
      const code = 'print("hello\x00world")'
      const sanitized = sanitizeCode(code)
      expect(sanitized).toBe('print("helloworld")')
    })

    it('removes other control characters', () => {
      const code = 'print(\x01\x02\x03"hello")'
      const sanitized = sanitizeCode(code)
      expect(sanitized).toBe('print("hello")')
    })

    it('preserves newlines and tabs', () => {
      const code = 'if True:\n\tprint("hello")'
      const sanitized = sanitizeCode(code)
      expect(sanitized).toBe('if True:\n\tprint("hello")')
    })

    it('preserves normal code', () => {
      const code = 'def add(a, b):\n    return a + b\n\nprint(add(1, 2))'
      const sanitized = sanitizeCode(code)
      expect(sanitized).toBe(code)
    })
  })
})
