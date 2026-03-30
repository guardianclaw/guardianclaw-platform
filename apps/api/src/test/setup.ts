/**
 * Global test setup for GuardianClaw API
 * Configures environment and polyfills for Cloudflare Workers testing
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest'

// Mock environment variables for tests
beforeAll(() => {
  // Set test environment variables
  process.env.ENVIRONMENT = 'test'
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
  process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-chars!'
})

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks()
})

afterAll(() => {
  // Restore all mocks after all tests
  vi.restoreAllMocks()
})

// Global test timeout (10 seconds)
vi.setConfig({ testTimeout: 10000 })
