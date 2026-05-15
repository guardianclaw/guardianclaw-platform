/**
 * Test helper utilities
 * Provides JWT generation, request builders, and assertion helpers
 */

import { vi, expect } from 'vitest'
import * as jose from 'jose'
import type { Context } from 'hono'

// ============================================================================
// JWT Helpers
// ============================================================================

const TEST_JWT_SECRET = 'test-jwt-secret-with-minimum-32-chars!'

/**
 * Generate a valid JWT token for testing
 */
export async function generateTestToken(
  wallet: string,
  options: {
    plan?: 'free' | 'starter' | 'pro' | 'enterprise'
    expiresIn?: string
    issuer?: string
  } = {}
): Promise<string> {
  const { plan = 'free', expiresIn = '24h', issuer = 'guardianclaw.org' } = options

  const secret = new TextEncoder().encode(TEST_JWT_SECRET)

  const token = await new jose.SignJWT({ plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(wallet)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)

  return token
}

/**
 * Generate an expired JWT token
 */
export async function generateExpiredToken(wallet: string): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)

  const token = await new jose.SignJWT({ plan: 'free' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(wallet)
    .setIssuer('guardianclaw.org')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 86400) // 24 hours ago
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // 1 hour ago
    .sign(secret)

  return token
}

/**
 * Generate a token with wrong issuer
 */
export async function generateWrongIssuerToken(wallet: string): Promise<string> {
  const secret = new TextEncoder().encode(TEST_JWT_SECRET)

  const token = await new jose.SignJWT({ plan: 'free' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(wallet)
    .setIssuer('wrong-issuer.com')
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  return token
}

// ============================================================================
// Request Builders
// ============================================================================

export interface MockRequestOptions {
  method?: string
  path?: string
  headers?: Record<string, string>
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, string>
}

/**
 * Create a mock request for Hono testing
 */
export function createMockRequest(options: MockRequestOptions = {}): Request {
  const { method = 'GET', path = '/', headers = {}, body, query = {} } = options

  const url = new URL(path, 'https://api.test.guardianclaw.org')
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const init: RequestInit = {
    method,
    headers: new Headers(headers),
  }

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body)
    ;(init.headers as Headers).set('Content-Type', 'application/json')
  }

  return new Request(url.toString(), init)
}

/**
 * Create request with authentication
 */
export async function createAuthenticatedRequest(
  wallet: string,
  options: MockRequestOptions = {}
): Promise<Request> {
  const token = await generateTestToken(wallet)
  return createMockRequest({
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}

/**
 * Create request with API key
 */
export function createApiKeyRequest(apiKey: string, options: MockRequestOptions = {}): Request {
  return createMockRequest({
    ...options,
    headers: {
      ...options.headers,
      'X-API-Key': apiKey,
    },
  })
}

// ============================================================================
// Mock Environment
// ============================================================================

export interface MockEnv {
  ENVIRONMENT: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
  MODAL_RUNTIME_URL?: string
  MODAL_HEALTH_URL?: string
  MODAL_VALIDATE_INPUT_URL?: string
  MODAL_VALIDATE_OUTPUT_URL?: string
  OPENAI_API_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
}

/**
 * Create mock environment bindings
 */
export function createMockEnv(overrides: Partial<MockEnv> = {}): MockEnv {
  return {
    ENVIRONMENT: 'test',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWT_SECRET: 'test-supabase-jwt-secret-min-32-chars!',
    JWT_SECRET: TEST_JWT_SECRET,
    MODAL_RUNTIME_URL: 'https://test-modal.run/execute',
    ...overrides,
  }
}

// ============================================================================
// Response Assertions
// ============================================================================

/**
 * Assert response is JSON with expected status
 */
export async function assertJsonResponse(
  response: Response,
  expectedStatus: number
): Promise<unknown> {
  expect(response.status).toBe(expectedStatus)
  expect(response.headers.get('content-type')).toContain('application/json')
  return response.json()
}

/**
 * Assert error response format
 */
export async function assertErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError?: string
): Promise<{ error: string }> {
  const body = (await assertJsonResponse(response, expectedStatus)) as { error: string }
  expect(body).toHaveProperty('error')
  if (expectedError) {
    expect(body.error).toBe(expectedError)
  }
  return body
}

/**
 * Assert successful response with data
 */
export async function assertSuccessResponse<T = unknown>(
  response: Response,
  expectedStatus = 200
): Promise<T> {
  const body = await assertJsonResponse(response, expectedStatus)
  expect(body).not.toHaveProperty('error')
  return body as T
}

// ============================================================================
// Crypto Helpers
// ============================================================================

/**
 * Hash a string using SHA-256 (matching the API implementation)
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a mock Ed25519 signature (for testing only)
 */
export function generateMockSignature(): string {
  const bytes = new Uint8Array(64)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64')
}

// ============================================================================
// Time Helpers
// ============================================================================

/**
 * Create a date in the past
 */
export function pastDate(daysAgo: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date
}

/**
 * Create a date in the future
 */
export function futureDate(daysAhead: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return date
}

/**
 * Freeze time for consistent testing
 */
export function freezeTime(date: Date = new Date()): void {
  vi.useFakeTimers()
  vi.setSystemTime(date)
}

/**
 * Restore real time
 */
export function unfreezeTime(): void {
  vi.useRealTimers()
}

// ============================================================================
// Mock Hono Context
// ============================================================================

/**
 * Create a minimal mock Hono context for unit testing
 */
export function createMockContext(
  req: Request,
  env: MockEnv,
  params: Record<string, string> = {}
): Partial<Context> {
  const variables: Record<string, unknown> = {}

  return {
    req: {
      raw: req,
      method: req.method,
      url: req.url,
      header: (name: string) => req.headers.get(name),
      param: (name: string) => params[name],
      json: () => req.json(),
      query: (name: string) => new URL(req.url).searchParams.get(name),
    } as Context['req'],
    env,
    get: (key: string) => variables[key],
    set: (key: string, value: unknown) => {
      variables[key] = value
    },
    json: ((data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })) as Context['json'],
    text: ((data: string, status = 200) => new Response(data, { status })) as Context['text'],
    header: vi.fn(),
  }
}

// ============================================================================
// Validation Pattern Matchers
// ============================================================================

export const validationPatterns = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  wallet: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  apiKey: /^sk_live_[a-f0-9]{64}$/,
  jwtToken: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
}

/**
 * Assert value matches UUID pattern
 */
export function expectUUID(value: unknown): void {
  expect(value).toMatch(validationPatterns.uuid)
}

/**
 * Assert value is valid ISO date
 */
export function expectISODate(value: unknown): void {
  expect(value).toMatch(validationPatterns.isoDate)
}
