-- Memory Integrity & Vector Memory Migration
--
-- Adds two capabilities to conversation_messages:
-- 1. HMAC message signing (memory integrity)
-- 2. Vector embeddings for semantic search (pgvector)

-- ============================================
-- 1. MEMORY INTEGRITY: HMAC columns
-- ============================================

-- HMAC signature for message authenticity verification
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS message_hmac TEXT;

-- Timestamp used in HMAC signing (Unix seconds)
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS hmac_timestamp BIGINT;

COMMENT ON COLUMN conversation_messages.message_hmac IS 'HMAC-SHA256 signature for memory integrity verification (format: msig_<hex>)';
COMMENT ON COLUMN conversation_messages.hmac_timestamp IS 'Unix timestamp (seconds) used in HMAC signing for replay prevention';

-- ============================================
-- 2. VECTOR MEMORY: pgvector + embeddings
-- ============================================

-- Enable pgvector extension (Supabase has this available)
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding column for semantic search
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Model that generated the embedding (for future model upgrades)
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS embedding_model TEXT;

COMMENT ON COLUMN conversation_messages.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic memory search';
COMMENT ON COLUMN conversation_messages.embedding_model IS 'Model used to generate the embedding (e.g., text-embedding-3-small)';

-- Index for cosine similarity search
-- Using ivfflat with 100 lists (good for up to ~1M rows)
-- Note: This index requires at least some rows to exist; run REINDEX if needed after initial data load
CREATE INDEX IF NOT EXISTS idx_conversation_messages_embedding
ON conversation_messages
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- 3. RPC: Semantic similarity search
-- ============================================

-- Function for searching similar messages across an agent's conversations
CREATE OR REPLACE FUNCTION search_similar_messages(
  p_agent_id UUID,
  p_wallet_address TEXT,
  p_query_embedding TEXT,
  p_match_threshold FLOAT DEFAULT 0.5,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  conversation_title TEXT,
  role TEXT,
  content TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id AS message_id,
    cm.conversation_id,
    c.title AS conversation_title,
    cm.role,
    cm.content,
    1 - (cm.embedding <=> p_query_embedding::vector) AS similarity,
    cm.created_at
  FROM conversation_messages cm
  INNER JOIN conversations c ON c.id = cm.conversation_id
  WHERE c.agent_id = p_agent_id
    AND c.wallet_address = p_wallet_address
    AND c.status != 'deleted'
    AND cm.embedding IS NOT NULL
    AND 1 - (cm.embedding <=> p_query_embedding::vector) >= p_match_threshold
  ORDER BY cm.embedding <=> p_query_embedding::vector
  LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION search_similar_messages IS 'Semantic similarity search across agent conversation messages using pgvector cosine distance';
