/**
 * Execution Logs Routes Tests
 *
 * Integration tests for execution log management endpoints.
 * Tests pagination, filtering, validation, and authorization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { executionLogsRoutes } from './execution-logs'
import { testWallets, createAgent, generateUUID } from '../test/fixtures'
import { generateTestToken } from '../test/helpers'

// Capture the streamSSE callback so SSE handler tests can drive the loop
// directly with fake timers — the live HTTP response is short-circuited and
// asserted via the writeSSE / sleep calls on the captured stream stub.
type CapturedStream = {
  writeSSE: ReturnType<typeof vi.fn>
  sleep: ReturnType<typeof vi.fn>
}
type SSEHandler = (stream: CapturedStream) => Promise<void>
let capturedSSEHandler: SSEHandler | null = null

vi.mock('hono/streaming', () => ({
  streamSSE: vi.fn((_c: unknown, cb: SSEHandler) => {
    capturedSSEHandler = cb
    return new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }),
}))

// ============================================
// MOCK STATE
// ============================================

const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  logsResult: { data: [] as unknown[], error: null as unknown },
  singleLogResult: { data: null as unknown, error: null as unknown },
  healthResult: { data: [] as unknown[], error: null as unknown },
  countResult: { data: 0 as number, error: null as unknown },
  deleteResult: { error: null as unknown, count: 0 as number | null },
}

// Reset mock state
function resetMockState() {
  mockState.agentResult = { data: null, error: null }
  mockState.logsResult = { data: [], error: null }
  mockState.singleLogResult = { data: null, error: null }
  mockState.healthResult = { data: [], error: null }
  mockState.countResult = { data: 0, error: null }
  mockState.deleteResult = { error: null, count: 0 }
}

// Build chainable query mock
function createQueryChain(getResult: () => { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'single', 'order', 'gt', 'gte', 'lt', 'limit']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(getResult()))
  chain.then = (resolve: (v: unknown) => void) => resolve(getResult())
  return chain
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.agentResult)),
      }
    }
    if (table === 'execution_logs') {
      return {
        select: vi.fn(() => {
          const chain = createQueryChain(() => mockState.singleLogResult)
          chain.order = vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockState.logsResult)),
            then: (resolve: (v: unknown) => void) => resolve(mockState.logsResult),
          }))
          return chain
        }),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => Promise.resolve(mockState.deleteResult)),
            then: (resolve: (v: unknown) => void) => resolve(mockState.deleteResult),
          })),
        })),
      }
    }
    return {}
  }),
  rpc: vi.fn((funcName: string) => {
    if (funcName === 'get_execution_logs') {
      return Promise.resolve(mockState.logsResult)
    }
    if (funcName === 'get_execution_logs_count') {
      return Promise.resolve(mockState.countResult)
    }
    if (funcName === 'get_agent_health_stats') {
      return Promise.resolve(mockState.healthResult)
    }
    return Promise.resolve({ data: null, error: null })
  }),
}

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// ============================================
// TEST APP SETUP
// ============================================

// Create test app with mock environment
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    SUPABASE_ANON_KEY: string
    SUPABASE_JWT_SECRET: string
    JWT_SECRET: string
    RATE_LIMIT_KV?: KVNamespace
    IP_HASH_SECRET?: string
  }
}>()

// Inject mock env
app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars-padding!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/agents', executionLogsRoutes)

// ============================================
// TEST FIXTURES
// ============================================

function createMockAgent() {
  return createAgent({
    id: generateUUID(),
    wallet_address: testWallets.alice,
    status: 'deployed',
  })
}

function createMockLog(overrides: Record<string, unknown> = {}) {
  return {
    id: generateUUID(),
    event_source: 'invoke',
    status: 'success',
    input_preview: 'Test input',
    output_preview: 'Test output',
    latency_ms: 150,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockHealthStats() {
  return {
    total_executions: 100,
    successful_executions: 85,
    blocked_executions: 10,
    error_executions: 5,
    success_rate: 85.0,
    avg_latency_ms: 150,
    last_execution_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_error_at: new Date(Date.now() - 86400000).toISOString(),
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('Execution Logs Routes', () => {
  let token: string

  beforeEach(async () => {
    resetMockState()
    vi.clearAllMocks()
    token = await generateTestToken(testWallets.alice)
  })

  // ==========================================
  // GET /agents/:agentId/executions
  // ==========================================

  describe('GET /agents/:agentId/executions', () => {
    it('returns 401 without authentication', async () => {
      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions`)

      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid agent ID format', async () => {
      const res = await app.request('/agents/invalid-uuid/executions', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid agent ID format')
    })

    it('returns 404 if agent not found', async () => {
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }

      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns paginated logs', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog(), createMockLog(), createMockLog()]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }
      mockState.countResult = { data: 50, error: null }

      const res = await app.request(`/agents/${agent.id}/executions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.logs).toHaveLength(3)
      expect(body.total).toBe(50)
      expect(body.limit).toBe(50) // default
      expect(body.offset).toBe(0)
    })

    it('applies pagination parameters', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }
      mockState.countResult = { data: 100, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?limit=10&offset=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.limit).toBe(10)
      expect(body.offset).toBe(20)
    })

    it('validates limit bounds (max 100)', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid query parameters')
    })

    it('validates offset bounds (max 10000)', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?offset=20000`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid query parameters')
    })

    it('filters by status', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog({ status: 'blocked' })]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?status=blocked`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.logs[0].status).toBe('blocked')
    })

    it('filters by event_source', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog({ event_source: 'webhook' })]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?event_source=webhook`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('rejects invalid status value', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?status=invalid`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })
  })

  // ==========================================
  // GET /agents/:agentId/executions/:logId
  // ==========================================

  describe('GET /agents/:agentId/executions/:logId', () => {
    it('returns 400 for invalid log ID format', async () => {
      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions/invalid-log-id`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Invalid log ID format')
    })

    it('returns single log entry', async () => {
      const agent = createMockAgent()
      const log = createMockLog()

      mockState.agentResult = { data: agent, error: null }
      mockState.singleLogResult = { data: log, error: null }

      const res = await app.request(`/agents/${agent.id}/executions/${log.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(log.id)
    })

    it('returns 404 if log not found', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.singleLogResult = { data: null, error: { code: 'PGRST116' } }

      const logId = generateUUID()
      const res = await app.request(`/agents/${agent.id}/executions/${logId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  // ==========================================
  // GET /agents/:agentId/health
  // ==========================================

  describe('GET /agents/:agentId/health', () => {
    it('returns health statistics', async () => {
      const agent = createMockAgent()
      const healthStats = createMockHealthStats()

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.stats).toBeDefined()
      expect(body.stats.total_executions).toBe(100)
    })

    it('determines "healthy" status for high success rate', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), success_rate: 98 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('healthy')
    })

    it('determines "degraded" status for moderate success rate', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), success_rate: 88 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('degraded')
    })

    it('determines "unhealthy" status for low success rate', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), success_rate: 60 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('unhealthy')
    })

    it('determines "unknown" status for no executions', async () => {
      const agent = createMockAgent()
      const healthStats = { ...createMockHealthStats(), total_executions: 0 }

      mockState.agentResult = { data: agent, error: null }
      mockState.healthResult = { data: [healthStats], error: null }

      const res = await app.request(`/agents/${agent.id}/health`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('unknown')
    })
  })

  // ==========================================
  // DELETE /agents/:agentId/executions
  // ==========================================

  describe('DELETE /agents/:agentId/executions', () => {
    it('deletes execution logs', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.deleteResult = { error: null, count: 10 }

      const res = await app.request(`/agents/${agent.id}/executions`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.deleted).toBe(10)
    })

    it('validates before date parameter', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions?before=invalid-date`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('accepts valid ISO date for before parameter', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.deleteResult = { error: null, count: 5 }

      const beforeDate = new Date().toISOString()
      const res = await app.request(
        `/agents/${agent.id}/executions?before=${encodeURIComponent(beforeDate)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      expect(res.status).toBe(200)
    })
  })

  // ==========================================
  // GET /agents/:agentId/executions/export
  // ==========================================

  describe('GET /agents/:agentId/executions/export', () => {
    it('exports logs as JSON', async () => {
      const agent = createMockAgent()
      const logs = [createMockLog(), createMockLog()]

      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.agent_id).toBe(agent.id)
      expect(body.logs).toHaveLength(2)
      expect(body.exported_at).toBeDefined()
    })

    it('validates days parameter bounds', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export?days=100`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('accepts valid days parameter', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('sets Content-Disposition header for download', async () => {
      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const res = await app.request(`/agents/${agent.id}/executions/export`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Disposition')).toContain('attachment')
    })
  })

  // ==========================================
  // Authorization Tests
  // ==========================================

  describe('Authorization', () => {
    it('prevents access to another user agent', async () => {
      // Agent owned by different wallet
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }

      const agentId = generateUUID()
      const res = await app.request(`/agents/${agentId}/executions`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  // ==========================================
  // GET /agents/:agentId/executions/stream  (SSE)
  // ==========================================

  describe('GET /agents/:agentId/executions/stream', () => {
    // Stream max-duration in the handler is 5 minutes. Tests use fake timers
    // so the polling loop can race through that window in milliseconds while
    // each iteration's mocked query resolves immediately.
    const FIVE_MINUTES_MS = 5 * 60 * 1000
    const POLL_INTERVAL_MS = 2_000
    const HEARTBEAT_INTERVAL_MS = 30_000
    const JWT_REFRESH_WINDOW_MS = 50_000

    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    /**
     * Build a stream stub whose `sleep(ms)` advances vitest's fake-timer
     * clock by `ms`. After `iterationsBeforeExit` polling cycles, the next
     * sleep call jumps the clock past the 5-minute max-duration so the
     * handler exits cleanly. Without this, the loop would run for the full
     * 150 iterations and the test would assert against a long writeSSE
     * history that masks the case under test.
     */
    function makeStream(iterationsBeforeExit: number): CapturedStream {
      let iter = 0
      const sleep = vi.fn(async (ms: number) => {
        iter += 1
        if (iter >= iterationsBeforeExit) {
          vi.advanceTimersByTime(FIVE_MINUTES_MS + 1)
        } else {
          vi.advanceTimersByTime(ms)
        }
      })
      const writeSSE = vi.fn(async () => undefined)
      return { writeSSE, sleep }
    }

    /**
     * Trigger the route — the streamSSE mock captures the polling handler
     * without actually wiring the response stream. The returned object lets
     * tests run that handler with a custom fake stream.
     */
    async function triggerStream(agentId: string, extraHeaders: Record<string, string> = {}) {
      capturedSSEHandler = null
      const res = await app.request(`/agents/${agentId}/executions/stream`, {
        headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
      })
      return { res, handler: capturedSSEHandler }
    }

    beforeEach(() => {
      capturedSSEHandler = null
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      vi.useRealTimers()
      consoleErrorSpy.mockRestore()
    })

    it('returns 400 for an invalid agent UUID without invoking the stream', async () => {
      const { res, handler } = await triggerStream('not-a-uuid')
      expect(res.status).toBe(400)
      expect(handler).toBeNull()
    })

    it('returns 404 when the agent is not owned (RLS denial) without invoking the stream', async () => {
      mockState.agentResult = { data: null, error: { code: 'PGRST116' } }
      const { res, handler } = await triggerStream(generateUUID())
      expect(res.status).toBe(404)
      expect(handler).toBeNull()
    })

    it('emits each new log as an SSE execution event and closes after the timeout', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

      const agent = createMockAgent()
      const logs = [createMockLog(), createMockLog(), createMockLog()]
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: logs, error: null }

      const { res, handler } = await triggerStream(agent.id as string)
      expect(res.status).toBe(200)
      expect(handler).not.toBeNull()

      const stream = makeStream(1)
      await handler!(stream)

      // Three execution events fired, each carrying the log id and a
      // JSON-encoded payload mirroring the mocked log shape.
      const executionCalls = stream.writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'execution'
      )
      expect(executionCalls).toHaveLength(3)
      for (let i = 0; i < 3; i++) {
        const [msg] = executionCalls[i]
        const log = logs[i] as Record<string, unknown>
        expect(msg).toMatchObject({ id: log.id, event: 'execution' })
        expect(JSON.parse(msg.data as string)).toMatchObject({
          id: log.id,
          event_source: log.event_source,
          status: log.status,
        })
      }

      // Loop terminates with a close event marking the timeout.
      const closeCalls = stream.writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'close'
      )
      expect(closeCalls).toHaveLength(1)
      const closePayload = JSON.parse(closeCalls[0][0].data as string)
      expect(closePayload).toMatchObject({ reason: 'timeout', reconnect: true })
    })

    it('emits a heartbeat once 30 seconds have elapsed without new logs', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const { handler } = await triggerStream(agent.id as string)
      expect(handler).not.toBeNull()

      // Sleep advances 31s on the first call so the heartbeat condition
      // (now - lastHeartbeat >= 30000) fires on the second iteration.
      let iter = 0
      const sleep = vi.fn(async () => {
        iter += 1
        if (iter === 1) {
          vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 1_000)
        } else {
          vi.advanceTimersByTime(FIVE_MINUTES_MS + 1)
        }
      })
      const writeSSE = vi.fn(async () => undefined)
      await handler!({ writeSSE, sleep })

      const heartbeatCalls = writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'heartbeat'
      )
      expect(heartbeatCalls.length).toBeGreaterThanOrEqual(1)
      const payload = JSON.parse(heartbeatCalls[0][0].data as string)
      expect(payload).toHaveProperty('timestamp')
      expect(typeof payload.timestamp).toBe('string')
    })

    it('honours Last-Event-ID by looking up the prior log timestamp before streaming', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

      const agent = createMockAgent()
      const lastLog = createMockLog({ created_at: '2026-05-15T11:58:00.000Z' })
      mockState.agentResult = { data: agent, error: null }
      mockState.singleLogResult = { data: { created_at: lastLog.created_at }, error: null }
      mockState.logsResult = { data: [], error: null }

      const { res, handler } = await triggerStream(agent.id as string, {
        'Last-Event-ID': lastLog.id as string,
      })
      expect(res.status).toBe(200)
      expect(handler).not.toBeNull()

      // The pre-stream lookup is the visible side effect: rpc / from('execution_logs')
      // .select('created_at').eq('id', lastEventId).single() is invoked.
      const executionLogsLookup = mockSupabase.from.mock.calls.filter(
        ([table]) => table === 'execution_logs'
      )
      expect(executionLogsLookup.length).toBeGreaterThanOrEqual(1)

      // Running the handler still completes cleanly; the reconnection path
      // does not change the writeSSE close contract.
      const stream = makeStream(1)
      await handler!(stream)
      const closeCalls = stream.writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'close'
      )
      expect(closeCalls).toHaveLength(1)
    })

    it('re-mints the user client once the polling loop crosses the JWT refresh window', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const { createClient } = await import('@supabase/supabase-js')
      const createClientMock = vi.mocked(createClient)
      // Baseline: the route handler already called createClient for the
      // ownership check + the initial userClient mint before streamSSE.
      const baselineCalls = createClientMock.mock.calls.length

      const { handler } = await triggerStream(agent.id as string)
      expect(handler).not.toBeNull()

      // Walk the loop in chunks so Date.now() crosses the 50s refresh
      // boundary on the second iteration. getRefreshableUserClient should
      // then mint a fresh client before the third poll's query.
      let iter = 0
      const sleep = vi.fn(async () => {
        iter += 1
        if (iter === 1) {
          vi.advanceTimersByTime(JWT_REFRESH_WINDOW_MS + 1_000)
        } else if (iter === 2) {
          vi.advanceTimersByTime(POLL_INTERVAL_MS)
        } else {
          vi.advanceTimersByTime(FIVE_MINUTES_MS + 1)
        }
      })
      const writeSSE = vi.fn(async () => undefined)
      await handler!({ writeSSE, sleep })

      // At least one additional createClient call inside the loop beyond the
      // baseline => a refresh happened. Without the wrapper the count would
      // stay flat (single mint per handler entry).
      const inLoopMints = createClientMock.mock.calls.length - baselineCalls
      expect(inLoopMints).toBeGreaterThanOrEqual(1)
    })

    it('closes with a timeout payload once the 5-minute window elapses', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: [], error: null }

      const { handler } = await triggerStream(agent.id as string)
      expect(handler).not.toBeNull()

      // First sleep advances 3 minutes; second advances another 3 — the
      // second iteration's while-condition check exits the loop.
      let iter = 0
      const sleep = vi.fn(async () => {
        iter += 1
        vi.advanceTimersByTime(3 * 60 * 1000)
      })
      const writeSSE = vi.fn(async () => undefined)
      await handler!({ writeSSE, sleep })

      const closeCalls = writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'close'
      )
      expect(closeCalls).toHaveLength(1)
      const payload = JSON.parse(closeCalls[0][0].data as string)
      expect(payload).toEqual({ reason: 'timeout', reconnect: true })
      // The loop body ran at least once before timing out.
      expect(iter).toBeGreaterThanOrEqual(1)
    })

    it('logs and continues when the execution_logs query returns an error', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

      const agent = createMockAgent()
      mockState.agentResult = { data: agent, error: null }
      mockState.logsResult = { data: null, error: { message: 'rls denied' } }

      const { handler } = await triggerStream(agent.id as string)
      expect(handler).not.toBeNull()

      const stream = makeStream(1)
      await handler!(stream)

      // The error path is meant to be visible but non-fatal: console.error
      // fires, the loop keeps going to the next iteration, and the close
      // event still fires when the window elapses.
      expect(consoleErrorSpy).toHaveBeenCalled()
      const errorMessages = consoleErrorSpy.mock.calls.map((args) => String(args[0]))
      expect(errorMessages.some((m) => m.includes('SSE: Failed to fetch logs'))).toBe(true)

      const closeCalls = stream.writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'close'
      )
      expect(closeCalls).toHaveLength(1)

      // No execution events were emitted because the query failed.
      const executionCalls = stream.writeSSE.mock.calls.filter(
        ([msg]: [{ event?: string }]) => msg.event === 'execution'
      )
      expect(executionCalls).toHaveLength(0)
    })
  })
})
