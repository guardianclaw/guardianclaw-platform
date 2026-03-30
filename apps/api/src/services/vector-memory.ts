/**
 * Vector Memory Service
 *
 * Embedding generation and semantic search for conversation messages.
 * Uses OpenAI text-embedding-3-small (1536 dims) via the embeddings API.
 *
 * Designed for pgvector integration in Supabase.
 * All embedding operations are non-blocking — they never delay responses.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPES
// ============================================

export interface EmbeddingConfig {
  model: string
  dimensions: number
}

export interface VectorSearchResult {
  message_id: string
  conversation_id: string
  conversation_title?: string | null
  role: string
  content: string
  similarity: number
  created_at?: string
}

export interface VectorSearchOptions {
  agentId: string
  walletAddress: string
  query: string
  topK?: number
  similarityThreshold?: number
  apiKey: string
}

export interface IndexMessageOptions {
  messageId: string
  content: string
  apiKey: string
  supabase: SupabaseClient
}

// ============================================
// CONFIGURATION
// ============================================

export const EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
}

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate an embedding vector for the given text.
 *
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions).
 * Cost: ~$0.02 per 1M tokens — negligible.
 *
 * @returns Array of floats (1536 dimensions), or null if generation fails
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey || !text.trim()) {
    return null
  }

  // Truncate to ~8000 tokens (~32000 chars) to stay within model limits
  const truncated = text.length > 32000 ? text.slice(0, 32000) : text

  try {
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_CONFIG.model,
        input: truncated,
        dimensions: EMBEDDING_CONFIG.dimensions,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[vector-memory] Embedding API error ${response.status}:`, errorText)
      return null
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>
    }

    const embedding = data.data?.[0]?.embedding
    if (!embedding || embedding.length !== EMBEDDING_CONFIG.dimensions) {
      console.error('[vector-memory] Invalid embedding response:', {
        hasData: !!data.data,
        length: embedding?.length,
      })
      return null
    }

    return embedding
  } catch (err) {
    console.error('[vector-memory] Embedding generation failed:', err)
    return null
  }
}

// ============================================
// SEMANTIC SEARCH
// ============================================

/**
 * Search for semantically similar messages using pgvector.
 *
 * Generates an embedding for the query, then performs cosine similarity
 * search against indexed conversation messages.
 *
 * Requires pgvector extension and the `search_similar_messages` RPC function.
 */
export async function searchSimilar(
  supabase: SupabaseClient,
  options: VectorSearchOptions
): Promise<VectorSearchResult[]> {
  const { agentId, walletAddress, query, topK = 10, similarityThreshold = 0.5, apiKey } = options

  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(query, apiKey)
  if (!queryEmbedding) {
    return []
  }

  // Call the RPC function for vector similarity search
  const { data, error } = await supabase.rpc('search_similar_messages', {
    p_agent_id: agentId,
    p_wallet_address: walletAddress,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_threshold: similarityThreshold,
    p_match_count: topK,
  })

  if (error) {
    console.error('[vector-memory] Similarity search error:', error)
    return []
  }

  return (data || []).map(
    (row: {
      message_id: string
      conversation_id: string
      conversation_title?: string | null
      role: string
      content: string
      similarity: number
      created_at?: string
    }) => ({
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      conversation_title: row.conversation_title,
      role: row.role,
      content: row.content,
      similarity: row.similarity,
      created_at: row.created_at,
    })
  )
}

// ============================================
// MESSAGE INDEXING
// ============================================

/**
 * Index a message by generating and storing its embedding.
 *
 * This is designed to be called asynchronously after storing the message.
 * If embedding generation fails, the message is stored without an embedding
 * (text search still works as fallback).
 */
export async function indexMessage(options: IndexMessageOptions): Promise<boolean> {
  const { messageId, content, apiKey, supabase } = options

  const embedding = await generateEmbedding(content, apiKey)
  if (!embedding) {
    return false
  }

  // Store the embedding in the message row
  const { error } = await supabase
    .from('conversation_messages')
    .update({
      embedding: JSON.stringify(embedding),
      embedding_model: EMBEDDING_CONFIG.model,
    })
    .eq('id', messageId)

  if (error) {
    console.error('[vector-memory] Failed to store embedding:', error)
    return false
  }

  return true
}

// ============================================
// BATCH INDEXING (for existing conversations)
// ============================================

/**
 * Index multiple messages that don't have embeddings yet.
 * Useful for backfilling existing conversations.
 *
 * Processes messages sequentially to avoid rate limits.
 * Returns the number of successfully indexed messages.
 */
export async function indexUnembeddedMessages(
  supabase: SupabaseClient,
  agentId: string,
  walletAddress: string,
  apiKey: string,
  limit: number = 50
): Promise<{ indexed: number; failed: number; total: number }> {
  // Get messages without embeddings
  const { data: messages, error } = await supabase
    .from('conversation_messages')
    .select('id, content, conversations!inner(agent_id, wallet_address)')
    .is('embedding', null)
    .eq('conversations.agent_id', agentId)
    .eq('conversations.wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !messages) {
    console.error('[vector-memory] Failed to fetch unembedded messages:', error)
    return { indexed: 0, failed: 0, total: 0 }
  }

  let indexed = 0
  let failed = 0

  for (const msg of messages) {
    const success = await indexMessage({
      messageId: msg.id as string,
      content: msg.content as string,
      apiKey,
      supabase,
    })

    if (success) {
      indexed++
    } else {
      failed++
    }
  }

  return { indexed, failed, total: messages.length }
}
