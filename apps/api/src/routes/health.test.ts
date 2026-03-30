/**
 * Health routes unit tests
 * Tests: GET /health, GET /health/ready
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { healthRoutes } from './health'
import { resetEnvValidation } from '../lib/env-validation'

// Create test app
const app = new Hono()
app.route('/health', healthRoutes)

beforeEach(() => {
  // Reset env validation cache between tests
  resetEnvValidation()
})

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await app.request('/health')

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('healthy')
    })

    it('includes timestamp in ISO format', async () => {
      const res = await app.request('/health')
      const body = await res.json()

      expect(body.timestamp).toBeDefined()
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('includes version number', async () => {
      const res = await app.request('/health')
      const body = await res.json()

      expect(body.version).toBe('3.0.0')
    })

    it('returns correct content-type', async () => {
      const res = await app.request('/health')

      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('GET /health/ready', () => {
    it('reports degraded when env vars are missing', async () => {
      // Test app has no env bindings, so env validation fails
      const res = await app.request('/health/ready')

      expect(res.status).toBe(503)

      const body = await res.json()
      expect(body.status).toBe('unavailable')
      expect(body.checks.env).toBe('fail')
      expect(body.checks.api).toBe('ok')
    })

    it('includes checks object', async () => {
      const res = await app.request('/health/ready')
      const body = await res.json()

      expect(body.checks).toBeDefined()
      expect(body.checks.api).toBe('ok')
    })

    it('reports missing env vars', async () => {
      const res = await app.request('/health/ready')
      const body = await res.json()

      expect(body.missing_env).toBeDefined()
      expect(body.missing_env.length).toBeGreaterThan(0)
    })
  })
})
