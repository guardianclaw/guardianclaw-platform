/**
 * Execution Logger Service
 *
 * Provides centralized logging for agent executions.
 * Captures execution trace, metrics, and preview data for debugging.
 *
 * Design: This service is called after execution completes to persist logs.
 * It extracts relevant data from ExecutionResult and stores it in execution_logs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExecutionResult,
  ExecutionTrace,
  ExecutionStepTrace,
  ToolExecutionResult,
  SocialDeliveryStatus,
} from './execution'

// Event source types
export type EventSource = 'invoke' | 'conversation' | 'webhook' | 'test'

// Execution status derived from result
export type ExecutionStatus = 'success' | 'blocked' | 'error'

// Input for logging an execution
export interface LogExecutionInput {
  supabase: SupabaseClient
  agentId: string
  eventSource: EventSource
  conversationId?: string
  inputText: string
  result: ExecutionResult
  requestId?: string
}

// Preview length for input/output (characters)
const PREVIEW_LENGTH = 100

/**
 * Create a preview string (first N characters)
 */
function createPreview(
  text: string | null | undefined,
  length: number = PREVIEW_LENGTH
): string | null {
  if (!text) return null
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

/**
 * Determine execution status from result
 */
function getExecutionStatus(result: ExecutionResult): ExecutionStatus {
  if (result.blocked) {
    return 'blocked'
  }
  if (result.response === null && !result.blocked) {
    // No response but not blocked = error
    return 'error'
  }
  return 'success'
}

/**
 * Map stage to layer for blocked executions
 */
function mapStageToLayer(stage?: string): 'L1' | 'L3' | 'L4' | null {
  if (!stage) return null

  switch (stage) {
    case 'input':
      return 'L1'
    case 'output':
      return 'L3'
    case 'observer':
      return 'L4'
    default:
      return 'L1'
  }
}

/**
 * Format trace for storage
 * Ensures consistent structure and removes any sensitive data
 */
function formatTrace(trace?: ExecutionTrace): ExecutionStepTrace[] {
  if (!trace?.steps) return []

  return trace.steps.map((step) => ({
    step_id: step.step_id,
    step_name: step.step_name,
    step_type: step.step_type,
    category: step.category,
    status: step.status,
    duration_ms: step.duration_ms,
    error: step.error,
    // Filter metadata to only include safe fields
    metadata: step.metadata ? filterMetadata(step.metadata) : undefined,
  }))
}

/**
 * Filter metadata to remove any potentially sensitive data
 */
function filterMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safeKeys = [
    'node_type',
    'gate_type',
    'model',
    'tokens',
    'latency_ms',
    'tool_type',
    'success',
    'error_code',
  ]

  const filtered: Record<string, unknown> = {}
  for (const key of safeKeys) {
    if (key in metadata) {
      filtered[key] = metadata[key]
    }
  }
  return filtered
}

/**
 * Count tool execution results
 */
function countToolResults(toolResults?: ToolExecutionResult[]): {
  executed: number
  succeeded: number
} {
  if (!toolResults || toolResults.length === 0) {
    return { executed: 0, succeeded: 0 }
  }

  return {
    executed: toolResults.length,
    succeeded: toolResults.filter((r) => r.success).length,
  }
}

/**
 * Count social delivery results
 */
function countSocialResults(deliveries?: SocialDeliveryStatus[]): {
  executed: number
  succeeded: number
} {
  if (!deliveries || deliveries.length === 0) {
    return { executed: 0, succeeded: 0 }
  }

  return {
    executed: deliveries.length,
    succeeded: deliveries.filter((d) => d.success).length,
  }
}

/**
 * Log an execution to the database
 *
 * This is the main entry point for logging executions.
 * Call this after each execution completes (success, blocked, or error).
 */
export async function logExecution(input: LogExecutionInput): Promise<string | null> {
  const { supabase, agentId, eventSource, conversationId, inputText, result, requestId } = input

  const status = getExecutionStatus(result)
  const toolCounts = countToolResults(result.toolResults)
  const socialCounts = countSocialResults(result.socialDeliveries)

  try {
    const { data, error } = await supabase.rpc('insert_execution_log', {
      p_agent_id: agentId,
      p_event_source: eventSource,
      p_conversation_id: conversationId || null,
      p_status: status,
      p_input_preview: createPreview(inputText),
      p_output_preview: createPreview(result.response),
      p_latency_ms: result.latency_ms || null,
      p_input_tokens: result.inputTokens || null,
      p_output_tokens: result.outputTokens || null,
      p_blocked_by_layer: result.blocked ? mapStageToLayer(result.stage) : null,
      p_blocked_gate: result.gate || null,
      p_blocked_reason: result.reason || null,
      p_trace: JSON.stringify(formatTrace(result.trace)),
      p_tools_executed: toolCounts.executed,
      p_tools_succeeded: toolCounts.succeeded,
      p_social_deliveries: socialCounts.executed,
      p_social_succeeded: socialCounts.succeeded,
      p_model: result.model || null,
      p_request_id: requestId || null,
    })

    if (error) {
      // Log error but don't fail the main execution
      console.error('Failed to log execution:', error)
      return null
    }

    return data as string
  } catch (err) {
    // Log error but don't fail the main execution
    console.error('Exception logging execution:', err)
    return null
  }
}

/**
 * Batch log multiple executions (for bulk operations)
 */
export async function logExecutionBatch(
  supabase: SupabaseClient,
  executions: Array<Omit<LogExecutionInput, 'supabase'>>
): Promise<number> {
  let successCount = 0

  for (const execution of executions) {
    const logId = await logExecution({ ...execution, supabase })
    if (logId) successCount++
  }

  return successCount
}

/**
 * Helper to create log input from common execution context
 */
export function createLogInput(
  agentId: string,
  eventSource: EventSource,
  inputText: string,
  result: ExecutionResult,
  options?: {
    conversationId?: string
    requestId?: string
  }
): Omit<LogExecutionInput, 'supabase'> {
  return {
    agentId,
    eventSource,
    inputText,
    result,
    conversationId: options?.conversationId,
    requestId: options?.requestId,
  }
}
