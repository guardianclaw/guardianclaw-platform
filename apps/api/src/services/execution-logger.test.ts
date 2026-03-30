/**
 * Execution Logger Service Tests
 *
 * Unit tests for the execution logging service.
 * Tests status determination, trace formatting, and database interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  logExecution,
  logExecutionBatch,
  createLogInput,
  type LogExecutionInput,
  type EventSource,
} from './execution-logger'
import type { ExecutionResult, ExecutionTrace } from './execution'
import { generateUUID } from '../test/fixtures'

// ============================================
// MOCK STATE
// ============================================

const mockState = {
  rpcResult: { data: null as unknown, error: null as unknown },
}

// Reset mock state
function resetMockState() {
  mockState.rpcResult = { data: generateUUID(), error: null }
}

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(() => Promise.resolve(mockState.rpcResult)),
}

// ============================================
// TEST FIXTURES
// ============================================

function createSuccessResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    response: 'This is a successful response',
    blocked: false,
    latency_ms: 150,
    inputTokens: 50,
    outputTokens: 100,
    model: 'gpt-4o-mini',
    ...overrides,
  }
}

function createBlockedResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    response: null,
    blocked: true,
    stage: 'input',
    gate: 'avoidance',
    reason: 'Content flagged as potentially harmful',
    latency_ms: 50,
    ...overrides,
  }
}

function createErrorResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    response: null,
    blocked: false,
    latency_ms: 100,
    ...overrides,
  }
}

function createResultWithTrace(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  const trace: ExecutionTrace = {
    execution_id: generateUUID(),
    steps: [
      {
        step_id: generateUUID(),
        step_name: 'Input Validation',
        step_type: 'validation',
        category: 'claw',
        status: 'success',
        duration_ms: 10,
        metadata: { gate_type: 'credibility' },
      },
      {
        step_id: generateUUID(),
        step_name: 'LLM Processing',
        step_type: 'processing',
        category: 'llm',
        status: 'success',
        duration_ms: 100,
        metadata: { model: 'gpt-4o-mini', tokens: 150 },
      },
      {
        step_id: generateUUID(),
        step_name: 'Output Validation',
        step_type: 'validation',
        category: 'claw',
        status: 'success',
        duration_ms: 15,
      },
    ],
    total_duration_ms: 125,
  }

  return {
    response: 'Response with trace',
    blocked: false,
    trace,
    latency_ms: 125,
    ...overrides,
  }
}

function createResultWithTools(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    response: 'Response with tools',
    blocked: false,
    latency_ms: 200,
    toolResults: [
      { toolId: 'tool-1', success: true, result: { data: 'result1' } },
      { toolId: 'tool-2', success: true, result: { data: 'result2' } },
      { toolId: 'tool-3', success: false, result: null, error: 'Tool failed' },
    ],
    ...overrides,
  }
}

function createResultWithSocial(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    response: 'Response with social',
    blocked: false,
    latency_ms: 300,
    socialDeliveries: [
      { platform: 'discord', success: true, messageId: 'msg-1' },
      { platform: 'telegram', success: true, messageId: 'msg-2' },
      { platform: 'twitter', success: false, error: 'Rate limited' },
    ],
    ...overrides,
  }
}

function createLogExecutionInput(overrides: Partial<LogExecutionInput> = {}): LogExecutionInput {
  return {
    supabase: mockSupabase as unknown,
    agentId: generateUUID(),
    eventSource: 'invoke',
    inputText: 'Hello, how can you help me today?',
    result: createSuccessResult(),
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('Execution Logger Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
  })

  // ==========================================
  // Status Determination Tests
  // ==========================================

  describe('Status Determination', () => {
    it('should log successful execution with status "success"', async () => {
      const input = createLogExecutionInput({
        result: createSuccessResult(),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_status: 'success',
        })
      )
    })

    it('should log blocked execution with status "blocked"', async () => {
      const input = createLogExecutionInput({
        result: createBlockedResult(),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_status: 'blocked',
        })
      )
    })

    it('should log error execution when response is null and not blocked', async () => {
      const input = createLogExecutionInput({
        result: createErrorResult(),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_status: 'error',
        })
      )
    })
  })

  // ==========================================
  // Layer Mapping Tests
  // ==========================================

  describe('Layer Mapping', () => {
    it('should map "input" stage to L1', async () => {
      const input = createLogExecutionInput({
        result: createBlockedResult({ stage: 'input' }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_blocked_by_layer: 'L1',
        })
      )
    })

    it('should map "output" stage to L3', async () => {
      const input = createLogExecutionInput({
        result: createBlockedResult({ stage: 'output' }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_blocked_by_layer: 'L3',
        })
      )
    })

    it('should map "observer" stage to L4', async () => {
      const input = createLogExecutionInput({
        result: createBlockedResult({ stage: 'observer' }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_blocked_by_layer: 'L4',
        })
      )
    })

    it('should default unknown stages to L1', async () => {
      const input = createLogExecutionInput({
        result: createBlockedResult({ stage: 'unknown' }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_blocked_by_layer: 'L1',
        })
      )
    })
  })

  // ==========================================
  // Event Source Tests
  // ==========================================

  describe('Event Sources', () => {
    const eventSources: EventSource[] = ['invoke', 'conversation', 'webhook', 'test']

    eventSources.forEach((source) => {
      it(`should correctly log "${source}" event source`, async () => {
        const input = createLogExecutionInput({
          eventSource: source,
        })

        await logExecution(input)

        expect(mockSupabase.rpc).toHaveBeenCalledWith(
          'insert_execution_log',
          expect.objectContaining({
            p_event_source: source,
          })
        )
      })
    })

    it('should include conversation_id for conversation events', async () => {
      const conversationId = generateUUID()
      const input = createLogExecutionInput({
        eventSource: 'conversation',
        conversationId,
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_conversation_id: conversationId,
        })
      )
    })

    it('should include request_id for webhook events', async () => {
      const requestId = 'req_' + generateUUID()
      const input = createLogExecutionInput({
        eventSource: 'webhook',
        requestId,
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_request_id: requestId,
        })
      )
    })
  })

  // ==========================================
  // Preview Generation Tests
  // ==========================================

  describe('Preview Generation', () => {
    it('should truncate long input text to 100 characters', async () => {
      const longInput = 'A'.repeat(200)
      const input = createLogExecutionInput({
        inputText: longInput,
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_input_preview: 'A'.repeat(100) + '...',
        })
      )
    })

    it('should truncate long output text to 100 characters', async () => {
      const longOutput = 'B'.repeat(200)
      const input = createLogExecutionInput({
        result: createSuccessResult({ response: longOutput }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_output_preview: 'B'.repeat(100) + '...',
        })
      )
    })

    it('should not truncate short text', async () => {
      const shortInput = 'Hello'
      const input = createLogExecutionInput({
        inputText: shortInput,
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_input_preview: shortInput,
        })
      )
    })

    it('should handle null output for blocked executions', async () => {
      const input = createLogExecutionInput({
        result: createBlockedResult(),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_output_preview: null,
        })
      )
    })
  })

  // ==========================================
  // Trace Formatting Tests
  // ==========================================

  describe('Trace Formatting', () => {
    it('should include formatted trace in log', async () => {
      const input = createLogExecutionInput({
        result: createResultWithTrace(),
      })

      await logExecution(input)

      const call = mockSupabase.rpc.mock.calls[0]
      const params = call[1] as Record<string, unknown>
      const trace = JSON.parse(params.p_trace as string)

      expect(trace).toHaveLength(3)
      expect(trace[0]).toMatchObject({
        step_name: 'Input Validation',
        step_type: 'validation',
        status: 'success',
      })
    })

    it('should filter sensitive metadata from trace', async () => {
      const result = createResultWithTrace()
      // Add sensitive metadata that should be filtered
      result.trace!.steps[0].metadata = {
        gate_type: 'credibility', // Safe - should be included
        api_key: 'secret', // Sensitive - should be filtered
        password: 'secret', // Sensitive - should be filtered
      }

      const input = createLogExecutionInput({ result })

      await logExecution(input)

      const call = mockSupabase.rpc.mock.calls[0]
      const params = call[1] as Record<string, unknown>
      const trace = JSON.parse(params.p_trace as string)

      expect(trace[0].metadata).toHaveProperty('gate_type')
      expect(trace[0].metadata).not.toHaveProperty('api_key')
      expect(trace[0].metadata).not.toHaveProperty('password')
    })

    it('should handle missing trace gracefully', async () => {
      const input = createLogExecutionInput({
        result: createSuccessResult({ trace: undefined }),
      })

      await logExecution(input)

      const call = mockSupabase.rpc.mock.calls[0]
      const params = call[1] as Record<string, unknown>
      const trace = JSON.parse(params.p_trace as string)

      expect(trace).toEqual([])
    })
  })

  // ==========================================
  // Tool Counting Tests
  // ==========================================

  describe('Tool Counting', () => {
    it('should count tool executions correctly', async () => {
      const input = createLogExecutionInput({
        result: createResultWithTools(),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_tools_executed: 3,
          p_tools_succeeded: 2,
        })
      )
    })

    it('should handle zero tools', async () => {
      const input = createLogExecutionInput({
        result: createSuccessResult({ toolResults: [] }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_tools_executed: 0,
          p_tools_succeeded: 0,
        })
      )
    })

    it('should handle undefined tools', async () => {
      const input = createLogExecutionInput({
        result: createSuccessResult({ toolResults: undefined }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_tools_executed: 0,
          p_tools_succeeded: 0,
        })
      )
    })
  })

  // ==========================================
  // Social Counting Tests
  // ==========================================

  describe('Social Counting', () => {
    it('should count social deliveries correctly', async () => {
      const input = createLogExecutionInput({
        result: createResultWithSocial(),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_social_deliveries: 3,
          p_social_succeeded: 2,
        })
      )
    })

    it('should handle zero social deliveries', async () => {
      const input = createLogExecutionInput({
        result: createSuccessResult({ socialDeliveries: [] }),
      })

      await logExecution(input)

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'insert_execution_log',
        expect.objectContaining({
          p_social_deliveries: 0,
          p_social_succeeded: 0,
        })
      )
    })
  })

  // ==========================================
  // Error Handling Tests
  // ==========================================

  describe('Error Handling', () => {
    it('should return null on database error', async () => {
      mockState.rpcResult = {
        data: null,
        error: { message: 'Database error' },
      }

      const input = createLogExecutionInput()
      const result = await logExecution(input)

      expect(result).toBeNull()
    })

    it('should return null on exception', async () => {
      mockSupabase.rpc.mockRejectedValueOnce(new Error('Network error'))

      const input = createLogExecutionInput()
      const result = await logExecution(input)

      expect(result).toBeNull()
    })

    it('should not throw on error (non-blocking)', async () => {
      mockState.rpcResult = {
        data: null,
        error: { message: 'Database error' },
      }

      const input = createLogExecutionInput()

      await expect(logExecution(input)).resolves.not.toThrow()
    })
  })

  // ==========================================
  // Batch Logging Tests
  // ==========================================

  describe('Batch Logging', () => {
    it('should log multiple executions', async () => {
      const executions = [
        createLogInput(generateUUID(), 'invoke', 'Input 1', createSuccessResult()),
        createLogInput(generateUUID(), 'test', 'Input 2', createSuccessResult()),
        createLogInput(generateUUID(), 'webhook', 'Input 3', createBlockedResult()),
      ]

      const count = await logExecutionBatch(mockSupabase as unknown, executions)

      expect(count).toBe(3)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3)
    })

    it('should count only successful logs', async () => {
      // First succeeds, second fails, third succeeds
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: generateUUID(), error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Error' } })
        .mockResolvedValueOnce({ data: generateUUID(), error: null })

      const executions = [
        createLogInput(generateUUID(), 'invoke', 'Input 1', createSuccessResult()),
        createLogInput(generateUUID(), 'test', 'Input 2', createSuccessResult()),
        createLogInput(generateUUID(), 'webhook', 'Input 3', createSuccessResult()),
      ]

      const count = await logExecutionBatch(mockSupabase as unknown, executions)

      expect(count).toBe(2)
    })
  })

  // ==========================================
  // Helper Function Tests
  // ==========================================

  describe('createLogInput Helper', () => {
    it('should create valid log input', () => {
      const agentId = generateUUID()
      const result = createSuccessResult()

      const logInput = createLogInput(agentId, 'invoke', 'Test input', result)

      expect(logInput).toEqual({
        agentId,
        eventSource: 'invoke',
        inputText: 'Test input',
        result,
        conversationId: undefined,
        requestId: undefined,
      })
    })

    it('should include optional parameters', () => {
      const agentId = generateUUID()
      const conversationId = generateUUID()
      const requestId = 'req_123'
      const result = createSuccessResult()

      const logInput = createLogInput(agentId, 'conversation', 'Test', result, {
        conversationId,
        requestId,
      })

      expect(logInput.conversationId).toBe(conversationId)
      expect(logInput.requestId).toBe(requestId)
    })
  })

  // ==========================================
  // Return Value Tests
  // ==========================================

  describe('Return Values', () => {
    it('should return log ID on success', async () => {
      const expectedId = generateUUID()
      mockState.rpcResult = { data: expectedId, error: null }

      const input = createLogExecutionInput()
      const result = await logExecution(input)

      expect(result).toBe(expectedId)
    })
  })
})
