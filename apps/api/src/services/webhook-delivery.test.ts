/**
 * Webhook Delivery Service Tests
 *
 * Tests for outbound webhook delivery functionality including:
 * - Retry delay calculations
 * - Payload formatting
 * - Delivery execution
 * - Queue operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateRetryDelay,
  calculateNextAttemptAt,
  createDeliveryPayload,
  executeDelivery,
  DELIVERY_EVENT_TYPES,
} from './webhook-delivery'
import { generateWebhookSecret, createWebhookSignature } from '../lib/webhook-signature'
import {
  encryptNewWebhookSecret,
  encryptWebhookSecret,
  decryptWebhookSecret,
} from '../lib/webhook-crypto'

// ============================================
// RETRY DELAY TESTS
// ============================================

describe('calculateRetryDelay', () => {
  it('returns 0 for first attempt', () => {
    expect(calculateRetryDelay(1)).toBe(0)
  })

  it('returns 30s for second attempt', () => {
    expect(calculateRetryDelay(2)).toBe(30_000)
  })

  it('returns 2min for third attempt', () => {
    expect(calculateRetryDelay(3)).toBe(120_000)
  })

  it('returns 10min for fourth attempt', () => {
    expect(calculateRetryDelay(4)).toBe(600_000)
  })

  it('returns max delay for attempts beyond defined', () => {
    expect(calculateRetryDelay(5)).toBe(600_000)
    expect(calculateRetryDelay(10)).toBe(600_000)
    expect(calculateRetryDelay(100)).toBe(600_000)
  })

  it('returns 0 for invalid attempt numbers', () => {
    expect(calculateRetryDelay(0)).toBe(0)
    expect(calculateRetryDelay(-1)).toBe(0)
  })
})

describe('calculateNextAttemptAt', () => {
  it('returns immediate time for first attempt', () => {
    const before = Date.now()
    const result = calculateNextAttemptAt(1)
    const after = Date.now()

    // First attempt has 0 delay, so result should be very close to current time
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after + 1000) // Allow 1s margin for slow systems
  })

  it('returns future time for retries', () => {
    const now = Date.now()
    const result = calculateNextAttemptAt(2)

    expect(result.getTime()).toBeGreaterThanOrEqual(now + 29_000) // ~30s in future
    expect(result.getTime()).toBeLessThanOrEqual(now + 31_000)
  })
})

// ============================================
// PAYLOAD TESTS
// ============================================

describe('createDeliveryPayload', () => {
  it('creates properly formatted payload', () => {
    const payload = createDeliveryPayload(
      'agent.response',
      'agent-123',
      { response: 'Hello!' },
      'exec-456'
    )

    expect(payload.event_type).toBe('agent.response')
    expect(payload.agent_id).toBe('agent-123')
    expect(payload.execution_id).toBe('exec-456')
    expect(payload.data.response).toBe('Hello!')
    expect(payload.timestamp).toBeDefined()
    expect(new Date(payload.timestamp).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('handles missing execution_id', () => {
    const payload = createDeliveryPayload('agent.blocked', 'agent-123', {
      blocked: true,
      gate: 'avoidance',
    })

    expect(payload.execution_id).toBeUndefined()
    expect(payload.data.blocked).toBe(true)
    expect(payload.data.gate).toBe('avoidance')
  })

  it('includes all event-specific data', () => {
    const payload = createDeliveryPayload('agent.error', 'agent-789', {
      error: 'Something went wrong',
      latency_ms: 1500,
      metadata: { source: 'test' },
    })

    expect(payload.data.error).toBe('Something went wrong')
    expect(payload.data.latency_ms).toBe(1500)
    expect(payload.data.metadata).toEqual({ source: 'test' })
  })
})

describe('DELIVERY_EVENT_TYPES', () => {
  it('contains all expected event types', () => {
    expect(DELIVERY_EVENT_TYPES).toContain('agent.response')
    expect(DELIVERY_EVENT_TYPES).toContain('agent.blocked')
    expect(DELIVERY_EVENT_TYPES).toContain('agent.error')
    expect(DELIVERY_EVENT_TYPES).toContain('execution.started')
    expect(DELIVERY_EVENT_TYPES).toContain('execution.completed')
  })

  it('has exactly 5 event types', () => {
    expect(DELIVERY_EVENT_TYPES.length).toBe(5)
  })
})

// ============================================
// DELIVERY EXECUTION TESTS
// ============================================

describe('executeDelivery', () => {
  const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sends signed request with correct headers', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: { 'X-Custom': 'value' },
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', { response: 'Test' })

    let capturedHeaders: Headers | null = null
    let capturedBody: string | null = null

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      capturedHeaders = new Headers(options?.headers as HeadersInit)
      capturedBody = options?.body as string
      return new Response('{}', { status: 200 })
    })

    const result = await executeDelivery(endpoint, payload, serverSecret)

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(capturedHeaders?.get('Content-Type')).toBe('application/json')
    expect(capturedHeaders?.get('X-GuardianClaw-Signature')).toMatch(/^sha256=/)
    expect(capturedHeaders?.get('X-GuardianClaw-Timestamp')).toBeDefined()
    expect(capturedHeaders?.get('X-GuardianClaw-Agent-Id')).toBe('agent-123')
    expect(capturedHeaders?.get('X-Custom')).toBe('value')
    expect(capturedBody).toBe(JSON.stringify(payload))
  })

  it('returns success for 2xx responses', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: {},
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    // Test various 2xx status codes (excluding 204 which has body restrictions)
    for (const status of [200, 201, 202]) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status }))

      const result = await executeDelivery(endpoint, payload, serverSecret)
      expect(result.success).toBe(true)
      expect(result.status).toBe(status)
    }
  })

  it('returns failure for non-2xx responses', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: {},
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const result = await executeDelivery(endpoint, payload, serverSecret)

    expect(result.success).toBe(false)
    expect(result.status).toBe(404)
    expect(result.errorCode).toBe('HTTP_404')
    expect(result.errorMessage).toContain('404')
  })

  it('handles timeout errors', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: {},
      timeout_ms: 100, // Very short timeout
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    // Create an abort error
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

    const result = await executeDelivery(endpoint, payload, serverSecret)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('TIMEOUT')
    expect(result.errorMessage).toContain('timed out')
  })

  it('handles network errors', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: {},
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed: network error'))

    const result = await executeDelivery(endpoint, payload, serverSecret)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NETWORK_ERROR')
    expect(result.errorMessage).toContain('connect')
  })

  it('handles decryption errors', async () => {
    vi.useRealTimers()

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: 'invalid-encrypted-data',
      secret_iv: 'invalid-iv',
      headers: {},
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    const result = await executeDelivery(endpoint, payload, serverSecret)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('DECRYPT_ERROR')
  })

  it('includes response time in result', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: {},
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      // Simulate some delay
      await new Promise((r) => setTimeout(r, 50))
      return new Response('{}', { status: 200 })
    })

    const result = await executeDelivery(endpoint, payload, serverSecret)

    expect(result.success).toBe(true)
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(50)
  })

  it('verifies signature matches expected format', async () => {
    vi.useRealTimers()

    const secret = generateWebhookSecret()
    const { encrypted, iv } = await encryptNewWebhookSecret(secret, serverSecret)

    const endpoint = {
      id: 'endpoint-123',
      url: 'https://example.com/webhook',
      secret_encrypted: encrypted,
      secret_iv: iv,
      headers: {},
      timeout_ms: 30000,
      retry_count: 3,
      is_active: true,
    }

    const payload = createDeliveryPayload('agent.response', 'agent-123', {})

    let capturedHeaders: Headers | null = null
    let capturedBody: string | null = null

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      capturedHeaders = new Headers(options?.headers as HeadersInit)
      capturedBody = options?.body as string
      return new Response('{}', { status: 200 })
    })

    await executeDelivery(endpoint, payload, serverSecret)

    // Verify recipient could validate the signature
    const signature = capturedHeaders?.get('X-GuardianClaw-Signature')
    const timestamp = capturedHeaders?.get('X-GuardianClaw-Timestamp')

    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(timestamp).toMatch(/^\d+$/)

    // Compute expected signature and verify it matches
    const expectedSignature = await createWebhookSignature(
      capturedBody!,
      secret,
      parseInt(timestamp!)
    )
    expect(signature).toBe(expectedSignature)
  })
})

// ============================================
// PAYLOAD ENCRYPTION TESTS
// ============================================

describe('Payload encryption for retry storage', () => {
  const serverSecret = 'test-jwt-secret-with-minimum-32-chars!'

  it('encrypts and decrypts payload correctly', async () => {
    const payload = createDeliveryPayload(
      'agent.response',
      'agent-123',
      {
        response: 'Hello, this is a test response!',
        latency_ms: 150,
        metadata: { source: 'test' },
      },
      'exec-456'
    )

    // Encrypt
    const payloadString = JSON.stringify(payload)
    const { encrypted, iv } = await encryptWebhookSecret(payloadString, serverSecret)

    // Verify encrypted data is different from original
    expect(encrypted).not.toBe(payloadString)
    expect(iv).toBeDefined()

    // Decrypt
    const decryptedString = await decryptWebhookSecret(encrypted, iv, serverSecret)
    const decryptedPayload = JSON.parse(decryptedString)

    // Verify all fields are preserved
    expect(decryptedPayload.event_type).toBe(payload.event_type)
    expect(decryptedPayload.agent_id).toBe(payload.agent_id)
    expect(decryptedPayload.execution_id).toBe(payload.execution_id)
    expect(decryptedPayload.timestamp).toBe(payload.timestamp)
    expect(decryptedPayload.data.response).toBe(payload.data.response)
    expect(decryptedPayload.data.latency_ms).toBe(payload.data.latency_ms)
    expect(decryptedPayload.data.metadata).toEqual(payload.data.metadata)
  })

  it('produces unique ciphertext for same payload', async () => {
    const payload = createDeliveryPayload('agent.response', 'agent-123', {
      response: 'Same content',
    })

    const payloadString = JSON.stringify(payload)
    const result1 = await encryptWebhookSecret(payloadString, serverSecret)
    const result2 = await encryptWebhookSecret(payloadString, serverSecret)

    // Different IVs should produce different ciphertext
    expect(result1.iv).not.toBe(result2.iv)
    expect(result1.encrypted).not.toBe(result2.encrypted)

    // But both should decrypt to same value
    const decrypted1 = await decryptWebhookSecret(result1.encrypted, result1.iv, serverSecret)
    const decrypted2 = await decryptWebhookSecret(result2.encrypted, result2.iv, serverSecret)
    expect(decrypted1).toBe(decrypted2)
  })

  it('fails decryption with wrong server secret', async () => {
    const payload = createDeliveryPayload('agent.response', 'agent-123', {
      response: 'Sensitive data',
    })

    const payloadString = JSON.stringify(payload)
    const { encrypted, iv } = await encryptWebhookSecret(payloadString, serverSecret)

    // Try to decrypt with wrong key
    await expect(
      decryptWebhookSecret(encrypted, iv, 'wrong-server-secret-32-characters!!')
    ).rejects.toThrow()
  })

  it('handles large payloads', async () => {
    // Create a large response
    const largeResponse = 'x'.repeat(50000) // 50KB of data

    const payload = createDeliveryPayload('agent.response', 'agent-123', {
      response: largeResponse,
    })

    const payloadString = JSON.stringify(payload)
    const { encrypted, iv } = await encryptWebhookSecret(payloadString, serverSecret)
    const decrypted = await decryptWebhookSecret(encrypted, iv, serverSecret)
    const decryptedPayload = JSON.parse(decrypted)

    expect(decryptedPayload.data.response).toBe(largeResponse)
  })

  it('handles unicode and special characters', async () => {
    const payload = createDeliveryPayload('agent.response', 'agent-123', {
      response: '你好世界 🌍 مرحبا <script>alert("xss")</script>',
      metadata: { emoji: '🚀', special: '"quotes" & <brackets>' },
    })

    const payloadString = JSON.stringify(payload)
    const { encrypted, iv } = await encryptWebhookSecret(payloadString, serverSecret)
    const decrypted = await decryptWebhookSecret(encrypted, iv, serverSecret)
    const decryptedPayload = JSON.parse(decrypted)

    expect(decryptedPayload.data.response).toBe(payload.data.response)
    expect(decryptedPayload.data.metadata).toEqual(payload.data.metadata)
  })
})
