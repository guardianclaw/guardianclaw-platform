/**
 * Memory Management API Routes
 *
 * Provides a memory-focused API for managing agent conversations and context.
 * Built on top of the conversations infrastructure.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { searchSimilar, type VectorSearchResult } from '../services/vector-memory'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  OPENAI_API_KEY?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const memoriesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes
memoriesRoutes.use('*', authMiddleware)
memoriesRoutes.use('*', walletRateLimitMiddleware())

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const listMemoriesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['active', 'archived', 'all']).default('all'),
  search: z.string().max(200).optional(),
})

const memorySearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.coerce.number().min(1).max(50).default(10),
  search_type: z.enum(['text', 'semantic']).default('text'),
  similarity_threshold: z.coerce.number().min(0).max(1).default(0.5).optional(),
})

// ===========================================
// HELPERS
// ===========================================

async function verifyAgentOwnership(
  supabase: SupabaseClient,
  agentId: string,
  wallet: string
): Promise<{ success: boolean; agent?: Record<string, unknown>; error?: string }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return { success: false, error: 'Agent not found' }
  }

  return { success: true, agent }
}

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /agents/:agentId/memories
 * List all memory sessions (conversations) for an agent.
 */
memoriesRoutes.get('/:agentId/memories', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const query = c.req.query()
  const parsed = listMemoriesQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, 400)
  }

  const { limit, offset, status, search } = parsed.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Build query
  let dbQuery = supabase
    .from('conversations')
    .select(
      `
      id,
      title,
      status,
      memory_strategy,
      context_window,
      message_count,
      total_tokens,
      created_at,
      updated_at,
      last_message_at
    `
    )
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .order('last_message_at', { ascending: false })

  // Filter by status
  if (status !== 'all') {
    dbQuery = dbQuery.eq('status', status)
  } else {
    dbQuery = dbQuery.neq('status', 'deleted')
  }

  // Search by title
  if (search) {
    dbQuery = dbQuery.ilike('title', `%${search}%`)
  }

  // Apply pagination
  dbQuery = dbQuery.range(offset, offset + limit - 1)

  const { data: conversations, error } = await dbQuery

  if (error) {
    console.error('List memories error:', error)
    return c.json({ error: 'Failed to list memories' }, 500)
  }

  // Get total count
  let countQuery = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)

  if (status !== 'all') {
    countQuery = countQuery.eq('status', status)
  } else {
    countQuery = countQuery.neq('status', 'deleted')
  }

  if (search) {
    countQuery = countQuery.ilike('title', `%${search}%`)
  }

  const { count } = await countQuery

  return c.json({
    memories: conversations || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      has_more: (conversations?.length || 0) === limit,
    },
  })
})

/**
 * GET /agents/:agentId/memories/stats
 * Get memory statistics for an agent.
 */
memoriesRoutes.get('/:agentId/memories/stats', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Get conversation stats
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, status, message_count, total_tokens, memory_strategy')
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .neq('status', 'deleted')

  if (convError) {
    console.error('Memory stats error:', convError)
    return c.json({ error: 'Failed to get memory stats' }, 500)
  }

  // Calculate stats
  const totalConversations = conversations?.length || 0
  const activeConversations = conversations?.filter((c) => c.status === 'active').length || 0
  const archivedConversations = conversations?.filter((c) => c.status === 'archived').length || 0
  const totalMessages = conversations?.reduce((sum, c) => sum + (c.message_count || 0), 0) || 0
  const totalTokens = conversations?.reduce((sum, c) => sum + (c.total_tokens || 0), 0) || 0

  // Group by memory strategy
  const strategyBreakdown: Record<string, number> = {}
  for (const conv of conversations || []) {
    const strategy = conv.memory_strategy || 'sliding_window'
    strategyBreakdown[strategy] = (strategyBreakdown[strategy] || 0) + 1
  }

  return c.json({
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
  })
})

/**
 * GET /agents/:agentId/memories/:conversationId
 * Get a specific memory session with messages.
 */
memoriesRoutes.get('/:agentId/memories/:conversationId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (convError || !conversation) {
    return c.json({ error: 'Memory session not found' }, 404)
  }

  // Get messages
  const { data: messages, error: msgError } = await supabase
    .from('conversation_messages')
    .select(
      `
      id,
      role,
      content,
      position,
      input_tokens,
      output_tokens,
      blocked,
      blocked_reason,
      blocked_gate,
      latency_ms,
      model_used,
      created_at
    `
    )
    .eq('conversation_id', conversationId)
    .order('position', { ascending: true })
    .limit(500)

  if (msgError) {
    console.error('Get messages error:', msgError)
    return c.json({ error: 'Failed to get messages' }, 500)
  }

  // Get context (summaries, etc.)
  const { data: context } = await supabase
    .from('conversation_context')
    .select('context_key, context_value, updated_at')
    .eq('conversation_id', conversationId)

  return c.json({
    ...conversation,
    messages: messages || [],
    context: context || [],
  })
})

/**
 * DELETE /agents/:agentId/memories/:conversationId
 * Delete a specific memory session.
 */
memoriesRoutes.delete('/:agentId/memories/:conversationId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')
  const permanent = c.req.query('permanent') === 'true'

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Verify conversation belongs to agent
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (convError || !conversation) {
    return c.json({ error: 'Memory session not found' }, 404)
  }

  if (permanent) {
    // Permanently delete (CASCADE will delete messages and context)
    const { error } = await supabase.from('conversations').delete().eq('id', conversationId)

    if (error) {
      console.error('Delete memory error:', error)
      return c.json({ error: 'Failed to delete memory' }, 500)
    }

    return c.json({ success: true, deleted: true })
  } else {
    // Soft delete by archiving
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', conversationId)

    if (error) {
      console.error('Archive memory error:', error)
      return c.json({ error: 'Failed to archive memory' }, 500)
    }

    return c.json({ success: true, archived: true })
  }
})

/**
 * DELETE /agents/:agentId/memories
 * Clear all memories for an agent.
 */
memoriesRoutes.delete('/:agentId/memories', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const permanent = c.req.query('permanent') === 'true'
  const _status = c.req.query('status') // Optional: only clear specific status

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  if (permanent) {
    // Count before delete
    const { count } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('wallet_address', wallet)
      .neq('status', 'deleted')

    // Permanently delete all
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('agent_id', agentId)
      .eq('wallet_address', wallet)

    if (error) {
      console.error('Clear memories error:', error)
      return c.json({ error: 'Failed to clear memories' }, 500)
    }

    return c.json({
      success: true,
      deleted: true,
      count: count || 0,
    })
  } else {
    // Count before archive
    const { count } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('wallet_address', wallet)
      .eq('status', 'active')

    // Soft delete by archiving all active
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('agent_id', agentId)
      .eq('wallet_address', wallet)
      .eq('status', 'active')

    if (error) {
      console.error('Archive memories error:', error)
      return c.json({ error: 'Failed to archive memories' }, 500)
    }

    return c.json({
      success: true,
      archived: true,
      count: count || 0,
    })
  }
})

/**
 * POST /agents/:agentId/memories/search
 * Search through memory messages.
 */
memoriesRoutes.post('/:agentId/memories/search', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => ({}))
  const parsed = memorySearchSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid search query', details: parsed.error.flatten() }, 400)
  }

  const { query, limit, search_type, similarity_threshold } = parsed.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Semantic search via vector embeddings (pgvector)
  if (search_type === 'semantic') {
    const apiKey = c.req.header('X-LLM-Key') || c.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json(
        {
          error:
            'Semantic search requires an OpenAI API key. Provide X-LLM-Key header or configure server key.',
          code: 'NO_EMBEDDING_KEY',
        },
        400
      )
    }

    const vectorResults = await searchSimilar(supabase, {
      agentId,
      walletAddress: wallet,
      query,
      topK: limit,
      similarityThreshold: similarity_threshold ?? 0.5,
      apiKey,
    })

    return c.json({
      query,
      search_type: 'semantic',
      results: vectorResults.map((r: VectorSearchResult) => ({
        message_id: r.message_id,
        conversation_id: r.conversation_id,
        conversation_title: r.conversation_title,
        role: r.role,
        content: r.content,
        similarity: r.similarity,
        created_at: r.created_at,
        snippet: extractSnippet(r.content, query),
      })),
      count: vectorResults.length,
    })
  }

  // Text search (default — simple ilike)
  const { data: messages, error } = await supabase
    .from('conversation_messages')
    .select(
      `
      id,
      conversation_id,
      role,
      content,
      position,
      created_at,
      conversations!inner (
        id,
        title,
        agent_id,
        wallet_address
      )
    `
    )
    .eq('conversations.agent_id', agentId)
    .eq('conversations.wallet_address', wallet)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Memory search error:', error)
    return c.json({ error: 'Failed to search memories' }, 500)
  }

  // Format results
  const results = (messages || []).map((m) => ({
    message_id: m.id,
    conversation_id: m.conversation_id,
    conversation_title: (m.conversations as { title?: string })?.title,
    role: m.role,
    content: m.content,
    position: m.position,
    created_at: m.created_at,
    snippet: extractSnippet(m.content, query),
  }))

  return c.json({
    query,
    search_type: 'text',
    results,
    count: results.length,
  })
})

/**
 * Extract a snippet around the search query.
 */
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

/**
 * POST /agents/:agentId/memories/:conversationId/restore
 * Restore an archived memory session.
 */
memoriesRoutes.post('/:agentId/memories/:conversationId/restore', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Verify conversation exists and is archived
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('id', conversationId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (convError || !conversation) {
    return c.json({ error: 'Memory session not found' }, 404)
  }

  if (conversation.status !== 'archived') {
    return c.json({ error: 'Memory session is not archived' }, 400)
  }

  // Restore by setting status to active
  const { error } = await supabase
    .from('conversations')
    .update({ status: 'active' })
    .eq('id', conversationId)

  if (error) {
    console.error('Restore memory error:', error)
    return c.json({ error: 'Failed to restore memory' }, 500)
  }

  return c.json({ success: true, restored: true })
})
