/**
 * Conversations API Routes
 *
 * Multi-turn conversation memory for agents.
 * Manages conversation sessions and message history.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import {
  execute,
  extractAnalyticsFields,
  type ContextMessage,
  type ClawConfig,
  type FlowConfig,
} from '../services/execution'
import { logExecution } from '../services/execution-logger'
import { deductCredits, COST_PER_EXECUTION, COST_PER_EXECUTION_BYOK } from '../services/credits'
import { buildCharacterPrompt, type CharacterConfig } from './character'
import {
  signMessage as signMemoryMessage,
  verifyMessageBatch,
  type MemoryIntegrityConfig,
} from '../services/memory-integrity'
import { indexMessage as indexMessageEmbedding } from '../services/vector-memory'

// ===========================================
// SUMMARY CONFIGURATION
// ===========================================

const SUMMARY_CONFIG = {
  // Regenerate summary when message count grows by this amount
  REGENERATE_THRESHOLD: 10,
  // Keep this many recent messages after summary
  RECENT_MESSAGES_KEEP: 6,
  // Maximum tokens for summary generation
  MAX_SUMMARY_TOKENS: 500,
  // Model for summary generation
  SUMMARY_MODEL: 'gpt-4o-mini',
}

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  MODAL_RUNTIME_URL?: string
  OPENAI_API_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const conversationsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes, then wallet-based rate limiting (100/min per wallet)
conversationsRoutes.use('*', authMiddleware)
conversationsRoutes.use('*', walletRateLimitMiddleware())

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
  memory_strategy: z.enum(['sliding_window', 'summary', 'full', 'none']).optional(),
  context_window: z.number().int().min(1).max(100).optional(),
})

const sendMessageSchema = z.object({
  content: z.string().min(1).max(32000),
  flow: z
    .object({
      nodes: z.array(z.any()).optional(),
      edges: z.array(z.any()).optional(),
    })
    .optional(),
})

const updateConversationSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.enum(['active', 'archived']).optional(),
  memory_strategy: z.enum(['sliding_window', 'summary', 'full', 'none']).optional(),
  context_window: z.number().int().min(1).max(100).optional(),
})

const listConversationsQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).optional().default('active'),
  limit: z.string().optional().default('20'),
  offset: z.string().optional().default('0'),
})

// ===========================================
// RESPONSE TYPES
// ===========================================

interface ConversationSummary {
  id: string
  agent_id: string
  title: string | null
  status: string
  memory_strategy: string
  context_window: number
  message_count: number
  total_tokens: number
  created_at: string
  updated_at: string
  last_message_at: string
}

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  position: number
  input_tokens: number | null
  output_tokens: number | null
  blocked: boolean
  blocked_reason: string | null
  blocked_gate: string | null
  latency_ms: number | null
  model_used: string | null
  created_at: string
}

interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[]
}

// ===========================================
// HELPER: Verify agent ownership
// ===========================================

async function verifyAgentOwnership(
  supabase: SupabaseClient,
  agentId: string,
  wallet: string
): Promise<{ success: boolean; agent?: Record<string, unknown>; error?: string }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name, flow, config, claw_config')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return { success: false, error: 'Agent not found' }
  }

  return { success: true, agent }
}

// ===========================================
// HELPER: Verify conversation ownership
// ===========================================

async function verifyConversationOwnership(
  supabase: SupabaseClient,
  conversationId: string,
  agentId: string,
  wallet: string
): Promise<{ success: boolean; conversation?: Record<string, unknown>; error?: string }> {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !conversation) {
    return { success: false, error: 'Conversation not found' }
  }

  return { success: true, conversation }
}

// ===========================================
// HELPER: Generate summary using OpenAI
// ===========================================

interface SummaryContext {
  summary: string
  summarized_up_to_position: number
  generated_at: string
  message_count_at_generation: number
}

async function generateSummaryWithLLM(
  messages: Array<{ role: string; content: string }>,
  openaiKey: string
): Promise<string> {
  // Format messages for summarization
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const systemPrompt = `You are a conversation summarizer. Create a concise summary of the following conversation that preserves:
1. Key topics discussed
2. Important decisions or conclusions
3. Any relevant context for future messages
4. User preferences or requirements mentioned

Keep the summary under ${SUMMARY_CONFIG.MAX_SUMMARY_TOKENS} tokens. Be factual and objective.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: SUMMARY_CONFIG.SUMMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarize this conversation:\n\n${conversationText}` },
        ],
        max_tokens: SUMMARY_CONFIG.MAX_SUMMARY_TOKENS,
        temperature: 0.3, // Lower temperature for more consistent summaries
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI summary generation failed:', errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }

    return data.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Summary generation error:', error)
    throw error
  }
}

// ===========================================
// HELPER: Get or create conversation summary
// ===========================================

async function getOrCreateSummary(
  supabase: SupabaseClient,
  conversationId: string,
  messageCount: number,
  openaiKey: string | undefined
): Promise<SummaryContext | null> {
  // Check if we have an existing valid summary
  const { data: existingContext } = await supabase
    .from('conversation_context')
    .select('context_value')
    .eq('conversation_id', conversationId)
    .eq('context_key', 'memory_summary')
    .single()

  if (existingContext?.context_value) {
    const summaryData = existingContext.context_value as SummaryContext

    // Check if summary is still valid (message count hasn't grown too much)
    const messagesSinceSummary = messageCount - summaryData.message_count_at_generation

    if (messagesSinceSummary < SUMMARY_CONFIG.REGENERATE_THRESHOLD) {
      // Summary is still valid
      return summaryData
    }
  }

  // Need to generate new summary
  if (!openaiKey) {
    console.warn('Cannot generate summary: no OpenAI API key configured')
    return null
  }

  // Get all messages except the most recent ones (which we'll include directly)
  const { data: messages } = await supabase
    .from('conversation_messages')
    .select('role, content, position')
    .eq('conversation_id', conversationId)
    .eq('blocked', false)
    .order('position', { ascending: true })
    .limit(1000)

  if (!messages || messages.length <= SUMMARY_CONFIG.RECENT_MESSAGES_KEEP) {
    // Not enough messages to summarize
    return null
  }

  // Messages to summarize (all except recent ones)
  const messagesToSummarize = messages.slice(0, -SUMMARY_CONFIG.RECENT_MESSAGES_KEEP)

  if (messagesToSummarize.length === 0) {
    return null
  }

  try {
    const summary = await generateSummaryWithLLM(
      messagesToSummarize.map((m) => ({ role: m.role, content: m.content })),
      openaiKey
    )

    const lastSummarizedPosition = messagesToSummarize[messagesToSummarize.length - 1].position

    const summaryContext: SummaryContext = {
      summary,
      summarized_up_to_position: lastSummarizedPosition,
      generated_at: new Date().toISOString(),
      message_count_at_generation: messageCount,
    }

    // Upsert the summary in conversation_context
    // Calculate version: increment if existing, otherwise start at 1
    const existingVersion = existingContext?.context_value
      ? (existingContext.context_value as { version?: number }).version || 0
      : 0

    await supabase.from('conversation_context').upsert(
      {
        conversation_id: conversationId,
        context_key: 'memory_summary',
        context_value: summaryContext,
        version: existingVersion + 1,
      },
      {
        onConflict: 'conversation_id,context_key',
      }
    )

    return summaryContext
  } catch (error) {
    console.error('Failed to generate summary:', error)
    return null
  }
}

// ===========================================
// HELPER: Build conversation context
// ===========================================

interface ConversationContextResult {
  messages: ContextMessage[]
  memory_strategy: string
  effective_strategy: string
  fallback_reason?: string
}

async function buildConversationContext(
  supabase: SupabaseClient,
  conversationId: string,
  memoryStrategy: string,
  contextWindow: number,
  messageCount: number = 0,
  openaiKey?: string,
  integrityConfig?: MemoryIntegrityConfig | null,
  serverSecret?: string,
  agentId?: string
): Promise<ConversationContextResult> {
  // For 'none' strategy, return empty context
  if (memoryStrategy === 'none') {
    return { messages: [], memory_strategy: memoryStrategy, effective_strategy: 'none' }
  }

  // For 'full' strategy, get all messages (up to 1000)
  const limit = memoryStrategy === 'full' ? 1000 : contextWindow * 2 // Get more than needed for sliding window

  // Always select HMAC fields — negligible overhead, avoids Supabase type parser issues
  const { data: rawMessages, error } = await supabase
    .from('conversation_messages')
    .select('id, role, content, position, message_hmac, hmac_timestamp, created_at')
    .eq('conversation_id', conversationId)
    .eq('blocked', false)
    .order('position', { ascending: true })
    .limit(limit)

  if (error || !rawMessages) {
    return { messages: [], memory_strategy: memoryStrategy, effective_strategy: memoryStrategy }
  }

  // Cast to a usable type (Supabase returns typed results)
  const messages = rawMessages as Array<{
    id: string
    role: string
    content: string
    position: number
    message_hmac?: string | null
    hmac_timestamp?: number | null
    created_at?: string
  }>

  // Apply memory integrity verification if enabled
  let filteredMessages: Array<{ role: string; content: string; position: number }> = messages
  if (integrityConfig?.enabled && integrityConfig?.verify_on_read && serverSecret && agentId) {
    const verificationResult = await verifyMessageBatch(
      messages,
      serverSecret,
      agentId,
      integrityConfig.min_trust_score ?? 0.5
    )

    if (verificationResult.excluded_count > 0) {
      console.warn(
        `[memory-integrity] Excluded ${verificationResult.excluded_count}/${verificationResult.total_count} messages below trust threshold for conversation ${conversationId}`
      )
    }

    filteredMessages = verificationResult.messages.map((m) => ({
      role: m.role,
      content: m.content,
      position: messages.find((orig) => orig.id === m.id)?.position ?? 0,
    }))
  }

  // For sliding_window, take the last N messages
  if (memoryStrategy === 'sliding_window') {
    const recentMessages = filteredMessages.slice(-contextWindow)
    return {
      messages: recentMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      memory_strategy: memoryStrategy,
      effective_strategy: 'sliding_window',
    }
  }

  // For 'summary' strategy - use LLM to summarize older messages
  // and prepend the summary as a system message with recent messages
  if (memoryStrategy === 'summary') {
    // Try to get or create a summary
    const summaryContext = await getOrCreateSummary(
      supabase,
      conversationId,
      messageCount,
      openaiKey
    )

    if (summaryContext && summaryContext.summary) {
      // Get only messages after the summarized position (using filtered set)
      const recentMessages = filteredMessages.filter(
        (m) => m.position > summaryContext.summarized_up_to_position
      )

      // Build context: summary as system message + recent messages
      const contextMessages: ContextMessage[] = [
        {
          role: 'system',
          content: `[Previous conversation summary]\n${summaryContext.summary}`,
        },
        ...recentMessages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ]

      return {
        messages: contextMessages,
        memory_strategy: memoryStrategy,
        effective_strategy: 'summary',
      }
    }

    // Fallback to sliding_window if summary couldn't be generated
    const fallbackReason = !openaiKey
      ? 'no_api_key'
      : messageCount <= SUMMARY_CONFIG.RECENT_MESSAGES_KEEP
        ? 'insufficient_messages'
        : 'generation_failed'

    const recentMessages = filteredMessages.slice(-contextWindow)
    return {
      messages: recentMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      memory_strategy: memoryStrategy,
      effective_strategy: 'sliding_window',
      fallback_reason: fallbackReason,
    }
  }

  // Default: return all fetched messages (using filtered set)
  return {
    messages: filteredMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    memory_strategy: memoryStrategy,
    effective_strategy: memoryStrategy,
  }
}

// ===========================================
// HELPER: Generate title from first message
// ===========================================

function generateTitleFromMessage(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, ' ')
  if (cleaned.length <= 50) {
    return cleaned
  }
  return cleaned.substring(0, 50) + '...'
}

// ===========================================
// ROUTES
// ===========================================

// POST /agents/:agentId/conversations - Create new conversation
conversationsRoutes.post('/:agentId/conversations', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => ({}))
  const parsed = createConversationSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Create conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      agent_id: agentId,
      wallet_address: wallet,
      title: parsed.data.title || null,
      memory_strategy: parsed.data.memory_strategy || 'sliding_window',
      context_window: parsed.data.context_window || 10,
    })
    .select()
    .single()

  if (error) {
    console.error('Create conversation error:', error)
    return c.json({ error: 'Failed to create conversation' }, 500)
  }

  return c.json(conversation, 201)
})

// GET /agents/:agentId/conversations - List conversations
conversationsRoutes.get('/:agentId/conversations', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const query = c.req.query()
  const parsed = listConversationsQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const { status, limit, offset } = parsed.data
  const limitNum = Math.min(parseInt(limit, 10), 100)
  const offsetNum = parseInt(offset, 10)

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  // Build query
  let dbQuery = supabase
    .from('conversations')
    .select(
      'id, agent_id, title, status, memory_strategy, context_window, message_count, total_tokens, created_at, updated_at, last_message_at'
    )
    .eq('agent_id', agentId)
    .eq('wallet_address', wallet)
    .order('last_message_at', { ascending: false })
    .range(offsetNum, offsetNum + limitNum - 1)

  // Filter by status
  if (status !== 'all') {
    dbQuery = dbQuery.eq('status', status)
  } else {
    dbQuery = dbQuery.neq('status', 'deleted')
  }

  const { data, error } = await dbQuery

  if (error) {
    console.error('List conversations error:', error)
    return c.json({ error: 'Failed to list conversations' }, 500)
  }

  return c.json({
    conversations: data as ConversationSummary[],
    pagination: {
      limit: limitNum,
      offset: offsetNum,
      hasMore: data?.length === limitNum,
    },
  })
})

// GET /agents/:agentId/conversations/:conversationId - Get conversation with messages
conversationsRoutes.get('/:agentId/conversations/:conversationId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify agent ownership
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
    return c.json({ error: 'Conversation not found' }, 404)
  }

  // Get messages (last 100 by default)
  const { data: messages, error: msgError } = await supabase
    .from('conversation_messages')
    .select(
      'id, role, content, position, input_tokens, output_tokens, blocked, blocked_reason, blocked_gate, latency_ms, model_used, created_at'
    )
    .eq('conversation_id', conversationId)
    .order('position', { ascending: true })
    .limit(100)

  if (msgError) {
    console.error('Get messages error:', msgError)
    return c.json({ error: 'Failed to get messages' }, 500)
  }

  const result: ConversationDetail = {
    ...conversation,
    messages: messages as ConversationMessage[],
  }

  return c.json(result)
})

// PATCH /agents/:agentId/conversations/:conversationId - Update conversation
conversationsRoutes.patch('/:agentId/conversations/:conversationId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')

  const body = await c.req.json()
  const parsed = updateConversationSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const convCheck = await verifyConversationOwnership(supabase, conversationId, agentId, wallet)
  if (!convCheck.success) {
    return c.json({ error: convCheck.error }, 404)
  }

  // Build update data
  const updateData: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status
  if (parsed.data.memory_strategy !== undefined)
    updateData.memory_strategy = parsed.data.memory_strategy
  if (parsed.data.context_window !== undefined)
    updateData.context_window = parsed.data.context_window

  const { data, error } = await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId)
    .select()
    .single()

  if (error) {
    console.error('Update conversation error:', error)
    return c.json({ error: 'Failed to update conversation' }, 500)
  }

  return c.json(data)
})

// DELETE /agents/:agentId/conversations/:conversationId - Archive conversation
conversationsRoutes.delete('/:agentId/conversations/:conversationId', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const convCheck = await verifyConversationOwnership(supabase, conversationId, agentId, wallet)
  if (!convCheck.success) {
    return c.json({ error: convCheck.error }, 404)
  }

  // Soft delete by setting status to archived
  const { error } = await supabase
    .from('conversations')
    .update({ status: 'archived' })
    .eq('id', conversationId)

  if (error) {
    console.error('Delete conversation error:', error)
    return c.json({ error: 'Failed to archive conversation' }, 500)
  }

  return c.json({ success: true })
})

// POST /agents/:agentId/conversations/:conversationId/messages - Send message
// Optional X-LLM-Key header for BYOK (user's own LLM key)
conversationsRoutes.post('/:agentId/conversations/:conversationId/messages', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const conversationId = c.req.param('conversationId')
  const userLlmKey = c.req.header('X-LLM-Key') // BYOK support

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = sendMessageSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    // Verify agent ownership and get agent data
    const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
    if (!agentCheck.success) {
      return c.json({ error: agentCheck.error }, 404)
    }
    const agent = agentCheck.agent!

    // Verify conversation ownership and get conversation data
    const convCheck = await verifyConversationOwnership(supabase, conversationId, agentId, wallet)
    if (!convCheck.success) {
      return c.json({ error: convCheck.error }, 404)
    }
    const conversation = convCheck.conversation! as {
      message_count: number
      memory_strategy: string
      context_window: number
      title: string | null
    }

    const { content, flow: overrideFlow } = parsed.data
    const agentFlow = (overrideFlow || agent.flow) as FlowConfig

    // Check and deduct credits before processing
    const cost = userLlmKey ? COST_PER_EXECUTION_BYOK : COST_PER_EXECUTION
    const creditResult = await deductCredits(supabase, wallet, cost)

    if (!creditResult.success) {
      const errorCode = creditResult.error || 'INSUFFICIENT_CREDITS'
      const errorMessage =
        errorCode === 'NO_CREDITS_ACCOUNT'
          ? 'No credits account found. Please deposit credits to continue.'
          : 'Insufficient credits. Please deposit more credits to continue.'

      return c.json(
        {
          error: errorMessage,
          code: errorCode,
          balance_usd: creditResult.new_balance,
          required_usd: cost,
          hint: 'Deposit credits at /credits/deposit',
          pricing: {
            cost_per_execution: cost,
            minimum_deposit: 3.0,
          },
        },
        402
      )
    }

    const balanceBefore = creditResult.balance_before
    const balanceAfter = creditResult.new_balance

    // Get next position
    const nextPosition = conversation.message_count + 1

    // Extract memory integrity config from agent character settings
    const agentConfig = (agent.config || {}) as Record<string, unknown>
    const memoryIntegrity = (agentConfig.memory_integrity || null) as MemoryIntegrityConfig | null
    const shouldSign =
      memoryIntegrity?.enabled && memoryIntegrity?.sign_on_write && c.env.JWT_SECRET

    // Sign user message if memory integrity is enabled
    let userHmac: string | undefined
    let userHmacTimestamp: number | undefined
    if (shouldSign) {
      const signed = await signMemoryMessage(content, c.env.JWT_SECRET, agentId)
      userHmac = signed.hmac
      userHmacTimestamp = signed.timestamp
    }

    // Store user message first
    const { data: userMessage, error: userMsgError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content,
        position: nextPosition,
        ...(userHmac && { message_hmac: userHmac, hmac_timestamp: userHmacTimestamp }),
      })
      .select()
      .single()

    if (userMsgError) {
      console.error(
        'Store user message error:',
        userMsgError.message,
        userMsgError.code,
        userMsgError.details
      )
      return c.json(
        {
          error: 'Failed to store message',
          detail: userMsgError.message,
          code: userMsgError.code,
        },
        500
      )
    }

    // Auto-generate title from first message if not set
    if (!conversation.title && nextPosition === 1) {
      await supabase
        .from('conversations')
        .update({ title: generateTitleFromMessage(content) })
        .eq('id', conversationId)
    }

    // Build conversation context for LLM
    // For 'summary' strategy, we pass the message count and OpenAI key
    // to enable LLM-based summarization of older messages.
    // Memory integrity verification filters untrusted messages from context.
    const contextResult = await buildConversationContext(
      supabase,
      conversationId,
      conversation.memory_strategy,
      conversation.context_window,
      conversation.message_count,
      c.env.OPENAI_API_KEY,
      memoryIntegrity,
      c.env.JWT_SECRET,
      agentId
    )
    const historyMessages = contextResult.messages

    // Build character prompt if agent has character config
    const characterConfig = agentConfig.character as CharacterConfig | undefined
    const characterPrompt = characterConfig ? buildCharacterPrompt(characterConfig) : undefined

    // Execute using the shared execution service
    // Priority: userLlmKey (BYOK) > openaiKey (server) > simulation
    const clawConfig = (agent.claw_config || {}) as ClawConfig
    const executionResult = await execute({
      modalEndpoint: c.env.MODAL_RUNTIME_URL,
      openaiKey: c.env.OPENAI_API_KEY,
      userLlmKey, // BYOK takes priority if provided
      flow: agentFlow,
      message: content,
      history: historyMessages,
      clawConfig,
      characterPrompt,
      // Provide credentials context for tool execution
      toolCredentials: {
        supabase,
        walletAddress: wallet,
        serverSecret: c.env.JWT_SECRET,
      },
      // Provide context for social media delivery
      socialContext: {
        supabase,
        agentId: agent.id as string,
        agentName: (agent as { name?: string }).name,
        serverSecret: c.env.JWT_SECRET,
      },
    })

    // Sign assistant message if memory integrity is enabled
    const assistantContent = executionResult.blocked
      ? `[Blocked by GuardianClaw: ${executionResult.reason}]`
      : executionResult.response || ''

    let assistantHmac: string | undefined
    let assistantHmacTimestamp: number | undefined
    if (shouldSign) {
      const signed = await signMemoryMessage(assistantContent, c.env.JWT_SECRET, agentId)
      assistantHmac = signed.hmac
      assistantHmacTimestamp = signed.timestamp
    }

    // Store assistant response
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
        position: nextPosition + 1,
        input_tokens: executionResult.inputTokens || null,
        output_tokens: executionResult.outputTokens || null,
        blocked: executionResult.blocked,
        blocked_reason: executionResult.reason || null,
        blocked_gate: executionResult.gate || null,
        latency_ms: executionResult.latency_ms || null,
        model_used: executionResult.model || null,
        claw_result: executionResult.claw || null,
        ...(assistantHmac && {
          message_hmac: assistantHmac,
          hmac_timestamp: assistantHmacTimestamp,
        }),
      })
      .select()
      .single()

    if (assistantMsgError) {
      console.error('Store assistant message error:', assistantMsgError)
      // Don't fail - user message was stored
    }

    // Index messages for vector search (non-blocking, fire-and-forget)
    // Uses OpenAI embeddings API to enable semantic memory search
    const embeddingKey = userLlmKey || c.env.OPENAI_API_KEY
    if (embeddingKey) {
      const doIndex = async () => {
        if (userMessage?.id) {
          await indexMessageEmbedding({
            messageId: userMessage.id,
            content,
            apiKey: embeddingKey,
            supabase,
          })
        }
        if (assistantMessage?.id && !executionResult.blocked) {
          await indexMessageEmbedding({
            messageId: assistantMessage.id,
            content: assistantContent,
            apiKey: embeddingKey,
            supabase,
          })
        }
      }
      doIndex().catch((err) => console.error('[vector-memory] Indexing failed:', err))
    }

    // Log event with v2 analytics fields + credit tracking
    const analyticsFields = extractAnalyticsFields(
      agentId,
      'conversation_message',
      executionResult,
      {
        inputTokensEstimate: Math.ceil(content.length / 4),
        outputTokensEstimate: executionResult.response
          ? Math.ceil(executionResult.response.length / 4)
          : 0,
      }
    )
    await supabase.from('agent_events').insert({
      ...analyticsFields,
      cost_usd: cost,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
    })

    // Log execution with trace for debugging (non-blocking)
    logExecution({
      supabase,
      agentId,
      eventSource: 'conversation',
      conversationId,
      inputText: content,
      result: executionResult,
    }).catch((err) => console.error('Failed to log execution:', err))

    return c.json({
      user_message: userMessage,
      assistant_message: assistantMessage,
      blocked: executionResult.blocked,
      response: executionResult.blocked
        ? `Request blocked by GuardianClaw (${executionResult.reason || 'validation failed'})`
        : assistantContent,
      reason: executionResult.reason,
      gate: executionResult.gate,
      claw: executionResult.claw,
      latency_ms: executionResult.latency_ms,
      trace: executionResult.trace,
      credits: {
        cost,
        balance_after: balanceAfter,
      },
      memory: {
        strategy: contextResult.memory_strategy,
        effective_strategy: contextResult.effective_strategy,
        ...(contextResult.fallback_reason && { fallback_reason: contextResult.fallback_reason }),
      },
    })
  } catch (err) {
    console.error('Unhandled error in POST messages handler:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: 'Failed to process message', detail: message }, 500)
  }
})
