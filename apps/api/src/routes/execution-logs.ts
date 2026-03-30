/**
 * Execution Logs Routes
 *
 * Provides endpoints for querying and managing agent execution logs.
 * Supports pagination, filtering, and health statistics.
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const executionLogsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware
executionLogsRoutes.use('*', authMiddleware)
executionLogsRoutes.use('*', walletRateLimitMiddleware())

// Validation schemas
const uuidSchema = z.string().uuid('Invalid UUID format')

const logsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).max(10000).default(0),
  status: z.enum(['success', 'blocked', 'error']).optional(),
  event_source: z.enum(['invoke', 'conversation', 'webhook', 'test']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
})

const exportQuerySchema = z.object({
  days: z.coerce.number().min(1).max(90).default(7),
})

const deleteQuerySchema = z.object({
  before: z.string().datetime().optional(),
})

// Response types
interface ExecutionLogEntry {
  id: string
  event_source: string
  conversation_id: string | null
  status: 'success' | 'blocked' | 'error'
  input_preview: string | null
  output_preview: string | null
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  blocked_by_layer: 'L1' | 'L3' | 'L4' | null
  blocked_gate: string | null
  blocked_reason: string | null
  trace: ExecutionStep[]
  tools_executed: number
  tools_succeeded: number
  social_deliveries: number
  social_succeeded: number
  model: string | null
  request_id: string | null
  created_at: string
}

interface ExecutionStep {
  step_id: string
  step_name: string
  step_type: string
  category: string
  status: 'success' | 'error' | 'skipped'
  duration_ms: number
  error?: string
  metadata?: Record<string, unknown>
}

interface LogsResponse {
  logs: ExecutionLogEntry[]
  total: number
  limit: number
  offset: number
}

/**
 * GET /agents/:agentId/executions
 * Get paginated execution logs for an agent
 */
executionLogsRoutes.get('/:agentId/executions', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  // Parse query params
  const queryResult = logsQuerySchema.safeParse(c.req.query())
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, 400)
  }

  const { limit, offset, status, event_source, start_date, end_date } = queryResult.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get logs using RPC function
  const { data: logs, error: logsError } = await supabase.rpc('get_execution_logs', {
    p_agent_id: agentId,
    p_limit: limit,
    p_offset: offset,
    p_status: status || null,
    p_event_source: event_source || null,
    p_start_date: start_date || null,
    p_end_date: end_date || null,
  })

  if (logsError) {
    console.error('Failed to get execution logs:', logsError)
    return c.json({ error: 'Failed to fetch logs' }, 500)
  }

  // Get total count for pagination
  const { data: countResult, error: countError } = await supabase.rpc('get_execution_logs_count', {
    p_agent_id: agentId,
    p_status: status || null,
    p_event_source: event_source || null,
    p_start_date: start_date || null,
    p_end_date: end_date || null,
  })

  if (countError) {
    console.error('Failed to get logs count:', countError)
    // Continue without total count
  }

  const response: LogsResponse = {
    logs: logs || [],
    total: countResult || 0,
    limit,
    offset,
  }

  return c.json(response)
})

/**
 * GET /agents/:agentId/executions/export
 * Export execution logs as JSON
 * NOTE: This route MUST be defined before /:logId to avoid route conflicts
 */
executionLogsRoutes.get('/:agentId/executions/export', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  // Validate query params
  const queryResult = exportQuerySchema.safeParse(c.req.query())
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, 400)
  }

  const { days } = queryResult.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get all logs within date range (max 1000)
  const { data: logs, error: logsError } = await supabase
    .from('execution_logs')
    .select('*')
    .eq('agent_id', agentId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(1000)

  if (logsError) {
    console.error('Failed to export logs:', logsError)
    return c.json({ error: 'Failed to export logs' }, 500)
  }

  // Return as JSON with metadata
  const exportData = {
    agent_id: agentId,
    agent_name: agent.name,
    exported_at: new Date().toISOString(),
    date_range: {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
    },
    total_logs: logs?.length || 0,
    logs: logs || [],
  }

  // Set headers for file download
  c.header('Content-Type', 'application/json')
  c.header(
    'Content-Disposition',
    `attachment; filename="execution-logs-${agentId}-${new Date().toISOString().split('T')[0]}.json"`
  )

  return c.json(exportData)
})

/**
 * GET /agents/:agentId/executions/stream
 * Server-Sent Events stream for real-time execution log updates.
 *
 * Supports reconnection via Last-Event-ID header.
 * Sends new executions as they occur, with heartbeats every 30 seconds.
 *
 * NOTE: This route MUST be defined before /:logId to avoid route conflicts
 */
executionLogsRoutes.get('/:agentId/executions/stream', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership before starting stream
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get last event ID for reconnection support
  // Event ID is now log.id (UUID). On reconnection, look up the timestamp.
  const lastEventId = c.req.header('Last-Event-ID')
  let lastSeenTimestamp: string
  let isReconnecting = false

  if (lastEventId) {
    isReconnecting = true
    // Last-Event-ID is a log UUID — look up its created_at
    const { data: lastLog } = await supabase
      .from('execution_logs')
      .select('created_at')
      .eq('id', lastEventId)
      .single()

    if (lastLog) {
      // Go back 5 seconds to catch logs with identical or near-identical timestamps
      const ts = new Date(lastLog.created_at)
      ts.setSeconds(ts.getSeconds() - 5)
      lastSeenTimestamp = ts.toISOString()
    } else {
      // Fallback: go back 60 seconds from now
      lastSeenTimestamp = new Date(Date.now() - 60_000).toISOString()
    }
  } else {
    lastSeenTimestamp = new Date().toISOString()
  }

  return streamSSE(c, async (stream) => {
    let _eventId = 0
    let lastHeartbeat = Date.now()

    // Limit stream duration to 5 minutes to prevent resource leaks
    const maxDuration = 5 * 60 * 1000
    const startTime = Date.now()

    // Polling loop
    while (Date.now() - startTime < maxDuration) {
      try {
        // On first poll after reconnect, use .gte to catch boundary logs
        // Normal polling uses .gt to avoid re-sending the same log
        let query = supabase
          .from('execution_logs')
          .select(
            'id, event_source, status, latency_ms, input_tokens, output_tokens, blocked_by_layer, blocked_gate, created_at'
          )
          .eq('agent_id', agentId)

        if (isReconnecting) {
          query = query.gte('created_at', lastSeenTimestamp)
          isReconnecting = false
        } else {
          query = query.gt('created_at', lastSeenTimestamp)
        }

        const { data: newLogs, error: logsError } = await query
          .order('created_at', { ascending: true })
          .limit(50)

        if (logsError) {
          console.error('SSE: Failed to fetch logs:', logsError)
        } else if (newLogs && newLogs.length > 0) {
          // Send each new log as an SSE event (using log.id as event ID)
          for (const log of newLogs) {
            _eventId++
            await stream.writeSSE({
              id: log.id,
              event: 'execution',
              data: JSON.stringify({
                id: log.id,
                event_source: log.event_source,
                status: log.status,
                latency_ms: log.latency_ms,
                input_tokens: log.input_tokens,
                output_tokens: log.output_tokens,
                blocked_by_layer: log.blocked_by_layer,
                blocked_gate: log.blocked_gate,
                created_at: log.created_at,
              }),
            })
            lastSeenTimestamp = log.created_at
          }
        }

        // Send heartbeat every 30 seconds to keep connection alive
        const now = Date.now()
        if (now - lastHeartbeat >= 30000) {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ timestamp: new Date().toISOString() }),
          })
          lastHeartbeat = now
        }

        // Poll every 2 seconds
        await stream.sleep(2000)
      } catch (err) {
        // Connection closed or error - exit cleanly
        console.error('SSE stream error:', err)
        break
      }
    }

    // Send close event before ending stream
    await stream.writeSSE({
      event: 'close',
      data: JSON.stringify({ reason: 'timeout', reconnect: true }),
    })
  })
})

/**
 * GET /agents/:agentId/executions/:logId
 * Get a single execution log entry
 */
executionLogsRoutes.get('/:agentId/executions/:logId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const logId = c.req.param('logId')

  // Validate UUIDs
  const agentIdResult = uuidSchema.safeParse(agentId)
  const logIdResult = uuidSchema.safeParse(logId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }
  if (!logIdResult.success) {
    return c.json({ error: 'Invalid log ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get single log entry
  const { data: log, error: logError } = await supabase
    .from('execution_logs')
    .select('*')
    .eq('id', logId)
    .eq('agent_id', agentId)
    .single()

  if (logError || !log) {
    return c.json({ error: 'Log entry not found' }, 404)
  }

  return c.json(log)
})

/**
 * GET /agents/:agentId/health
 * Get health statistics for an agent (last 24 hours)
 */
executionLogsRoutes.get('/:agentId/health', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, status')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get health stats using RPC function
  const { data: stats, error: statsError } = await supabase.rpc('get_agent_health_stats', {
    p_agent_id: agentId,
  })

  if (statsError) {
    console.error('Failed to get health stats:', statsError)
    return c.json({ error: 'Failed to fetch health stats' }, 500)
  }

  // RPC returns array with single row
  const healthStats = stats?.[0] || {
    total_executions: 0,
    successful_executions: 0,
    blocked_executions: 0,
    error_executions: 0,
    success_rate: 0,
    avg_latency_ms: null,
    last_execution_at: null,
    last_success_at: null,
    last_error_at: null,
  }

  // Determine health status
  let healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' = 'unknown'

  if (healthStats.total_executions === 0) {
    healthStatus = 'unknown'
  } else if (healthStats.success_rate >= 95) {
    healthStatus = 'healthy'
  } else if (healthStats.success_rate >= 80) {
    healthStatus = 'degraded'
  } else {
    healthStatus = 'unhealthy'
  }

  return c.json({
    status: healthStatus,
    agent_status: agent.status,
    stats: healthStats,
  })
})

/**
 * DELETE /agents/:agentId/executions
 * Delete execution logs for an agent (with optional date filter)
 */
executionLogsRoutes.delete('/:agentId/executions', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  // Validate agentId
  const agentIdResult = uuidSchema.safeParse(agentId)
  if (!agentIdResult.success) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  // Validate query params
  const queryResult = deleteQuerySchema.safeParse(c.req.query())
  if (!queryResult.success) {
    return c.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, 400)
  }

  const { before: beforeDate } = queryResult.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  let query = supabase.from('execution_logs').delete().eq('agent_id', agentId)

  if (beforeDate) {
    query = query.lt('created_at', beforeDate)
  }

  const { error: deleteError, count } = await query

  if (deleteError) {
    console.error('Failed to delete logs:', deleteError)
    return c.json({ error: 'Failed to delete logs' }, 500)
  }

  return c.json({ deleted: count || 0 })
})
