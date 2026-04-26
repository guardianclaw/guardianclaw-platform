/**
 * Webhook Delivery Service
 *
 * Handles outbound webhook delivery to configured endpoints.
 * Features:
 * - HMAC-SHA256 signing for payload authenticity
 * - Exponential backoff retry (immediate, 30s, 2m, 10m)
 * - Encrypted payload storage for secure retries
 * - Delivery tracking and statistics
 * - Error handling with sanitized messages
 *
 * @example
 * // Queue a delivery after agent execution
 * const delivery = await queueDelivery(supabase, serverSecret, {
 *   endpointId: 'ep-123',
 *   agentId: 'agent-456',
 *   executionId: 'exec-789',
 *   eventType: 'agent.response',
 *   payload: { ... }
 * })
 *
 * // Process pending deliveries (called by scheduled job)
 * await processPendingDeliveries(supabase, serverSecret)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createWebhookSignature, WEBHOOK_HEADERS } from '../lib/webhook-signature'
import { decryptWebhookSecret, encryptWebhookSecret } from '../lib/webhook-crypto'
import { checkUrlOrLog } from '../lib/ssrf-guard'
import { createSecureLogger } from '../lib/secure-logger'

// ============================================
// CONFIGURATION
// ============================================

/**
 * Retry delays in milliseconds.
 * Industry standard exponential backoff:
 * Attempt 1: Immediate
 * Attempt 2: 30 seconds
 * Attempt 3: 2 minutes
 * Attempt 4: 10 minutes
 */
const RETRY_DELAYS_MS = [
  0, // Attempt 1: immediate
  30_000, // Attempt 2: 30 seconds
  120_000, // Attempt 3: 2 minutes
  600_000, // Attempt 4: 10 minutes
]

/**
 * Maximum retry delay for any attempt beyond the defined ones.
 */
const MAX_RETRY_DELAY_MS = 600_000 // 10 minutes

/**
 * Default timeout for delivery requests.
 */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Event types that can be delivered.
 */
export const DELIVERY_EVENT_TYPES = [
  'agent.response', // Successful agent response
  'agent.blocked', // Response blocked by GuardianClaw
  'agent.error', // Execution error
  'execution.started', // Execution began
  'execution.completed', // Execution finished
] as const

export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number]

// ============================================
// TYPES
// ============================================

/**
 * Parameters for queuing a delivery.
 */
export interface QueueDeliveryParams {
  endpointId: string
  agentId: string
  executionId?: string
  eventType: DeliveryEventType
  payload: DeliveryPayload
}

/**
 * Standardized delivery payload format.
 */
export interface DeliveryPayload {
  event_type: DeliveryEventType
  agent_id: string
  execution_id?: string
  timestamp: string
  data: {
    response?: string
    blocked?: boolean
    gate?: string
    reason?: string
    error?: string
    latency_ms?: number
    metadata?: Record<string, unknown>
  }
}

/**
 * Result of a delivery attempt.
 */
export interface DeliveryResult {
  success: boolean
  status?: number
  responseTimeMs?: number
  errorCode?: string
  errorMessage?: string
}

/**
 * Endpoint data needed for delivery.
 */
interface EndpointData {
  id: string
  url: string
  secret_encrypted: string
  secret_iv: string
  headers: Record<string, string>
  timeout_ms: number
  retry_count: number
  is_active: boolean
}

/**
 * Delivery record from database.
 */
interface DeliveryRecord {
  id: string
  endpoint_id: string
  agent_id: string
  event_type: string
  attempts: number
  max_attempts: number
  payload_encrypted: string
  payload_iv: string
}

/**
 * Pending delivery from get_pending_deliveries RPC.
 */
interface PendingDeliveryRecord {
  delivery_id: string
  endpoint_id: string
  agent_id: string
  event_type: string
  attempts: number
  max_attempts: number
  payload_encrypted: string
  payload_iv: string
}

// ============================================
// RETRY LOGIC
// ============================================

/**
 * Calculate delay for next retry attempt.
 * Uses exponential backoff with defined steps.
 *
 * @param attempt - Current attempt number (1-indexed)
 * @returns Delay in milliseconds before next attempt
 */
export function calculateRetryDelay(attempt: number): number {
  if (attempt < 1) return 0
  const index = Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)
  // Use nullish coalescing to handle 0 correctly (0 is a valid delay)
  return RETRY_DELAYS_MS[index] ?? MAX_RETRY_DELAY_MS
}

/**
 * Calculate next attempt timestamp.
 *
 * @param attempt - Current attempt number (1-indexed)
 * @returns Date for next attempt
 */
export function calculateNextAttemptAt(attempt: number): Date {
  const delay = calculateRetryDelay(attempt)
  return new Date(Date.now() + delay)
}

// ============================================
// PAYLOAD HELPERS
// ============================================

/**
 * Create a standardized delivery payload.
 *
 * @param eventType - Type of event being delivered
 * @param agentId - Agent that generated the event
 * @param data - Event-specific data
 * @param executionId - Optional execution reference
 * @returns Formatted delivery payload
 */
export function createDeliveryPayload(
  eventType: DeliveryEventType,
  agentId: string,
  data: DeliveryPayload['data'],
  executionId?: string
): DeliveryPayload {
  return {
    event_type: eventType,
    agent_id: agentId,
    execution_id: executionId,
    timestamp: new Date().toISOString(),
    data,
  }
}

/**
 * Encrypt a payload for secure storage.
 *
 * @param payload - Payload to encrypt
 * @param serverSecret - Server secret for encryption
 * @returns Encrypted payload and IV
 */
async function encryptPayload(
  payload: DeliveryPayload,
  serverSecret: string
): Promise<{ encrypted: string; iv: string }> {
  const payloadString = JSON.stringify(payload)
  return encryptWebhookSecret(payloadString, serverSecret)
}

/**
 * Decrypt a stored payload.
 *
 * @param encrypted - Encrypted payload
 * @param iv - Initialization vector
 * @param serverSecret - Server secret for decryption
 * @returns Decrypted payload
 */
async function decryptPayload(
  encrypted: string,
  iv: string,
  serverSecret: string
): Promise<DeliveryPayload> {
  const payloadString = await decryptWebhookSecret(encrypted, iv, serverSecret)
  return JSON.parse(payloadString) as DeliveryPayload
}

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Queue a delivery for processing.
 * Creates a pending delivery record in the database with encrypted payload.
 *
 * @param supabase - Supabase client
 * @param serverSecret - Server secret for payload encryption
 * @param params - Delivery parameters
 * @returns Created delivery record or null on failure
 */
export async function queueDelivery(
  supabase: SupabaseClient,
  serverSecret: string,
  params: QueueDeliveryParams
): Promise<{ id: string; status: string } | null> {
  const { endpointId, agentId, executionId, eventType, payload } = params

  // Get endpoint to determine max_attempts and check filters
  const { data: endpoint, error: endpointError } = await supabase
    .from('webhook_endpoints')
    .select('retry_count, is_active, event_types')
    .eq('id', endpointId)
    .single()

  if (endpointError || !endpoint) {
    console.error('Failed to get endpoint for delivery:', endpointError)
    return null
  }

  // Skip if endpoint is inactive
  if (!endpoint.is_active) {
    return null
  }

  // Check event type filter (empty = deliver all)
  const eventTypes = (endpoint.event_types as string[]) || []
  if (eventTypes.length > 0 && !eventTypes.includes(eventType)) {
    return null
  }

  // Encrypt payload for secure storage
  const { encrypted: payloadEncrypted, iv: payloadIv } = await encryptPayload(payload, serverSecret)

  // Create delivery record with encrypted payload
  const { data: delivery, error: deliveryError } = await supabase
    .from('webhook_deliveries')
    .insert({
      endpoint_id: endpointId,
      agent_id: agentId,
      execution_id: executionId,
      event_type: eventType,
      payload_encrypted: payloadEncrypted,
      payload_iv: payloadIv,
      status: 'pending',
      attempts: 0,
      max_attempts: endpoint.retry_count + 1, // retry_count + initial attempt
      next_attempt_at: new Date().toISOString(),
    })
    .select('id, status')
    .single()

  if (deliveryError || !delivery) {
    console.error('Failed to create delivery record:', deliveryError)
    return null
  }

  return delivery
}

/**
 * Queue deliveries for all active endpoints of an agent.
 * Used after agent execution to notify all configured endpoints.
 *
 * @param supabase - Supabase client
 * @param serverSecret - Server secret for payload encryption
 * @param agentId - Agent that generated the event
 * @param eventType - Type of event
 * @param data - Event data
 * @param executionId - Optional execution reference
 * @returns Array of created delivery IDs
 */
export async function queueDeliveriesForAgent(
  supabase: SupabaseClient,
  serverSecret: string,
  agentId: string,
  eventType: DeliveryEventType,
  data: DeliveryPayload['data'],
  executionId?: string
): Promise<string[]> {
  // Get all active endpoints for this agent
  const { data: endpoints, error } = await supabase
    .from('webhook_endpoints')
    .select('id')
    .eq('agent_id', agentId)
    .eq('is_active', true)

  if (error || !endpoints || endpoints.length === 0) {
    return []
  }

  const payload = createDeliveryPayload(eventType, agentId, data, executionId)
  const deliveryIds: string[] = []

  // Queue delivery for each endpoint
  for (const endpoint of endpoints) {
    const delivery = await queueDelivery(supabase, serverSecret, {
      endpointId: endpoint.id,
      agentId,
      executionId,
      eventType,
      payload,
    })
    if (delivery) {
      deliveryIds.push(delivery.id)
    }
  }

  return deliveryIds
}

// ============================================
// DELIVERY EXECUTION
// ============================================

/**
 * Execute a single delivery attempt.
 * Signs the payload with HMAC-SHA256 and sends to endpoint URL.
 *
 * @param endpoint - Endpoint configuration
 * @param payload - Payload to deliver
 * @param serverSecret - Server secret for decryption
 * @returns Delivery result
 */
export async function executeDelivery(
  endpoint: EndpointData,
  payload: DeliveryPayload,
  serverSecret: string
): Promise<DeliveryResult> {
  const startTime = Date.now()

  // SSRF guard before each delivery — webhook_endpoints rows can be mutated
  // outside the schema-time validation in routes/webhook-endpoints.ts (direct
  // SQL, future migration paths, etc.), so re-check at the fetch boundary.
  {
    const logger = createSecureLogger()
    const urlCheck = await checkUrlOrLog(
      endpoint.url,
      { surface: 'webhook-delivery.executeDelivery' },
      logger
    )
    if (!urlCheck.valid) {
      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        errorCode: 'SSRF_BLOCKED',
        errorMessage: urlCheck.error || 'Endpoint URL is not allowed',
      }
    }
  }

  try {
    // Decrypt the endpoint secret for HMAC signing
    const secret = await decryptWebhookSecret(
      endpoint.secret_encrypted,
      endpoint.secret_iv,
      serverSecret
    )

    // Prepare payload
    const bodyString = JSON.stringify(payload)
    const timestamp = Math.floor(Date.now() / 1000)

    // Create HMAC signature
    const signature = await createWebhookSignature(bodyString, secret, timestamp)

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      [WEBHOOK_HEADERS.GCLAW_SIGNATURE]: signature,
      [WEBHOOK_HEADERS.GCLAW_TIMESTAMP]: timestamp.toString(),
      [WEBHOOK_HEADERS.GCLAW_AGENT_ID]: payload.agent_id,
      ...(endpoint.headers || {}),
    }

    if (payload.execution_id) {
      headers[WEBHOOK_HEADERS.GCLAW_DELIVERY_ID] = payload.execution_id
    }

    // Execute request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      endpoint.timeout_ms || DEFAULT_TIMEOUT_MS
    )

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const responseTimeMs = Date.now() - startTime

      // Consider 2xx as success
      if (response.ok) {
        return {
          success: true,
          status: response.status,
          responseTimeMs,
        }
      }

      // Non-2xx response
      return {
        success: false,
        status: response.status,
        responseTimeMs,
        errorCode: `HTTP_${response.status}`,
        errorMessage: `Endpoint returned status ${response.status}`,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          responseTimeMs,
          errorCode: 'TIMEOUT',
          errorMessage: `Request timed out after ${endpoint.timeout_ms || DEFAULT_TIMEOUT_MS}ms`,
        }
      }

      // Network errors
      if (error.message.includes('fetch')) {
        return {
          success: false,
          responseTimeMs,
          errorCode: 'NETWORK_ERROR',
          errorMessage: 'Failed to connect to endpoint',
        }
      }

      // Decryption failure
      if (error.message.includes('decrypt')) {
        return {
          success: false,
          responseTimeMs,
          errorCode: 'DECRYPT_ERROR',
          errorMessage: 'Failed to decrypt endpoint secret',
        }
      }

      return {
        success: false,
        responseTimeMs,
        errorCode: 'UNKNOWN_ERROR',
        errorMessage: error.message.slice(0, 200), // Truncate for safety
      }
    }

    return {
      success: false,
      responseTimeMs,
      errorCode: 'UNKNOWN_ERROR',
      errorMessage: 'Unknown error occurred',
    }
  }
}

// ============================================
// DELIVERY PROCESSING
// ============================================

/**
 * Process a single delivery: attempt delivery and update record.
 *
 * @param supabase - Supabase client
 * @param delivery - Delivery record with encrypted payload
 * @param endpoint - Endpoint configuration
 * @param serverSecret - Server secret for decryption
 * @returns Updated delivery status
 */
export async function processDelivery(
  supabase: SupabaseClient,
  delivery: DeliveryRecord,
  endpoint: EndpointData,
  serverSecret: string
): Promise<{ status: string; result: DeliveryResult }> {
  // Decrypt the stored payload
  let payload: DeliveryPayload
  try {
    payload = await decryptPayload(delivery.payload_encrypted, delivery.payload_iv, serverSecret)
  } catch (error) {
    // If decryption fails, mark as failed
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        error_code: 'PAYLOAD_DECRYPT_ERROR',
        error_message: 'Failed to decrypt stored payload',
        completed_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)

    return {
      status: 'failed',
      result: {
        success: false,
        errorCode: 'PAYLOAD_DECRYPT_ERROR',
        errorMessage: 'Failed to decrypt stored payload',
      },
    }
  }

  // Execute delivery
  const result = await executeDelivery(endpoint, payload, serverSecret)

  const newAttempts = delivery.attempts + 1
  const isLastAttempt = newAttempts >= delivery.max_attempts

  if (result.success) {
    // Success: mark completed
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'success',
        attempts: newAttempts,
        response_status: result.status,
        response_time_ms: result.responseTimeMs,
        completed_at: new Date().toISOString(),
        next_attempt_at: null,
      })
      .eq('id', delivery.id)

    // Update endpoint stats
    await supabase.rpc('update_endpoint_stats', {
      p_endpoint_id: endpoint.id,
      p_success: true,
    })

    return { status: 'success', result }
  }

  if (isLastAttempt) {
    // Failed: no more retries
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        attempts: newAttempts,
        response_status: result.status,
        response_time_ms: result.responseTimeMs,
        error_code: result.errorCode,
        error_message: result.errorMessage,
        completed_at: new Date().toISOString(),
        next_attempt_at: null,
      })
      .eq('id', delivery.id)

    // Update endpoint stats
    await supabase.rpc('update_endpoint_stats', {
      p_endpoint_id: endpoint.id,
      p_success: false,
    })

    return { status: 'failed', result }
  }

  // Schedule retry
  const nextAttemptAt = calculateNextAttemptAt(newAttempts + 1)

  await supabase
    .from('webhook_deliveries')
    .update({
      status: 'retrying',
      attempts: newAttempts,
      response_status: result.status,
      response_time_ms: result.responseTimeMs,
      error_code: result.errorCode,
      error_message: result.errorMessage,
      next_attempt_at: nextAttemptAt.toISOString(),
    })
    .eq('id', delivery.id)

  return { status: 'retrying', result }
}

/**
 * Process all pending deliveries.
 * Called by scheduled job to handle retries.
 *
 * @param supabase - Supabase client
 * @param serverSecret - Server secret for decryption
 * @param limit - Maximum deliveries to process
 * @returns Summary of processed deliveries
 */
export async function processPendingDeliveries(
  supabase: SupabaseClient,
  serverSecret: string,
  limit: number = 100
): Promise<{
  processed: number
  succeeded: number
  failed: number
  retrying: number
}> {
  const summary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retrying: 0,
  }

  // Get pending deliveries using the helper function (now includes payload)
  const { data: pendingDeliveries, error } = await supabase.rpc('get_pending_deliveries', {
    p_limit: limit,
  })

  if (error || !pendingDeliveries || pendingDeliveries.length === 0) {
    return summary
  }

  for (const pending of pendingDeliveries as PendingDeliveryRecord[]) {
    // Get endpoint details
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('id, url, secret_encrypted, secret_iv, headers, timeout_ms, retry_count, is_active')
      .eq('id', pending.endpoint_id)
      .single()

    if (endpointError || !endpoint || !endpoint.is_active) {
      // Mark as failed if endpoint not found or inactive
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          error_code: 'ENDPOINT_UNAVAILABLE',
          error_message: 'Endpoint not found or inactive',
          completed_at: new Date().toISOString(),
        })
        .eq('id', pending.delivery_id)
      summary.processed++
      summary.failed++
      continue
    }

    // Process delivery with encrypted payload from database
    const { status } = await processDelivery(
      supabase,
      {
        id: pending.delivery_id,
        endpoint_id: pending.endpoint_id,
        agent_id: pending.agent_id,
        event_type: pending.event_type,
        attempts: pending.attempts,
        max_attempts: pending.max_attempts,
        payload_encrypted: pending.payload_encrypted,
        payload_iv: pending.payload_iv,
      },
      endpoint as EndpointData,
      serverSecret
    )

    summary.processed++
    if (status === 'success') summary.succeeded++
    else if (status === 'failed') summary.failed++
    else if (status === 'retrying') summary.retrying++
  }

  return summary
}

// ============================================
// IMMEDIATE DELIVERY
// ============================================

/**
 * Attempt immediate delivery (no queueing).
 * Used for test deliveries and synchronous scenarios.
 *
 * @param supabase - Supabase client
 * @param endpointId - Endpoint to deliver to
 * @param agentId - Agent ID
 * @param serverSecret - Server secret for decryption
 * @returns Delivery result
 */
export async function deliverImmediately(
  supabase: SupabaseClient,
  endpointId: string,
  agentId: string,
  serverSecret: string
): Promise<DeliveryResult & { deliveryId?: string }> {
  // Get endpoint
  const { data: endpoint, error: endpointError } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret_encrypted, secret_iv, headers, timeout_ms, retry_count, is_active')
    .eq('id', endpointId)
    .single()

  if (endpointError || !endpoint) {
    return {
      success: false,
      errorCode: 'ENDPOINT_NOT_FOUND',
      errorMessage: 'Endpoint not found',
    }
  }

  if (!endpoint.is_active) {
    return {
      success: false,
      errorCode: 'ENDPOINT_INACTIVE',
      errorMessage: 'Endpoint is disabled',
    }
  }

  // Create test payload
  const payload = createDeliveryPayload('agent.response', agentId, {
    response: 'Test delivery from GuardianClaw',
    metadata: { test: true },
  })

  // Encrypt payload for storage
  const { encrypted: payloadEncrypted, iv: payloadIv } = await encryptPayload(payload, serverSecret)

  // Execute delivery
  const result = await executeDelivery(endpoint as EndpointData, payload, serverSecret)

  // Create delivery record for audit (with encrypted payload)
  const { data: delivery } = await supabase
    .from('webhook_deliveries')
    .insert({
      endpoint_id: endpointId,
      agent_id: agentId,
      event_type: 'agent.response',
      payload_encrypted: payloadEncrypted,
      payload_iv: payloadIv,
      status: result.success ? 'success' : 'failed',
      attempts: 1,
      max_attempts: 1,
      response_status: result.status,
      response_time_ms: result.responseTimeMs,
      error_code: result.errorCode,
      error_message: result.errorMessage,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  // Update endpoint stats
  await supabase.rpc('update_endpoint_stats', {
    p_endpoint_id: endpointId,
    p_success: result.success,
  })

  return {
    ...result,
    deliveryId: delivery?.id,
  }
}
