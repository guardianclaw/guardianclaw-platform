/**
 * Vector Memory Service tests
 *
 * Tests embedding generation, semantic search, and message indexing.
 * Uses mocked fetch for OpenAI API calls and mocked Supabase for DB ops.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateEmbedding,
  searchSimilar,
  indexMessage,
  indexUnembeddedMessages,
  EMBEDDING_CONFIG,
} from './vector-memory'

// ============================================
// MOCK SETUP
// ============================================

const FAKE_API_KEY = 'sk-test-key-for-embeddings'

// Generate a fake embedding of the correct dimension
function fakeEmbedding(seed: number = 0): number[] {
  return Array.from({ length: EMBEDDING_CONFIG.dimensions }, (_, i) => Math.sin(seed + i * 0.01))
}

// Mock OpenAI embeddings API response
function mockEmbeddingResponse(embedding?: number[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: [{ embedding: embedding || fakeEmbedding(), index: 0 }],
      model: EMBEDDING_CONFIG.model,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    }),
    text: async () => '',
  }
}

function mockErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
    text: async () => JSON.stringify({ error: { message } }),
  }
}

// Mock Supabase client
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const updateResult = overrides.updateResult || { error: null }
  const rpcResult = overrides.rpcResult || { data: [], error: null }
  const selectResult = overrides.selectResult || { data: [], error: null }

  const chainMethods = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(selectResult)),
    single: vi.fn().mockImplementation(() => Promise.resolve(selectResult)),
    update: vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => Promise.resolve(updateResult)),
    })),
  }

  return {
    from: vi.fn(() => chainMethods),
    rpc: vi.fn().mockResolvedValue(rpcResult),
    _chain: chainMethods,
  }
}

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

// ============================================
// TESTS
// ============================================

describe('vector-memory', () => {
  // ==========================================
  // generateEmbedding
  // ==========================================
  describe('generateEmbedding', () => {
    it('generates embedding from OpenAI API', async () => {
      const expected = fakeEmbedding(42)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse(expected)))

      const result = await generateEmbedding('test text', FAKE_API_KEY)

      expect(result).toEqual(expected)
      expect(result).toHaveLength(EMBEDDING_CONFIG.dimensions)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_API_KEY}`,
          }),
        })
      )
    })

    it('returns null when API key is missing', async () => {
      const result = await generateEmbedding('test', '')
      expect(result).toBeNull()
    })

    it('returns null when text is empty', async () => {
      const result = await generateEmbedding('', FAKE_API_KEY)
      expect(result).toBeNull()
    })

    it('returns null when text is whitespace only', async () => {
      const result = await generateEmbedding('   ', FAKE_API_KEY)
      expect(result).toBeNull()
    })

    it('returns null on API error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockErrorResponse(429, 'Rate limited')))
      const result = await generateEmbedding('test', FAKE_API_KEY)
      expect(result).toBeNull()
    })

    it('returns null on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
      const result = await generateEmbedding('test', FAKE_API_KEY)
      expect(result).toBeNull()
    })

    it('truncates very long text', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      const longText = 'a'.repeat(50000)
      await generateEmbedding(longText, FAKE_API_KEY)

      const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(callBody.input.length).toBe(32000)
    })

    it('sends correct model and dimensions', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      await generateEmbedding('test', FAKE_API_KEY)

      const callBody = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
      expect(callBody.model).toBe('text-embedding-3-small')
      expect(callBody.dimensions).toBe(1536)
    })

    it('returns null on invalid response shape', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
          text: async () => '',
        })
      )

      const result = await generateEmbedding('test', FAKE_API_KEY)
      expect(result).toBeNull()
    })
  })

  // ==========================================
  // searchSimilar
  // ==========================================
  describe('searchSimilar', () => {
    it('performs semantic search via RPC', async () => {
      const mockResults = [
        {
          message_id: 'm1',
          conversation_id: 'c1',
          role: 'user',
          content: 'related msg',
          similarity: 0.95,
          created_at: '2026-01-01',
        },
        {
          message_id: 'm2',
          conversation_id: 'c1',
          role: 'assistant',
          content: 'response',
          similarity: 0.85,
          created_at: '2026-01-01',
        },
      ]

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      const supabase = createMockSupabase({
        rpcResult: { data: mockResults, error: null },
      })

      const results = await searchSimilar(
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
        {
          agentId: 'agent-1',
          walletAddress: 'wallet-1',
          query: 'find related content',
          apiKey: FAKE_API_KEY,
        }
      )

      expect(results).toHaveLength(2)
      expect(results[0].message_id).toBe('m1')
      expect(results[0].similarity).toBe(0.95)
      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_similar_messages',
        expect.objectContaining({
          p_agent_id: 'agent-1',
          p_wallet_address: 'wallet-1',
          p_match_threshold: 0.5,
          p_match_count: 10,
        })
      )
    })

    it('returns empty array when embedding fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')))

      const supabase = createMockSupabase()
      const results = await searchSimilar(
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
        {
          agentId: 'agent-1',
          walletAddress: 'wallet-1',
          query: 'test',
          apiKey: FAKE_API_KEY,
        }
      )

      expect(results).toEqual([])
      expect(supabase.rpc).not.toHaveBeenCalled()
    })

    it('returns empty array on RPC error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      const supabase = createMockSupabase({
        rpcResult: { data: null, error: { message: 'RPC failed' } },
      })

      const results = await searchSimilar(
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
        {
          agentId: 'agent-1',
          walletAddress: 'wallet-1',
          query: 'test',
          apiKey: FAKE_API_KEY,
        }
      )

      expect(results).toEqual([])
    })

    it('respects custom topK and threshold', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      const supabase = createMockSupabase({
        rpcResult: { data: [], error: null },
      })

      await searchSimilar(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, {
        agentId: 'agent-1',
        walletAddress: 'wallet-1',
        query: 'test',
        topK: 5,
        similarityThreshold: 0.8,
        apiKey: FAKE_API_KEY,
      })

      expect(supabase.rpc).toHaveBeenCalledWith(
        'search_similar_messages',
        expect.objectContaining({
          p_match_threshold: 0.8,
          p_match_count: 5,
        })
      )
    })
  })

  // ==========================================
  // indexMessage
  // ==========================================
  describe('indexMessage', () => {
    it('generates and stores embedding', async () => {
      const embedding = fakeEmbedding(7)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse(embedding)))

      const supabase = createMockSupabase()
      const success = await indexMessage({
        messageId: 'msg-1',
        content: 'test message content',
        apiKey: FAKE_API_KEY,
        supabase: supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
      })

      expect(success).toBe(true)
      expect(supabase.from).toHaveBeenCalledWith('conversation_messages')
      expect(supabase._chain.update).toHaveBeenCalledWith({
        embedding: JSON.stringify(embedding),
        embedding_model: EMBEDDING_CONFIG.model,
      })
    })

    it('returns false when embedding generation fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API fail')))

      const supabase = createMockSupabase()
      const success = await indexMessage({
        messageId: 'msg-1',
        content: 'test',
        apiKey: FAKE_API_KEY,
        supabase: supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
      })

      expect(success).toBe(false)
    })

    it('returns false when DB update fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      const supabase = createMockSupabase()
      // Override the update chain to return an error
      supabase._chain.update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      })

      const success = await indexMessage({
        messageId: 'msg-1',
        content: 'test',
        apiKey: FAKE_API_KEY,
        supabase: supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
      })

      expect(success).toBe(false)
    })
  })

  // ==========================================
  // indexUnembeddedMessages
  // ==========================================
  describe('indexUnembeddedMessages', () => {
    it('indexes messages that lack embeddings', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockEmbeddingResponse()))

      const supabase = createMockSupabase({
        selectResult: {
          data: [
            { id: 'm1', content: 'message 1' },
            { id: 'm2', content: 'message 2' },
          ],
          error: null,
        },
      })

      const result = await indexUnembeddedMessages(
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
        'agent-1',
        'wallet-1',
        FAKE_API_KEY,
        10
      )

      expect(result.total).toBe(2)
      expect(result.indexed).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('handles fetch failure when listing messages', async () => {
      const supabase = createMockSupabase({
        selectResult: { data: null, error: { message: 'DB error' } },
      })

      const result = await indexUnembeddedMessages(
        supabase as unknown as import('@supabase/supabase-js').SupabaseClient,
        'agent-1',
        'wallet-1',
        FAKE_API_KEY
      )

      expect(result.total).toBe(0)
      expect(result.indexed).toBe(0)
    })
  })

  // ==========================================
  // EMBEDDING_CONFIG
  // ==========================================
  describe('config', () => {
    it('uses text-embedding-3-small with 1536 dimensions', () => {
      expect(EMBEDDING_CONFIG.model).toBe('text-embedding-3-small')
      expect(EMBEDDING_CONFIG.dimensions).toBe(1536)
    })
  })
})
