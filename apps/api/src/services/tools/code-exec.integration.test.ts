/**
 * Code Execution Integration Tests
 *
 * These tests call the real Modal endpoint and require:
 * 1. Modal runtime deployed: `modal deploy claw_runtime.main`
 * 2. Network access to Modal
 *
 * Run manually with: npm test -- --run code-exec.integration
 *
 * These tests are skipped by default (describe.skip).
 * Remove .skip to run against real Modal endpoint.
 */

import { describe, it, expect } from 'vitest'
import { executeCode, checkCodeExecHealth } from './code-exec'

// Skip by default - remove .skip to run integration tests
describe.skip('code-exec integration', () => {
  // ============================================
  // HEALTH CHECK
  // ============================================

  describe('health check', () => {
    it('Modal endpoint is available', async () => {
      const health = await checkCodeExecHealth()

      expect(health.available).toBe(true)
      expect(health.latency_ms).toBeDefined()
      expect(health.latency_ms).toBeLessThan(30000) // Should respond within 30s
    }, 60000) // 60s timeout for cold start
  })

  // ============================================
  // PYTHON EXECUTION
  // ============================================

  describe('Python execution', () => {
    it('executes simple print', async () => {
      const result = await executeCode({
        language: 'python',
        code: 'print("Hello from Modal!")',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('Hello from Modal!')
      expect(result.exit_code).toBe(0)
    }, 60000)

    it('executes with input data', async () => {
      const result = await executeCode({
        language: 'python',
        code: 'print(f"Input: {INPUT}")',
        input_data: 'test data 123',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('test data 123')
    }, 60000)

    it('handles special characters in input', async () => {
      const result = await executeCode({
        language: 'python',
        code: 'print(INPUT)',
        input_data: 'Line1\nLine2\t"quoted"\\\u0000',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(true)
      // Should contain escaped characters
      expect(result.stdout).toBeDefined()
    }, 60000)

    it('captures stderr', async () => {
      const result = await executeCode({
        language: 'python',
        code: `
import sys
print("stdout message")
print("stderr message", file=sys.stderr)
`,
        timeout_ms: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('stdout message')
      expect(result.stderr).toContain('stderr message')
    }, 60000)

    it('handles runtime errors', async () => {
      const result = await executeCode({
        language: 'python',
        code: 'raise ValueError("test error")',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(false)
      expect(result.exit_code).not.toBe(0)
      expect(result.stderr).toContain('ValueError')
    }, 60000)

    it('executes numpy code', async () => {
      const result = await executeCode({
        language: 'python',
        code: `
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f"Sum: {arr.sum()}")
print(f"Mean: {arr.mean()}")
`,
        timeout_ms: 15000,
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('Sum: 15')
      expect(result.stdout).toContain('Mean: 3.0')
    }, 60000)
  })

  // ============================================
  // JAVASCRIPT EXECUTION
  // ============================================

  describe('JavaScript execution', () => {
    it('executes simple console.log', async () => {
      const result = await executeCode({
        language: 'javascript',
        code: 'console.log("Hello from Node.js!")',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('Hello from Node.js!')
    }, 60000)

    it('executes with input data', async () => {
      const result = await executeCode({
        language: 'javascript',
        code: 'console.log(`Input: ${INPUT}`)',
        input_data: 'test data 456',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('test data 456')
    }, 60000)

    it('handles runtime errors', async () => {
      const result = await executeCode({
        language: 'javascript',
        code: 'throw new Error("test error")',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(false)
      expect(result.exit_code).not.toBe(0)
    }, 60000)
  })

  // ============================================
  // SECURITY TESTS
  // ============================================

  describe('security validation', () => {
    it('blocks dangerous Python patterns', async () => {
      // This should be blocked by the pattern detection before execution
      const result = await executeCode({
        language: 'python',
        code: '__import__("os")',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('DANGEROUS_CODE')
    }, 60000)

    it('blocks subprocess import', async () => {
      const result = await executeCode({
        language: 'python',
        code: 'import subprocess',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('DANGEROUS_CODE')
    }, 60000)

    it('blocks dangerous JavaScript patterns', async () => {
      const result = await executeCode({
        language: 'javascript',
        code: 'require("child_process")',
        timeout_ms: 10000,
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('DANGEROUS_CODE')
    }, 60000)
  })

  // ============================================
  // TIMEOUT TESTS
  // ============================================

  describe('timeout handling', () => {
    it('times out long-running Python code', async () => {
      const result = await executeCode({
        language: 'python',
        code: `
import time
time.sleep(60)  # Sleep for 60 seconds
`,
        timeout_ms: 5000, // 5 second timeout
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('TIMEOUT')
    }, 30000)

    it('times out infinite loop', async () => {
      const result = await executeCode({
        language: 'python',
        code: 'while True: pass',
        timeout_ms: 3000,
      })

      expect(result.success).toBe(false)
      expect(result.error_code).toBe('TIMEOUT')
    }, 30000)
  })

  // ============================================
  // RESOURCE LIMITS
  // ============================================

  describe('resource limits', () => {
    it('respects memory limit', async () => {
      // Try to allocate more memory than allowed
      const result = await executeCode({
        language: 'python',
        code: `
# Try to allocate large amount of memory
data = [0] * (1024 * 1024 * 1000)  # ~1GB
print(len(data))
`,
        memory_mb: 64, // Only 64MB allowed
        timeout_ms: 10000,
      })

      // Should fail due to memory limit
      expect(result.success).toBe(false)
    }, 60000)
  })
})
