-- claw Platform: Conversations Schema
-- Version: 1.0
-- Date: 2026-01-09
-- Purpose: Multi-turn conversation memory for agents

-- ============================================
-- CONVERSATIONS
-- ============================================
-- A conversation is a session between a user and an agent
-- Contains multiple messages exchanged over time

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,

    -- Metadata
    title TEXT,  -- Auto-generated from first message or user-provided
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),

    -- Configuration
    memory_strategy TEXT DEFAULT 'sliding_window' CHECK (
        memory_strategy IN ('sliding_window', 'summary', 'full', 'none')
    ),
    context_window INTEGER DEFAULT 10,  -- Max messages to include in LLM context

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),

    -- Statistics (cached for performance)
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0
);

-- ============================================
-- CONVERSATION MESSAGES
-- ============================================
-- Individual messages within a conversation
-- Note: Content is stored in plaintext for simplicity.
-- For production with sensitive data, consider client-side encryption
-- similar to llm_keys table pattern.

CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Position in conversation (for ordering)
    "position" INTEGER NOT NULL,

    -- Token counts (for context window management)
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- claw validation results
    claw_result JSONB,  -- { input: {...}, output: {...}, blocked: bool }
    blocked BOOLEAN DEFAULT false,
    blocked_reason TEXT,
    blocked_gate TEXT,

    -- Execution metadata
    latency_ms INTEGER,
    model_used TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATION CONTEXT
-- ============================================
-- Stores computed context state for conversations
-- Used for memory summaries, loop state, etc.

CREATE TABLE conversation_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Context type and data
    context_key TEXT NOT NULL,  -- e.g., 'memory_summary', 'loop_state', 'user_preferences'
    context_value JSONB NOT NULL,

    -- Versioning
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(conversation_id, context_key)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_conversations_agent ON conversations(agent_id);
CREATE INDEX idx_conversations_wallet ON conversations(wallet_address);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_position ON conversation_messages(conversation_id, "position");
CREATE INDEX idx_messages_created ON conversation_messages(created_at);

CREATE INDEX idx_context_conversation ON conversation_context(conversation_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own conversations)
-- Note: These require the application to set the wallet_address in the request context

-- ============================================
-- TRIGGERS
-- ============================================

-- Update conversation.updated_at when modified
CREATE TRIGGER conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update conversation.last_message_at and message_count when a message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_at = NOW(),
        message_count = message_count + 1,
        total_tokens = total_tokens + COALESCE(NEW.input_tokens, 0) + COALESCE(NEW.output_tokens, 0),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_conversation
    AFTER INSERT ON conversation_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get recent messages for a conversation (for context building)
-- Returns the last N messages in chronological order (oldest first)
CREATE OR REPLACE FUNCTION get_conversation_context(
    p_conversation_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    msg_position INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT sub.role, sub.content, sub.msg_position, sub.created_at
    FROM (
        SELECT
            m.role,
            m.content,
            m."position" AS msg_position,
            m.created_at
        FROM conversation_messages m
        WHERE m.conversation_id = p_conversation_id
          AND m.blocked = false
        ORDER BY m."position" DESC
        LIMIT p_limit
    ) sub
    ORDER BY sub.msg_position ASC;
END;
$$ LANGUAGE plpgsql;

-- Generate conversation title from first message
CREATE OR REPLACE FUNCTION generate_conversation_title(p_content TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Take first 50 characters, trim whitespace, add ellipsis if truncated
    IF LENGTH(p_content) > 50 THEN
        RETURN TRIM(LEFT(p_content, 50)) || '...';
    ELSE
        RETURN TRIM(p_content);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DEMO DATA (optional, for testing)
-- ============================================
-- No demo data - conversations are user-specific
