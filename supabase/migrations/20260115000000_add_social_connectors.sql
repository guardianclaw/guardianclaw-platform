-- ============================================
-- SOCIAL CONNECTORS MIGRATION
-- ============================================
-- Extends tool_credentials for social platform integration:
-- - Twitter/X API (Bearer Token, OAuth 2.0)
-- - Discord (Bot Token, Webhook)
-- - Telegram (Bot Token)
--
-- Adds social_deliveries table to track outbound posts.

-- ============================================
-- EXTEND TOOL_CREDENTIALS FOR SOCIAL PLATFORMS
-- ============================================

-- Remove old constraint
ALTER TABLE tool_credentials
DROP CONSTRAINT IF EXISTS tool_credentials_tool_type_check;

-- Add new constraint with social platform types
ALTER TABLE tool_credentials
ADD CONSTRAINT tool_credentials_tool_type_check
CHECK (tool_type IN (
    -- Existing types
    'serper', 'openai', 'custom_api',
    -- Social platforms
    'twitter_api', 'discord_bot', 'telegram_bot'
));

-- ============================================
-- SOCIAL DELIVERIES TABLE
-- ============================================
-- Tracks outbound social media posts from agents.
-- Used for audit, retry logic, and analytics.

CREATE TABLE social_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent that triggered the delivery
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Credential used for the delivery
    credential_id UUID NOT NULL REFERENCES tool_credentials(id) ON DELETE CASCADE,

    -- Platform and content
    platform TEXT NOT NULL CHECK (platform IN ('twitter', 'discord', 'telegram')),
    content TEXT NOT NULL,

    -- External references (platform-specific)
    external_id TEXT,      -- Tweet ID, Discord message ID, Telegram message ID
    external_url TEXT,     -- Direct link to the post

    -- Delivery status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'rate_limited')),
    attempts INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,

    -- Error tracking
    error_code TEXT,
    error_message TEXT,

    -- Performance metrics
    delivery_latency_ms INTEGER,

    -- Retry scheduling
    next_retry_at TIMESTAMPTZ,

    -- Configuration snapshot (for debugging)
    delivery_config JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by agent (for agent delivery history)
CREATE INDEX idx_social_deliveries_agent ON social_deliveries(agent_id);

-- Fast lookup by status (for retry queue)
CREATE INDEX idx_social_deliveries_status ON social_deliveries(status)
    WHERE status IN ('pending', 'rate_limited');

-- Fast lookup by credential (for credential usage tracking)
CREATE INDEX idx_social_deliveries_credential ON social_deliveries(credential_id);

-- Time-based queries (for analytics)
CREATE INDEX idx_social_deliveries_created ON social_deliveries(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE social_deliveries ENABLE ROW LEVEL SECURITY;

-- Users can view deliveries for their agents
CREATE POLICY social_deliveries_select ON social_deliveries
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can insert deliveries for their agents
CREATE POLICY social_deliveries_insert ON social_deliveries
    FOR INSERT WITH CHECK (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can update deliveries for their agents
CREATE POLICY social_deliveries_update ON social_deliveries
    FOR UPDATE USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

/**
 * Get pending deliveries for retry processing.
 * Returns deliveries that are pending or rate_limited and due for retry.
 */
CREATE OR REPLACE FUNCTION get_pending_social_deliveries(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    delivery_id UUID,
    agent_id UUID,
    credential_id UUID,
    platform TEXT,
    content TEXT,
    delivery_config JSONB,
    attempts INTEGER,
    max_attempts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sd.id AS delivery_id,
        sd.agent_id,
        sd.credential_id,
        sd.platform,
        sd.content,
        sd.delivery_config,
        sd.attempts,
        sd.max_attempts
    FROM social_deliveries sd
    WHERE sd.status IN ('pending', 'rate_limited')
        AND (sd.next_retry_at IS NULL OR sd.next_retry_at <= NOW())
        AND sd.attempts < sd.max_attempts
    ORDER BY sd.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Mark a delivery as completed successfully.
 */
CREATE OR REPLACE FUNCTION complete_social_delivery(
    p_delivery_id UUID,
    p_external_id TEXT,
    p_external_url TEXT,
    p_latency_ms INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE social_deliveries
    SET
        status = 'success',
        external_id = p_external_id,
        external_url = p_external_url,
        delivery_latency_ms = p_latency_ms,
        completed_at = NOW()
    WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Mark a delivery as failed.
 */
CREATE OR REPLACE FUNCTION fail_social_delivery(
    p_delivery_id UUID,
    p_error_code TEXT,
    p_error_message TEXT,
    p_retry_after_seconds INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_attempts INTEGER;
    v_max_attempts INTEGER;
    v_new_status TEXT;
BEGIN
    -- Get current attempts
    SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
    FROM social_deliveries WHERE id = p_delivery_id;

    -- Determine final status
    IF v_attempts >= v_max_attempts THEN
        v_new_status := 'failed';
    ELSIF p_error_code = 'RATE_LIMITED' THEN
        v_new_status := 'rate_limited';
    ELSE
        v_new_status := 'pending';
    END IF;

    UPDATE social_deliveries
    SET
        status = v_new_status,
        attempts = attempts + 1,
        error_code = p_error_code,
        error_message = p_error_message,
        next_retry_at = CASE
            WHEN p_retry_after_seconds IS NOT NULL THEN NOW() + (p_retry_after_seconds || ' seconds')::INTERVAL
            WHEN v_new_status = 'rate_limited' THEN NOW() + INTERVAL '15 minutes'
            ELSE NOW() + (power(2, v_attempts) || ' minutes')::INTERVAL
        END,
        completed_at = CASE WHEN v_new_status = 'failed' THEN NOW() ELSE NULL END
    WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get delivery statistics for an agent.
 */
CREATE OR REPLACE FUNCTION get_social_delivery_stats(p_agent_id UUID)
RETURNS TABLE (
    platform TEXT,
    total_deliveries BIGINT,
    successful_deliveries BIGINT,
    failed_deliveries BIGINT,
    pending_deliveries BIGINT,
    avg_latency_ms NUMERIC,
    last_delivery_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sd.platform,
        COUNT(*) AS total_deliveries,
        COUNT(*) FILTER (WHERE sd.status = 'success') AS successful_deliveries,
        COUNT(*) FILTER (WHERE sd.status = 'failed') AS failed_deliveries,
        COUNT(*) FILTER (WHERE sd.status IN ('pending', 'rate_limited')) AS pending_deliveries,
        AVG(sd.delivery_latency_ms) FILTER (WHERE sd.status = 'success') AS avg_latency_ms,
        MAX(sd.created_at) AS last_delivery_at
    FROM social_deliveries sd
    WHERE sd.agent_id = p_agent_id
    GROUP BY sd.platform;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE social_deliveries IS 'Tracks outbound social media posts from agents';
COMMENT ON COLUMN social_deliveries.platform IS 'Social platform: twitter, discord, telegram';
COMMENT ON COLUMN social_deliveries.external_id IS 'Platform-specific post/message ID';
COMMENT ON COLUMN social_deliveries.external_url IS 'Direct URL to the posted content';
COMMENT ON COLUMN social_deliveries.delivery_config IS 'Snapshot of configuration used for the delivery';
