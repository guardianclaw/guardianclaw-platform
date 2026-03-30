-- ============================================
-- TOOL CREDENTIALS MIGRATION
-- ============================================
-- Secure storage for external service credentials (API keys).
-- Credentials are encrypted server-side with AES-256-GCM.
--
-- Supported tool types:
-- - serper: Serper.dev API key for web search
-- - openai: OpenAI API key for LLM (BYOK)
-- - custom_api: Generic API keys for custom integrations
--
-- Security model:
-- - Credentials encrypted with server's JWT_SECRET
-- - Only prefix (last 4 chars) stored for identification
-- - Wallet-scoped: each user manages their own credentials

-- ============================================
-- TOOL CREDENTIALS TABLE
-- ============================================
CREATE TABLE tool_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Owner identification
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    -- Tool type determines usage context
    tool_type TEXT NOT NULL CHECK (tool_type IN ('serper', 'openai', 'custom_api')),
    -- User-friendly name for the credential
    name TEXT NOT NULL DEFAULT 'Default',
    -- Encrypted credential (AES-256-GCM)
    credential_encrypted TEXT NOT NULL,
    credential_iv TEXT NOT NULL,
    -- Last 4 characters for identification (not sensitive)
    credential_preview TEXT NOT NULL CHECK (length(credential_preview) <= 8),
    -- Non-sensitive configuration (JSON)
    -- Examples: { "base_url": "https://api.custom.com" }
    config JSONB DEFAULT '{}',
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint: one credential per (wallet, tool_type, name)
    UNIQUE(wallet_address, tool_type, name)
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by wallet (user's credentials)
CREATE INDEX idx_tool_credentials_wallet ON tool_credentials(wallet_address);

-- Fast lookup by tool type (for execution)
CREATE INDEX idx_tool_credentials_wallet_type ON tool_credentials(wallet_address, tool_type)
    WHERE is_active = true;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE tool_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only see their own credentials
CREATE POLICY tool_credentials_select ON tool_credentials
    FOR SELECT USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can only insert their own credentials
CREATE POLICY tool_credentials_insert ON tool_credentials
    FOR INSERT WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Users can only update their own credentials
CREATE POLICY tool_credentials_update ON tool_credentials
    FOR UPDATE USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can only delete their own credentials
CREATE POLICY tool_credentials_delete ON tool_credentials
    FOR DELETE USING (wallet_address = current_setting('app.wallet_address', true));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE TRIGGER tool_credentials_updated_at
    BEFORE UPDATE ON tool_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

/**
 * Increment credential usage counter.
 * Called after successful tool execution.
 */
CREATE OR REPLACE FUNCTION increment_credential_usage(p_credential_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE tool_credentials
    SET
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = p_credential_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get active credential for a wallet and tool type.
 * Returns the first active credential matching the criteria.
 * Use this when you need any credential of a specific type.
 */
CREATE OR REPLACE FUNCTION get_active_credential(
    p_wallet_address TEXT,
    p_tool_type TEXT
)
RETURNS TABLE (
    credential_id UUID,
    credential_encrypted TEXT,
    credential_iv TEXT,
    config JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.id AS credential_id,
        tc.credential_encrypted,
        tc.credential_iv,
        tc.config
    FROM tool_credentials tc
    WHERE tc.wallet_address = p_wallet_address
        AND tc.tool_type = p_tool_type
        AND tc.is_active = true
    ORDER BY tc.created_at ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

/**
 * Get credential by specific ID.
 * Verifies wallet ownership and active status.
 * Use this when you need a specific credential (e.g., from flow config).
 */
CREATE OR REPLACE FUNCTION get_credential_by_id(
    p_wallet_address TEXT,
    p_credential_id UUID
)
RETURNS TABLE (
    credential_id UUID,
    tool_type TEXT,
    credential_encrypted TEXT,
    credential_iv TEXT,
    config JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.id AS credential_id,
        tc.tool_type,
        tc.credential_encrypted,
        tc.credential_iv,
        tc.config
    FROM tool_credentials tc
    WHERE tc.id = p_credential_id
        AND tc.wallet_address = p_wallet_address
        AND tc.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE tool_credentials IS 'Encrypted storage for external service API keys';
COMMENT ON COLUMN tool_credentials.credential_encrypted IS 'AES-256-GCM encrypted API key';
COMMENT ON COLUMN tool_credentials.credential_preview IS 'Last 4 characters for identification';
COMMENT ON COLUMN tool_credentials.config IS 'Non-sensitive configuration (base_url, etc.)';
