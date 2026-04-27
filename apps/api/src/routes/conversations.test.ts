/**
 * Conversations routes unit tests
 * Tests: conversation CRUD, message sending, memory strategies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { conversationsRoutes } from './conversations'
import {
  testWallets,
  createAgent,
  createConversation,
  createConversationMessage,
} from '../test/fixtures'
import { generateTestToken } from '../test/helpers'
import { deductCredits } from '../services/credits'

// Mock the credits service to avoid actual credit checks in tests
vi.mock('../services/credits', () => ({
  deductCredits: vi.fn(async () => ({
    success: true,
    balance_before: 10.003,
    new_balance: 10.0,
    error: null,
  })),
  COST_PER_EXECUTION: 0.003,
}))

// Mock state
const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  conversationResult: { data: null as unknown, error: null as unknown },
  conversationListResult: { data: [] as unknown[], error: null as unknown },
  messagesResult: { data: [] as unknown[], error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
}

// Build chainable query mock
function createQueryChain(getResult: () => { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'range', 'limit', 'gte', 'lte']
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
    if (table === 'conversations') {
      const chain = createQueryChain(() => mockState.conversationResult)
      // Override for list queries
      chain.then = (resolve: (v: unknown) => void) => resolve(mockState.conversationListResult)
      return {
        select: vi.fn(() => chain),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(mockState.updateResult)),
            })),
            then: (resolve: (v: unknown) => void) => resolve({ error: null }),
          })),
        })),
      }
    }
    if (table === 'conversation_messages') {
      const chain = createQueryChain(() => mockState.messagesResult)
      chain.then = (resolve: (v: unknown) => void) => resolve(mockState.messagesResult)
      return {
        select: vi.fn(() => chain),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
      }
    }
    if (table === 'agent_events') {
      return {
        insert: vi.fn(() => Promise.resolve({ error: null })),
      }
    }
    return { select: vi.fn(() => createQueryChain(() => ({ data: null, error: null }))) }
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Mock execution service
vi.mock('../services/execution', () => ({
  execute: vi.fn(() =>
    Promise.resolve({
      blocked: false,
      response: 'Test response from agent',
      latency_ms: 100,
      claw: {
        input: { passed: true, violations: [] },
        output: { passed: true, violations: [] },
      },
    })
  ),
  extractAnalyticsFields: vi.fn((agentId, eventType, result) => ({
    agent_id: agentId,
    event_type: eventType,
    input_tokens: result.inputTokens || null,
    output_tokens: result.outputTokens || null,
    claw_blocked: result.blocked,
    claw_gate: result.gate || null,
    latency_ms: result.latency_ms || null,
    claw_layer: null,
    tool_type: null,
    tool_success: null,
    social_platform: null,
    social_success: null,
    defi_operation: null,
    defi_value_usd: null,
    defi_blocked: null,
    memory_operation: null,
  })),
}))

// Create test app
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    SUPABASE_ANON_KEY: string
    SUPABASE_JWT_SECRET: string
    JWT_SECRET: string
  }
}>()

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

app.route('/agents', conversationsRoutes)

// Reset mock state
function resetMocks() {
  mockState.agentResult = { data: null, error: null }
  mockState.conversationResult = { data: null, error: null }
  mockState.conversationListResult = { data: [], error: null }
  mockState.messagesResult = { data: [], error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
  vi.clearAllMocks()
}

describe('Conversations Routes', () => {
  let token: string
  const agentId = 'agent-1'

  beforeEach(async () => {
    resetMocks()
    token = await generateTestToken(testWallets.alice)

    // Default: agent exists and is owned by user
    mockState.agentResult = {
      data: createAgent({ id: agentId, wallet_address: testWallets.alice }),
      error: null,
    }
  })

  describe('POST /agents/:agentId/conversations', () => {
    it('creates conversation with default settings', async () => {
      const conversation = createConversation({ agent_id: agentId })
      mockState.insertResult = { data: conversation, error: null }

      const res = await app.request(`/agents/${agentId}/conversations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.agent_id).toBe(agentId)
      expect(body.memory_strategy).toBe('sliding_window')
    })

    it('creates conversation with custom settings', async () => {
      const conversation = createConversation({
        agent_id: agentId,
        title: 'Test Conversation',
        memory_strategy: 'full',
        context_window: 20,
      })
      mockState.insertResult = { data: conversation, error: null }

      const res = await app.request(`/agents/${agentId}/conversations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Conversation',
          memory_strategy: 'full',
          context_window: 20,
        }),
      })

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.title).toBe('Test Conversation')
      expect(body.memory_strategy).toBe('full')
      expect(body.context_window).toBe(20)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/non-existent/conversations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toBe('Agent not found')
    })

    it('returns 401 without authorization', async () => {
      const res = await app.request(`/agents/${agentId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /agents/:agentId/conversations', () => {
    it('lists conversations', async () => {
      const conversations = [
        createConversation({ id: 'conv-1', agent_id: agentId }),
        createConversation({ id: 'conv-2', agent_id: agentId }),
      ]
      mockState.conversationListResult = { data: conversations, error: null }

      const res = await app.request(`/agents/${agentId}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.conversations).toHaveLength(2)
      expect(body.pagination).toBeDefined()
    })

    it('filters by status', async () => {
      mockState.conversationListResult = { data: [], error: null }

      const res = await app.request(`/agents/${agentId}/conversations?status=archived`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('supports pagination', async () => {
      mockState.conversationListResult = { data: [], error: null }

      const res = await app.request(`/agents/${agentId}/conversations?limit=10&offset=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.pagination.limit).toBe(10)
      expect(body.pagination.offset).toBe(20)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/agents/non-existent/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /agents/:agentId/conversations/:conversationId', () => {
    it('returns conversation with messages', async () => {
      const conversation = createConversation({ id: 'conv-1', agent_id: agentId })
      mockState.conversationResult = { data: conversation, error: null }

      const messages = [
        createConversationMessage({ role: 'user', content: 'Hello' }),
        createConversationMessage({ role: 'assistant', content: 'Hi there!' }),
      ]
      mockState.messagesResult = { data: messages, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.id).toBe('conv-1')
      expect(body.messages).toHaveLength(2)
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.conversationResult = { data: null, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/non-existent`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toBe('Conversation not found')
    })
  })

  describe('PATCH /agents/:agentId/conversations/:conversationId', () => {
    beforeEach(() => {
      mockState.conversationResult = {
        data: createConversation({ id: 'conv-1', agent_id: agentId }),
        error: null,
      }
    })

    it('updates conversation title', async () => {
      const updated = createConversation({ id: 'conv-1', title: 'New Title' })
      mockState.updateResult = { data: updated, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'New Title' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.title).toBe('New Title')
    })

    it('updates conversation status', async () => {
      const updated = createConversation({ id: 'conv-1', status: 'archived' })
      mockState.updateResult = { data: updated, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'archived' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.status).toBe('archived')
    })

    it('updates memory strategy', async () => {
      const updated = createConversation({ id: 'conv-1', memory_strategy: 'none' })
      mockState.updateResult = { data: updated, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memory_strategy: 'none' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.memory_strategy).toBe('none')
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.conversationResult = { data: null, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/non-existent`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'New Title' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /agents/:agentId/conversations/:conversationId', () => {
    it('archives conversation', async () => {
      mockState.conversationResult = {
        data: createConversation({ id: 'conv-1' }),
        error: null,
      }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.conversationResult = { data: null, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/non-existent`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /agents/:agentId/conversations/:conversationId/messages', () => {
    beforeEach(() => {
      mockState.conversationResult = {
        data: createConversation({
          id: 'conv-1',
          agent_id: agentId,
          message_count: 0,
          memory_strategy: 'sliding_window',
          context_window: 10,
          title: null,
        }),
        error: null,
      }
    })

    it('sends message and receives response', async () => {
      const userMsg = createConversationMessage({ role: 'user', content: 'Hello' })
      const _assistantMsg = createConversationMessage({
        role: 'assistant',
        content: 'Test response from agent',
      })

      mockState.insertResult = { data: userMsg, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Hello' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.user_message).toBeDefined()
      expect(body.blocked).toBe(false)
      expect(body.response).toBe('Test response from agent')
      expect(body.credits).toBeDefined()
      expect(body.credits.cost).toBe(0.003)
      expect(body.credits.balance_after).toBeDefined()
      // Memory metadata
      expect(body.memory).toBeDefined()
      expect(body.memory.strategy).toBe('sliding_window')
      expect(body.memory.effective_strategy).toBe('sliding_window')
      expect(body.memory.fallback_reason).toBeUndefined()
    })

    it('returns 402 when credits are insufficient', async () => {
      const userMsg = createConversationMessage({ role: 'user', content: 'Hello' })
      mockState.insertResult = { data: userMsg, error: null }

      // Override mock: insufficient credits
      const mockDeduct = deductCredits as ReturnType<typeof vi.fn>
      mockDeduct.mockResolvedValueOnce({
        success: false,
        balance_before: 0.001,
        new_balance: 0.001,
        error: 'INSUFFICIENT_CREDITS',
      })

      const res = await app.request(`/agents/${agentId}/conversations/conv-1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Hello' }),
      })

      expect(res.status).toBe(402)

      const body = await res.json()
      expect(body.code).toBe('INSUFFICIENT_CREDITS')
      expect(body.balance_usd).toBeDefined()
      expect(body.required_usd).toBe(0.003)
      expect(body.pricing).toBeDefined()
      expect(body.pricing.cost_per_execution).toBe(0.003)
    })

    it('returns 400 for empty message', async () => {
      const res = await app.request(`/agents/${agentId}/conversations/conv-1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: '' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/agents/non-existent/conversations/conv-1/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Hello' }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.conversationResult = { data: null, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/non-existent/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Hello' }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('Memory Strategy: Summary', () => {
    it('creates conversation with summary memory strategy', async () => {
      const conversation = createConversation({
        agent_id: agentId,
        memory_strategy: 'summary',
        context_window: 10,
      })
      mockState.insertResult = { data: conversation, error: null }

      const res = await app.request(`/agents/${agentId}/conversations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memory_strategy: 'summary',
        }),
      })

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.memory_strategy).toBe('summary')
    })

    it('sends message with summary strategy and reports fallback metadata', async () => {
      // Set up conversation with summary strategy
      mockState.conversationResult = {
        data: createConversation({
          id: 'conv-1',
          agent_id: agentId,
          message_count: 5,
          memory_strategy: 'summary',
          context_window: 10,
          title: 'Test Conversation',
        }),
        error: null,
      }

      const userMsg = createConversationMessage({ role: 'user', content: 'Hello' })
      mockState.insertResult = { data: userMsg, error: null }

      // Should work even without summary (fallback to sliding_window)
      // No OPENAI_API_KEY in test env, so summary generation can't happen
      const res = await app.request(`/agents/${agentId}/conversations/conv-1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: 'Hello' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.blocked).toBe(false)
      expect(body.response).toBe('Test response from agent')
      // Memory metadata shows fallback
      expect(body.memory).toBeDefined()
      expect(body.memory.strategy).toBe('summary')
      expect(body.memory.effective_strategy).toBe('sliding_window')
      expect(body.memory.fallback_reason).toBeDefined()
    })

    it('validates summary memory strategy enum', async () => {
      const res = await app.request(`/agents/${agentId}/conversations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memory_strategy: 'invalid_strategy',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('can update conversation to use summary strategy', async () => {
      mockState.conversationResult = {
        data: createConversation({ id: 'conv-1', memory_strategy: 'sliding_window' }),
        error: null,
      }

      const updatedConv = createConversation({
        id: 'conv-1',
        memory_strategy: 'summary',
      })
      mockState.updateResult = { data: updatedConv, error: null }

      const res = await app.request(`/agents/${agentId}/conversations/conv-1`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memory_strategy: 'summary',
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.memory_strategy).toBe('summary')
    })
  })
})
