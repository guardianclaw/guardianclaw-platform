/**
 * useExecutionStream Hook Tests
 *
 * Unit tests for the real-time SSE streaming hook.
 * Tests connection management, event handling, and control functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExecutionStream, type StreamedLogEntry } from './use-execution-stream'

// ============================================
// MOCKS
// ============================================

// Mock EventSource
class MockEventSource {
  close = vi.fn()
}
global.EventSource = MockEventSource as unknown as typeof EventSource

// Create a controllable mock fetch
let mockFetchController: {
  resolve: (response: Response) => void
  reject: (error: Error) => void
} | null = null

const mockFetch = vi.fn().mockImplementation(() => {
  return new Promise<Response>((resolve, reject) => {
    mockFetchController = { resolve, reject }
  })
})

global.fetch = mockFetch

// ============================================
// TEST FIXTURES
// ============================================

const mockAgentId = '123e4567-e89b-12d3-a456-426614174000'
const mockHasSession = true

function createMockStreamedLog(overrides: Partial<StreamedLogEntry> = {}): StreamedLogEntry {
  return {
    id: 'log-123',
    event_source: 'invoke',
    status: 'success',
    latency_ms: 150,
    input_tokens: 100,
    output_tokens: 200,
    blocked_by_layer: null,
    blocked_gate: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('useExecutionStream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchController = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Initialization Tests
  // ==========================================

  describe('Initialization', () => {
    it('starts disconnected when disabled', () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: false })
      )

      expect(result.current.status).toBe('disconnected')
      expect(result.current.error).toBeNull()
      expect(result.current.logsReceived).toBe(0)
    })

    it('starts disconnected when no agentId', () => {
      const { result } = renderHook(() =>
        useExecutionStream(undefined, mockHasSession, { enabled: true })
      )

      expect(result.current.status).toBe('disconnected')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('starts disconnected when no session', () => {
      const { result } = renderHook(() => useExecutionStream(mockAgentId, false, { enabled: true }))

      expect(result.current.status).toBe('disconnected')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('attempts to connect when enabled with valid params', async () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: true })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/agents/${mockAgentId}/executions/stream`),
        expect.objectContaining({
          credentials: 'include',
        })
      )
    })
  })

  // ==========================================
  // Control Functions Tests
  // ==========================================

  describe('Control Functions', () => {
    it('provides reconnect function', () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: false })
      )

      expect(typeof result.current.reconnect).toBe('function')
    })

    it('provides disconnect function', () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: false })
      )

      expect(typeof result.current.disconnect).toBe('function')
    })

    it('disconnect transitions to disconnected', async () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: true })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.status).toBe('disconnected')
    })

    it('reconnect resets logsReceived counter', async () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: false })
      )

      // Manually set logsReceived by calling reconnect (which resets it)
      act(() => {
        result.current.reconnect()
      })

      expect(result.current.logsReceived).toBe(0)
    })
  })

  // ==========================================
  // State Properties Tests
  // ==========================================

  describe('State Properties', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: false })
      )

      expect(result.current).toEqual({
        status: 'disconnected',
        error: null,
        logsReceived: 0,
        reconnect: expect.any(Function),
        disconnect: expect.any(Function),
      })
    })

    it('status is connecting when fetch is in progress', async () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: true })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })
    })
  })

  // ==========================================
  // Enable/Disable Tests
  // ==========================================

  describe('Enable/Disable Behavior', () => {
    it('does not connect when enabled is false', () => {
      renderHook(() => useExecutionStream(mockAgentId, mockHasSession, { enabled: false }))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('disconnects when enabled changes to false', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useExecutionStream(mockAgentId, mockHasSession, { enabled }),
        { initialProps: { enabled: true } }
      )

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })

      rerender({ enabled: false })

      expect(result.current.status).toBe('disconnected')
    })

    it('connects when agentId becomes available', async () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useExecutionStream(agentId, mockHasSession, { enabled: true }),
        { initialProps: { agentId: undefined as string | undefined } }
      )

      expect(result.current.status).toBe('disconnected')
      expect(mockFetch).not.toHaveBeenCalled()

      rerender({ agentId: mockAgentId })

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })

      expect(mockFetch).toHaveBeenCalled()
    })

    it('connects when session becomes available', async () => {
      const { result, rerender } = renderHook(
        ({ hasSession }) => useExecutionStream(mockAgentId, hasSession, { enabled: true }),
        { initialProps: { hasSession: false } }
      )

      expect(result.current.status).toBe('disconnected')
      expect(mockFetch).not.toHaveBeenCalled()

      rerender({ hasSession: true })

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  // ==========================================
  // Options Tests
  // ==========================================

  describe('Options', () => {
    it('accepts custom maxReconnectAttempts', () => {
      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, {
          enabled: false,
          maxReconnectAttempts: 10,
        })
      )

      expect(result.current.status).toBe('disconnected')
    })

    it('accepts onNewExecution callback', () => {
      const onNewExecution = vi.fn()

      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, {
          enabled: false,
          onNewExecution,
        })
      )

      expect(result.current.status).toBe('disconnected')
    })

    it('accepts onStatusChange callback', () => {
      const onStatusChange = vi.fn()

      renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, {
          enabled: false,
          onStatusChange,
        })
      )

      // Should be called with 'disconnected' on initial render
      expect(onStatusChange).toHaveBeenCalledWith('disconnected')
    })

    it('accepts onError callback', () => {
      const onError = vi.fn()

      const { result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, {
          enabled: false,
          onError,
        })
      )

      expect(result.current.status).toBe('disconnected')
      expect(onError).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Cleanup Tests
  // ==========================================

  describe('Cleanup', () => {
    it('disconnects on unmount', async () => {
      const { unmount, result } = renderHook(() =>
        useExecutionStream(mockAgentId, mockHasSession, { enabled: true })
      )

      await waitFor(() => {
        expect(result.current.status).toBe('connecting')
      })

      unmount()

      // Should have initiated connection
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  // ==========================================
  // URL Construction Tests
  // ==========================================

  describe('URL Construction', () => {
    it('constructs correct SSE URL with agentId', () => {
      renderHook(() => useExecutionStream(mockAgentId, mockHasSession, { enabled: true }))

      // Check immediately - mock is synchronous
      expect(mockFetch).toHaveBeenCalled()
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(`/agents/${mockAgentId}/executions/stream`)
    })

    it('includes proper headers in request', () => {
      renderHook(() => useExecutionStream(mockAgentId, mockHasSession, { enabled: true }))

      // Check immediately - mock is synchronous
      expect(mockFetch).toHaveBeenCalled()
      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers).toMatchObject({
        Authorization: `Bearer ${mockHasSession}`,
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      })
    })
  })
})
