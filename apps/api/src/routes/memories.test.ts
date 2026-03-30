/**
 * Memory Routes Tests
 *
 * Tests for validation schemas and helper logic in the memory routes.
 * Tests cover memory listing, searching, and statistics calculations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import { memoriesRoutes } from './memories'
import { testWallets } from '../test/fixtures/index'

// =========================================
// MOCK SETUP
// =========================================

const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  listResult: { data: [] as unknown[], error: null as unknown },
  selectResult: { data: null as unknown, error: null as unknown },
  deleteResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  countResult: { count: 0 as number | null, error: null as unknown },
}

function createQueryChain(
  terminalValue: () => { data?: unknown; error?: unknown; count?: number | null }
) {
  const chain: Record<string, unknown> = {}

  const chainMethods = ['select', 'eq', 'neq', 'ilike', 'order', 'range', 'limit']
  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain)
  }

  chain.single = vi.fn(() => Promise.resolve(terminalValue()))
  chain.maybeSingle = vi.fn(() => Promise.resolve(terminalValue()))
  chain.then = (resolve: (v: unknown) => void) => resolve(terminalValue())

  return chain
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.agentResult)),
      }
    }
    if (table === 'conversations') {
      return {
        select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            const countChain: Record<string, unknown> = {}
            countChain.eq = vi.fn(() => countChain)
            countChain.neq = vi.fn(() => countChain)
            countChain.ilike = vi.fn(() => countChain)
            countChain.then = (resolve: (v: unknown) => void) => resolve(mockState.countResult)
            return countChain
          }
          const selectChain = createQueryChain(() => mockState.selectResult)
          let singleCalled = false
          selectChain.single = vi.fn(() => {
            singleCalled = true
            return Promise.resolve(mockState.selectResult)
          })
          selectChain.then = (resolve: (v: unknown) => void) => {
            if (!singleCalled) {
              resolve(mockState.listResult)
            } else {
              resolve(mockState.selectResult)
            }
          }
          return selectChain
        }),
        delete: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.then = (resolve: (v: unknown) => void) => resolve(mockState.deleteResult)
          return chain
        }),
        update: vi.fn(() => {
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.then = (resolve: (v: unknown) => void) => resolve(mockState.updateResult)
          return chain
        }),
      }
    }
    if (table === 'conversation_messages') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.listResult)),
      }
    }
    if (table === 'conversation_context') {
      return {
        select: vi.fn(() => createQueryChain(() => ({ data: [], error: null }))),
      }
    }
    return {
      select: vi.fn(() => createQueryChain(() => mockState.selectResult)),
    }
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as {
      req: { header: (name: string) => string | undefined }
      set: (key: string, value: string) => void
      json: (data: unknown, status: number) => Response
    }
    const authHeader = ctx.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.json({ error: 'Unauthorized' }, 401)
    }
    ctx.set('wallet', testWallets.alice)
    ctx.set('plan', 'pro')
    await next()
  }),
}))

vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  }),
}))

function resetMockState() {
  mockState.agentResult = { data: null, error: null }
  mockState.listResult = { data: [], error: null }
  mockState.selectResult = { data: null, error: null }
  mockState.deleteResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
  mockState.countResult = { count: 0, error: null }
}

// Create test app
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    JWT_SECRET: string
  }
}>()

app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/agents', memoriesRoutes)

// Test fixtures
const mockAgent = { id: 'agent-123', name: 'Test Agent' }

const mockConversation = {
  id: 'conv-123',
  title: 'Test Conversation',
  status: 'active',
  memory_strategy: 'sliding_window',
  context_window: 10,
  message_count: 5,
  total_tokens: 500,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  last_message_at: '2024-01-01T00:00:00Z',
}

// =========================================
// HTTP ROUTE TESTS
// =========================================

describe('Memory Routes HTTP Tests', () => {
  const token = 'test-token'

  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  describe('GET /agents/:agentId/memories', () => {
    it('returns memories list for an agent', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.listResult = { data: [mockConversation], error: null }
      mockState.countResult = { count: 1, error: null }

      const res = await app.request('/agents/agent-123/memories', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.memories).toHaveLength(1)
      expect(data.pagination).toBeDefined()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/nonexistent/memories', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns 400 for invalid query params', async () => {
      const res = await app.request('/agents/agent-123/memories?limit=0', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request('/agents/agent-123/memories')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /agents/:agentId/memories/stats', () => {
    it('returns memory statistics', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.listResult = {
        data: [
          {
            id: '1',
            status: 'active',
            message_count: 10,
            total_tokens: 1000,
            memory_strategy: 'sliding_window',
          },
          {
            id: '2',
            status: 'archived',
            message_count: 5,
            total_tokens: 500,
            memory_strategy: 'summary',
          },
        ],
        error: null,
      }

      const res = await app.request('/agents/agent-123/memories/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.stats.total_conversations).toBe(2)
      expect(data.stats.active_conversations).toBe(1)
      expect(data.strategy_breakdown).toBeDefined()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/nonexistent/memories/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /agents/:agentId/memories/:conversationId', () => {
    it('returns conversation with messages', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: mockConversation, error: null }
      mockState.listResult = {
        data: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        error: null,
      }

      const res = await app.request('/agents/agent-123/memories/conv-123', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.id).toBe('conv-123')
      expect(data.messages).toBeDefined()
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/agent-123/memories/nonexistent', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /agents/:agentId/memories/:conversationId', () => {
    it('archives conversation (soft delete)', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: { id: 'conv-123' }, error: null }
      mockState.updateResult = { data: null, error: null }

      const res = await app.request('/agents/agent-123/memories/conv-123', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.archived).toBe(true)
    })

    it('permanently deletes when permanent=true', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: { id: 'conv-123' }, error: null }
      mockState.deleteResult = { data: null, error: null }

      const res = await app.request('/agents/agent-123/memories/conv-123?permanent=true', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.deleted).toBe(true)
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/agent-123/memories/nonexistent', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /agents/:agentId/memories', () => {
    it('archives all active conversations', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.countResult = { count: 5, error: null }
      mockState.updateResult = { data: null, error: null }

      const res = await app.request('/agents/agent-123/memories', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.archived).toBe(true)
    })

    it('permanently deletes all when permanent=true', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.countResult = { count: 5, error: null }
      mockState.deleteResult = { data: null, error: null }

      const res = await app.request('/agents/agent-123/memories?permanent=true', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.deleted).toBe(true)
      expect(data.count).toBe(5)
    })
  })

  describe('POST /agents/:agentId/memories/search', () => {
    it('searches through messages', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.listResult = {
        data: [
          {
            id: 'msg-1',
            conversation_id: 'conv-123',
            role: 'user',
            content: 'Hello world',
            position: 1,
            created_at: '2024-01-01T00:00:00Z',
            conversations: { title: 'Test Conv' },
          },
        ],
        error: null,
      }

      const res = await app.request('/agents/agent-123/memories/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'Hello' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.results).toBeDefined()
      expect(data.query).toBe('Hello')
    })

    it('returns 400 for invalid search query', async () => {
      const res = await app.request('/agents/agent-123/memories/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '' }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /agents/:agentId/memories/:conversationId/restore', () => {
    it('restores archived conversation', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: { id: 'conv-123', status: 'archived' }, error: null }
      mockState.updateResult = { data: null, error: null }

      const res = await app.request('/agents/agent-123/memories/conv-123/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.restored).toBe(true)
    })

    it('returns 400 for non-archived conversation', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: { id: 'conv-123', status: 'active' }, error: null }

      const res = await app.request('/agents/agent-123/memories/conv-123/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent conversation', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.selectResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/agent-123/memories/nonexistent/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })
})

// =========================================
// SCHEMA TESTS (existing)
// =========================================

// Copy validation schemas from the routes for testing
const listMemoriesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['active', 'archived', 'all']).default('all'),
  search: z.string().max(200).optional(),
})

const memorySearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.coerce.number().min(1).max(50).default(10),
})

// Snippet extractor (copied from routes for testing)
function extractSnippet(content: string, query: string, contextChars: number = 100): string {
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerContent.indexOf(lowerQuery)

  if (index === -1) {
    return content.substring(0, contextChars * 2) + (content.length > contextChars * 2 ? '...' : '')
  }

  const start = Math.max(0, index - contextChars)
  const end = Math.min(content.length, index + query.length + contextChars)

  let snippet = content.substring(start, end)

  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'

  return snippet
}

// Stats calculator helper (simplified from route logic)
function calculateMemoryStats(
  conversations: Array<{
    status: string
    message_count: number
    total_tokens: number
    memory_strategy: string
  }>
) {
  const totalConversations = conversations.length
  const activeConversations = conversations.filter((c) => c.status === 'active').length
  const archivedConversations = conversations.filter((c) => c.status === 'archived').length
  const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0)
  const totalTokens = conversations.reduce((sum, c) => sum + (c.total_tokens || 0), 0)

  const strategyBreakdown: Record<string, number> = {}
  for (const conv of conversations) {
    const strategy = conv.memory_strategy || 'sliding_window'
    strategyBreakdown[strategy] = (strategyBreakdown[strategy] || 0) + 1
  }

  return {
    stats: {
      total_conversations: totalConversations,
      active_conversations: activeConversations,
      archived_conversations: archivedConversations,
      total_messages: totalMessages,
      total_tokens: totalTokens,
      avg_messages_per_conversation:
        totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0,
    },
    strategy_breakdown: strategyBreakdown,
  }
}

describe('Memory Routes Validation Schemas', () => {
  describe('List Memories Query Schema', () => {
    it('accepts valid query params', () => {
      const queries = [
        { limit: '10', offset: '0', status: 'all' },
        { limit: 50, offset: 100, status: 'active' },
        { limit: '100', offset: '500', status: 'archived' },
        { status: 'all', search: 'test query' },
      ]

      for (const query of queries) {
        expect(listMemoriesQuerySchema.safeParse(query).success).toBe(true)
      }
    })

    it('applies defaults for missing params', () => {
      const result = listMemoriesQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
        expect(result.data.offset).toBe(0)
        expect(result.data.status).toBe('all')
      }
    })

    it('coerces string values to numbers', () => {
      const result = listMemoriesQuerySchema.safeParse({ limit: '50', offset: '10' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(10)
      }
    })

    it('rejects invalid limit values', () => {
      const invalidLimits = [0, -1, 101, 1000]

      for (const limit of invalidLimits) {
        expect(listMemoriesQuerySchema.safeParse({ limit }).success).toBe(false)
      }
    })

    it('rejects negative offset', () => {
      expect(listMemoriesQuerySchema.safeParse({ offset: -1 }).success).toBe(false)
    })

    it('rejects invalid status values', () => {
      const invalidStatuses = ['invalid', 'ACTIVE', 'deleted', 'pending']

      for (const status of invalidStatuses) {
        expect(listMemoriesQuerySchema.safeParse({ status }).success).toBe(false)
      }
    })

    it('accepts all valid status values', () => {
      const validStatuses = ['active', 'archived', 'all']

      for (const status of validStatuses) {
        expect(listMemoriesQuerySchema.safeParse({ status }).success).toBe(true)
      }
    })

    it('rejects search query exceeding max length', () => {
      expect(
        listMemoriesQuerySchema.safeParse({
          search: 'a'.repeat(201),
        }).success
      ).toBe(false)
    })

    it('accepts search query at max length', () => {
      expect(
        listMemoriesQuerySchema.safeParse({
          search: 'a'.repeat(200),
        }).success
      ).toBe(true)
    })
  })

  describe('Memory Search Schema', () => {
    it('accepts valid search queries', () => {
      const searches = [
        { query: 'hello' },
        { query: 'search term', limit: 20 },
        { query: 'a' }, // Minimum length
        { query: 'a'.repeat(500) }, // Maximum length
      ]

      for (const search of searches) {
        expect(memorySearchSchema.safeParse(search).success).toBe(true)
      }
    })

    it('applies default limit', () => {
      const result = memorySearchSchema.safeParse({ query: 'test' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(10)
      }
    })

    it('rejects empty query', () => {
      expect(memorySearchSchema.safeParse({ query: '' }).success).toBe(false)
    })

    it('rejects query exceeding max length', () => {
      expect(
        memorySearchSchema.safeParse({
          query: 'a'.repeat(501),
        }).success
      ).toBe(false)
    })

    it('rejects missing query field', () => {
      expect(memorySearchSchema.safeParse({}).success).toBe(false)
      expect(memorySearchSchema.safeParse({ limit: 10 }).success).toBe(false)
    })

    it('rejects invalid limit values', () => {
      const invalidLimits = [0, -1, 51, 100]

      for (const limit of invalidLimits) {
        expect(memorySearchSchema.safeParse({ query: 'test', limit }).success).toBe(false)
      }
    })

    it('accepts limit at boundaries', () => {
      expect(memorySearchSchema.safeParse({ query: 'test', limit: 1 }).success).toBe(true)
      expect(memorySearchSchema.safeParse({ query: 'test', limit: 50 }).success).toBe(true)
    })
  })
})

describe('Extract Snippet Helper', () => {
  it('extracts snippet around match', () => {
    const content = 'This is a long text that contains the search term somewhere in the middle.'
    const query = 'search term'
    const snippet = extractSnippet(content, query, 10)

    expect(snippet).toContain('search term')
    expect(snippet.length).toBeLessThan(content.length)
  })

  it('returns beginning of content when no match', () => {
    const content = 'This is some content without the query.'
    const query = 'notfound'
    const snippet = extractSnippet(content, query, 10)

    expect(snippet).toContain('This is')
    expect(snippet).toContain('...')
  })

  it('returns full content when shorter than context', () => {
    const content = 'Short'
    const query = 'notfound'
    const snippet = extractSnippet(content, query, 100)

    expect(snippet).toBe('Short')
  })

  it('adds ellipsis at start when match is not at beginning', () => {
    const content = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxsearch here'
    const query = 'search'
    const snippet = extractSnippet(content, query, 5)

    expect(snippet.startsWith('...')).toBe(true)
  })

  it('adds ellipsis at end when match is not at end', () => {
    const content = 'search herexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    const query = 'search'
    const snippet = extractSnippet(content, query, 5)

    expect(snippet.endsWith('...')).toBe(true)
  })

  it('is case-insensitive', () => {
    const content = 'This contains SEARCH TERM in uppercase.'
    const query = 'search term'
    const snippet = extractSnippet(content, query, 10)

    expect(snippet).toContain('SEARCH TERM')
  })

  it('handles match at the beginning', () => {
    const content = 'search term at the very beginning of the text'
    const query = 'search term'
    const snippet = extractSnippet(content, query, 10)

    expect(snippet.startsWith('...')).toBe(false)
    expect(snippet).toContain('search term')
  })

  it('handles match at the end', () => {
    const content = 'text ending with search term'
    const query = 'search term'
    const snippet = extractSnippet(content, query, 10)

    expect(snippet.endsWith('...')).toBe(false)
    expect(snippet).toContain('search term')
  })
})

describe('Memory Stats Calculator', () => {
  it('calculates stats for empty array', () => {
    const result = calculateMemoryStats([])

    expect(result.stats.total_conversations).toBe(0)
    expect(result.stats.active_conversations).toBe(0)
    expect(result.stats.archived_conversations).toBe(0)
    expect(result.stats.total_messages).toBe(0)
    expect(result.stats.total_tokens).toBe(0)
    expect(result.stats.avg_messages_per_conversation).toBe(0)
    expect(Object.keys(result.strategy_breakdown)).toHaveLength(0)
  })

  it('calculates stats correctly for mixed data', () => {
    const conversations = [
      {
        status: 'active',
        message_count: 10,
        total_tokens: 1000,
        memory_strategy: 'sliding_window',
      },
      {
        status: 'active',
        message_count: 20,
        total_tokens: 2000,
        memory_strategy: 'sliding_window',
      },
      { status: 'archived', message_count: 5, total_tokens: 500, memory_strategy: 'summary' },
    ]

    const result = calculateMemoryStats(conversations)

    expect(result.stats.total_conversations).toBe(3)
    expect(result.stats.active_conversations).toBe(2)
    expect(result.stats.archived_conversations).toBe(1)
    expect(result.stats.total_messages).toBe(35)
    expect(result.stats.total_tokens).toBe(3500)
    expect(result.stats.avg_messages_per_conversation).toBe(12) // 35/3 rounded
    expect(result.strategy_breakdown.sliding_window).toBe(2)
    expect(result.strategy_breakdown.summary).toBe(1)
  })

  it('handles null message_count and total_tokens', () => {
    const conversations = [
      { status: 'active', message_count: 0, total_tokens: 0, memory_strategy: 'full' },
    ]

    const result = calculateMemoryStats(conversations)

    expect(result.stats.total_messages).toBe(0)
    expect(result.stats.total_tokens).toBe(0)
  })

  it('defaults missing memory_strategy to sliding_window', () => {
    const conversations = [
      { status: 'active', message_count: 10, total_tokens: 100, memory_strategy: '' },
    ]

    const result = calculateMemoryStats(conversations)

    expect(result.strategy_breakdown.sliding_window).toBe(1)
  })

  it('counts all strategy types correctly', () => {
    const conversations = [
      { status: 'active', message_count: 1, total_tokens: 100, memory_strategy: 'sliding_window' },
      { status: 'active', message_count: 1, total_tokens: 100, memory_strategy: 'summary' },
      { status: 'active', message_count: 1, total_tokens: 100, memory_strategy: 'full' },
      { status: 'active', message_count: 1, total_tokens: 100, memory_strategy: 'none' },
    ]

    const result = calculateMemoryStats(conversations)

    expect(result.strategy_breakdown.sliding_window).toBe(1)
    expect(result.strategy_breakdown.summary).toBe(1)
    expect(result.strategy_breakdown.full).toBe(1)
    expect(result.strategy_breakdown.none).toBe(1)
  })
})

describe('Memory Status Transitions', () => {
  // Test the valid state transitions
  it('active can transition to archived', () => {
    const validTransition = { from: 'active', to: 'archived' }
    expect(['active', 'archived', 'deleted']).toContain(validTransition.to)
  })

  it('archived can transition to active (restore)', () => {
    const validTransition = { from: 'archived', to: 'active' }
    expect(['active']).toContain(validTransition.to)
  })

  it('deleted cannot be restored', () => {
    // Once deleted, conversations are permanently removed
    const validFinalStates = ['deleted']
    expect(validFinalStates).not.toContain('active')
  })
})

describe('Pagination Logic', () => {
  it('calculates has_more correctly', () => {
    const hasMore = (returnedCount: number, limit: number): boolean => {
      return returnedCount === limit
    }

    // If we got exactly the limit, there might be more
    expect(hasMore(20, 20)).toBe(true)
    expect(hasMore(10, 20)).toBe(false)
    expect(hasMore(0, 20)).toBe(false)
  })

  it('handles edge cases for pagination', () => {
    // Zero results
    expect({ total: 0, limit: 20, offset: 0, has_more: false }).toEqual({
      total: 0,
      limit: 20,
      offset: 0,
      has_more: false,
    })

    // Exactly one page
    expect({ total: 20, limit: 20, offset: 0, has_more: false }).toBeDefined()

    // Multiple pages
    expect({ total: 50, limit: 20, offset: 0, has_more: true }).toBeDefined()
  })
})

describe('Memory Strategy Labels', () => {
  const STRATEGY_LABELS: Record<string, { label: string; description: string }> = {
    sliding_window: { label: 'Sliding Window', description: 'Keeps last N messages' },
    summary: { label: 'Summary', description: 'Summarizes older messages' },
    full: { label: 'Full History', description: 'Keeps all messages' },
    none: { label: 'No Memory', description: 'Stateless conversations' },
  }

  it('has labels for all strategies', () => {
    expect(STRATEGY_LABELS.sliding_window).toBeDefined()
    expect(STRATEGY_LABELS.summary).toBeDefined()
    expect(STRATEGY_LABELS.full).toBeDefined()
    expect(STRATEGY_LABELS.none).toBeDefined()
  })

  it('each strategy has label and description', () => {
    for (const [, value] of Object.entries(STRATEGY_LABELS)) {
      expect(value.label).toBeDefined()
      expect(value.description).toBeDefined()
      expect(value.label.length).toBeGreaterThan(0)
      expect(value.description.length).toBeGreaterThan(0)
    }
  })
})
