/**
 * useExecutionStream Hook
 *
 * Provides real-time streaming of execution logs via Server-Sent Events.
 * Handles connection management, reconnection with backoff, and event parsing.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { API_URL } from '@/lib/api'

/**
 * Minimal log entry received from SSE stream
 */
export interface StreamedLogEntry {
  id: string
  event_source: 'invoke' | 'conversation' | 'webhook' | 'test'
  status: 'success' | 'blocked' | 'error'
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  blocked_by_layer: 'L1' | 'L3' | 'L4' | null
  blocked_gate: string | null
  created_at: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface UseExecutionStreamOptions {
  /** Whether the stream should be active. Defaults to true. */
  enabled?: boolean
  /** Callback fired when a new execution log is received */
  onNewExecution?: (log: StreamedLogEntry) => void
  /** Callback fired on connection status change */
  onStatusChange?: (status: ConnectionStatus) => void
  /** Callback fired on error */
  onError?: (error: string) => void
  /** Maximum reconnection attempts before giving up. Defaults to 5. */
  maxReconnectAttempts?: number
}

export interface UseExecutionStreamResult {
  /** Current connection status */
  status: ConnectionStatus
  /** Last error message if any */
  error: string | null
  /** Number of logs received in current session */
  logsReceived: number
  /** Manually reconnect the stream */
  reconnect: () => void
  /** Manually disconnect the stream */
  disconnect: () => void
}

/**
 * Hook for streaming execution logs in real-time via SSE.
 *
 * Auth rides on the httpOnly `claw_session` cookie — fetch sends
 * `credentials: 'include'` so the browser attaches it to the streaming
 * request. Callers gate the hook on a boolean session flag rather than
 * threading the JWT through the call site.
 *
 * @param agentId - The agent ID to stream logs for
 * @param hasSession - Whether the user has an active session
 * @param options - Configuration options
 * @returns Stream state and control functions
 */
export function useExecutionStream(
  agentId: string | undefined,
  hasSession: boolean,
  options: UseExecutionStreamOptions = {}
): UseExecutionStreamResult {
  const {
    enabled = true,
    onNewExecution,
    onStatusChange,
    onError,
    maxReconnectAttempts = 5,
  } = options

  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [logsReceived, setLogsReceived] = useState(0)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastEventIdRef = useRef<string | null>(null)
  const seenLogIdsRef = useRef(new Set<string>())

  // Update status and notify callback
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus)
      onStatusChange?.(newStatus)
    },
    [onStatusChange]
  )

  // Calculate backoff delay for reconnection
  const getBackoffDelay = useCallback((attempt: number): number => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 16s)
    return Math.min(1000 * Math.pow(2, attempt), 16000)
  }, [])

  // Close existing connection
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!agentId || !hasSession || !enabled) {
      return
    }

    closeConnection()
    updateStatus('connecting')
    setError(null)

    // EventSource doesn't expose custom headers, so we run our own fetch-based
    // SSE reader against the same endpoint. The httpOnly session cookie is
    // attached automatically via `credentials: 'include'`.
    const url = new URL(`${API_URL}/agents/${agentId}/executions/stream`)

    const abortController = new AbortController()

    const fetchSSE = async () => {
      try {
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        }

        if (lastEventIdRef.current) {
          headers['Last-Event-ID'] = lastEventIdRef.current
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'include',
          headers,
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('Response body is null')
        }

        updateStatus('connected')
        reconnectAttemptsRef.current = 0

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // Stream ended - may need to reconnect
            break
          }

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE format
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          let currentEvent: { event?: string; data?: string; id?: string } = {}

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent.event = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              currentEvent.data = line.slice(5).trim()
            } else if (line.startsWith('id:')) {
              currentEvent.id = line.slice(3).trim()
              lastEventIdRef.current = currentEvent.id
            } else if (line === '') {
              // Empty line signals end of event
              if (currentEvent.data) {
                try {
                  const parsed = JSON.parse(currentEvent.data)

                  if (currentEvent.event === 'execution') {
                    const entry = parsed as StreamedLogEntry
                    // Deduplicate logs (handles reconnection overlap)
                    if (!seenLogIdsRef.current.has(entry.id)) {
                      seenLogIdsRef.current.add(entry.id)
                      // Keep set bounded to last 200 entries
                      if (seenLogIdsRef.current.size > 200) {
                        const oldest = seenLogIdsRef.current.values().next().value
                        if (oldest) seenLogIdsRef.current.delete(oldest)
                      }
                      setLogsReceived((prev) => prev + 1)
                      onNewExecution?.(entry)
                    }
                  } else if (currentEvent.event === 'close') {
                    // Server requested close, reconnect if allowed
                    if (parsed.reconnect) {
                      throw new Error('Server requested reconnect')
                    }
                  }
                  // heartbeat events are silently ignored
                } catch (parseError) {
                  console.error('SSE parse error:', parseError)
                }
              }
              currentEvent = {}
            }
          }
        }

        // Stream ended normally - attempt reconnect
        updateStatus('disconnected')
        scheduleReconnect()
      } catch (err) {
        if (abortController.signal.aborted) {
          // Intentional disconnect
          return
        }

        const errorMessage = err instanceof Error ? err.message : 'Connection failed'
        console.error('SSE error:', errorMessage)
        setError(errorMessage)
        onError?.(errorMessage)
        updateStatus('error')
        scheduleReconnect()
      }
    }

    // Store abort controller for cleanup
    eventSourceRef.current = { close: () => abortController.abort() } as EventSource

    fetchSSE()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, hasSession, enabled, closeConnection, updateStatus, onNewExecution, onError])

  // Schedule reconnection with backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError('Max reconnection attempts reached')
      updateStatus('error')
      return
    }

    const delay = getBackoffDelay(reconnectAttemptsRef.current)
    reconnectAttemptsRef.current++

    reconnectTimeoutRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [maxReconnectAttempts, getBackoffDelay, connect, updateStatus])

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    lastEventIdRef.current = null
    setLogsReceived(0)
    connect()
  }, [connect])

  // Manual disconnect
  const disconnect = useCallback(() => {
    closeConnection()
    updateStatus('disconnected')
  }, [closeConnection, updateStatus])

  // Setup and cleanup effect
  useEffect(() => {
    if (enabled && agentId && hasSession) {
      connect()
    } else {
      closeConnection()
      updateStatus('disconnected')
    }

    return () => {
      closeConnection()
    }
  }, [enabled, agentId, hasSession, connect, closeConnection, updateStatus])

  return {
    status,
    error,
    logsReceived,
    reconnect,
    disconnect,
  }
}
