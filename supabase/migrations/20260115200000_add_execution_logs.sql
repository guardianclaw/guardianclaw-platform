-- ============================================
-- EXECUTION LOGS MIGRATION
-- ============================================
-- Provides detailed execution logging for debugging and monitoring.
-- Captures full execution trace without sensitive content per security model.
--
-- Design decisions:
-- - input_preview/output_preview store only first 100 chars (debug, not data)
-- - trace stores execution steps as JSONB
-- - Separate from agent_events (analytics) which is aggregated metrics only
-- - 30-day default retention with cleanup function

-- ============================================
-- EXECUTION LOGS TABLE
-- ============================================

CREATE TABLE execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent reference
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Event source (invoke, conversation, webhook, test)
    event_source TEXT NOT NULL DEFAULT 'invoke'
        CHECK (event_source IN ('invoke', 'conversation', 'webhook', 'test')),

    -- Conversation reference (optional, for conversation-based executions)
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

    -- Execution status
    status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'blocked', 'error')),

    -- Content previews (first 100 chars for debugging)
    input_preview TEXT,
    output_preview TEXT,

    -- Metrics
    latency_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Blocking information
    blocked_by_layer TEXT CHECK (blocked_by_layer IN ('L1', 'L3', 'L4')),
    blocked_gate TEXT,
    blocked_reason TEXT,

    -- Execution trace (step-by-step details)
    trace JSONB DEFAULT '[]',

    -- Tool execution summary
    tools_executed INTEGER DEFAULT 0,
    tools_succeeded INTEGER DEFAULT 0,

    -- Social delivery summary
    social_deliveries INTEGER DEFAULT 0,
    social_succeeded INTEGER DEFAULT 0,

    -- Model used
    model TEXT,

    -- Request metadata
    request_id TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by agent (primary query pattern)
CREATE INDEX idx_execution_logs_agent ON execution_logs(agent_id, created_at DESC);

-- Fast lookup by status (for filtering)
CREATE INDEX idx_execution_logs_status ON execution_logs(agent_id, status, created_at DESC);

-- Fast lookup for recent logs (dashboard queries)
CREATE INDEX idx_execution_logs_recent ON execution_logs(created_at DESC);

-- Fast lookup by conversation
CREATE INDEX idx_execution_logs_conversation ON execution_logs(conversation_id)
    WHERE conversation_id IS NOT NULL;

-- Fast lookup by event source
CREATE INDEX idx_execution_logs_source ON execution_logs(agent_id, event_source, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their agents
CREATE POLICY execution_logs_select ON execution_logs
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can insert logs for their agents
CREATE POLICY execution_logs_insert ON execution_logs
    FOR INSERT WITH CHECK (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can delete logs for their agents (cleanup)
CREATE POLICY execution_logs_delete ON execution_logs
    FOR DELETE USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

/**
 * Get paginated execution logs for an agent.
 * Supports filtering by status and date range.
 */
CREATE OR REPLACE FUNCTION get_execution_logs(
    p_agent_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_status TEXT DEFAULT NULL,
    p_event_source TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    event_source TEXT,
    conversation_id UUID,
    status TEXT,
    input_preview TEXT,
    output_preview TEXT,
    latency_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    blocked_by_layer TEXT,
    blocked_gate TEXT,
    blocked_reason TEXT,
    trace JSONB,
    tools_executed INTEGER,
    tools_succeeded INTEGER,
    social_deliveries INTEGER,
    social_succeeded INTEGER,
    model TEXT,
    request_id TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        el.id,
        el.event_source,
        el.conversation_id,
        el.status,
        el.input_preview,
        el.output_preview,
        el.latency_ms,
        el.input_tokens,
        el.output_tokens,
        el.blocked_by_layer,
        el.blocked_gate,
        el.blocked_reason,
        el.trace,
        el.tools_executed,
        el.tools_succeeded,
        el.social_deliveries,
        el.social_succeeded,
        el.model,
        el.request_id,
        el.created_at
    FROM execution_logs el
    WHERE el.agent_id = p_agent_id
        AND (p_status IS NULL OR el.status = p_status)
        AND (p_event_source IS NULL OR el.event_source = p_event_source)
        AND (p_start_date IS NULL OR el.created_at >= p_start_date)
        AND (p_end_date IS NULL OR el.created_at <= p_end_date)
    ORDER BY el.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

/**
 * Get execution log count for pagination.
 */
CREATE OR REPLACE FUNCTION get_execution_logs_count(
    p_agent_id UUID,
    p_status TEXT DEFAULT NULL,
    p_event_source TEXT DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM execution_logs el
        WHERE el.agent_id = p_agent_id
            AND (p_status IS NULL OR el.status = p_status)
            AND (p_event_source IS NULL OR el.event_source = p_event_source)
            AND (p_start_date IS NULL OR el.created_at >= p_start_date)
            AND (p_end_date IS NULL OR el.created_at <= p_end_date)
    );
END;
$$ LANGUAGE plpgsql;

/**
 * Get health stats for an agent.
 * Returns metrics for the last 24 hours.
 */
CREATE OR REPLACE FUNCTION get_agent_health_stats(p_agent_id UUID)
RETURNS TABLE (
    total_executions BIGINT,
    successful_executions BIGINT,
    blocked_executions BIGINT,
    error_executions BIGINT,
    success_rate NUMERIC,
    avg_latency_ms NUMERIC,
    last_execution_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_executions,
        COUNT(*) FILTER (WHERE el.status = 'success') AS successful_executions,
        COUNT(*) FILTER (WHERE el.status = 'blocked') AS blocked_executions,
        COUNT(*) FILTER (WHERE el.status = 'error') AS error_executions,
        CASE
            WHEN COUNT(*) > 0 THEN
                ROUND((COUNT(*) FILTER (WHERE el.status = 'success')::NUMERIC / COUNT(*)) * 100, 2)
            ELSE 0
        END AS success_rate,
        ROUND(AVG(el.latency_ms), 0) AS avg_latency_ms,
        MAX(el.created_at) AS last_execution_at,
        MAX(el.created_at) FILTER (WHERE el.status = 'success') AS last_success_at,
        MAX(el.created_at) FILTER (WHERE el.status = 'error') AS last_error_at
    FROM execution_logs el
    WHERE el.agent_id = p_agent_id
        AND el.created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

/**
 * Insert an execution log entry.
 * Used by API routes to log executions.
 */
CREATE OR REPLACE FUNCTION insert_execution_log(
    p_agent_id UUID,
    p_event_source TEXT,
    p_conversation_id UUID,
    p_status TEXT,
    p_input_preview TEXT,
    p_output_preview TEXT,
    p_latency_ms INTEGER,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_blocked_by_layer TEXT,
    p_blocked_gate TEXT,
    p_blocked_reason TEXT,
    p_trace JSONB,
    p_tools_executed INTEGER,
    p_tools_succeeded INTEGER,
    p_social_deliveries INTEGER,
    p_social_succeeded INTEGER,
    p_model TEXT,
    p_request_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO execution_logs (
        agent_id,
        event_source,
        conversation_id,
        status,
        input_preview,
        output_preview,
        latency_ms,
        input_tokens,
        output_tokens,
        blocked_by_layer,
        blocked_gate,
        blocked_reason,
        trace,
        tools_executed,
        tools_succeeded,
        social_deliveries,
        social_succeeded,
        model,
        request_id
    ) VALUES (
        p_agent_id,
        p_event_source,
        p_conversation_id,
        p_status,
        p_input_preview,
        p_output_preview,
        p_latency_ms,
        p_input_tokens,
        p_output_tokens,
        p_blocked_by_layer,
        p_blocked_gate,
        p_blocked_reason,
        COALESCE(p_trace, '[]'::JSONB),
        COALESCE(p_tools_executed, 0),
        COALESCE(p_tools_succeeded, 0),
        COALESCE(p_social_deliveries, 0),
        COALESCE(p_social_succeeded, 0),
        p_model,
        p_request_id
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Cleanup old execution logs.
 * Default retention: 30 days.
 */
CREATE OR REPLACE FUNCTION cleanup_old_execution_logs(
    p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM execution_logs
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted FROM deleted;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE execution_logs IS 'Detailed execution logs for debugging and monitoring';
COMMENT ON COLUMN execution_logs.event_source IS 'Source of execution: invoke, conversation, webhook, test';
COMMENT ON COLUMN execution_logs.input_preview IS 'First 100 characters of input for debugging';
COMMENT ON COLUMN execution_logs.output_preview IS 'First 100 characters of output for debugging';
COMMENT ON COLUMN execution_logs.blocked_by_layer IS 'Which claw layer blocked: L1, L3, or L4';
COMMENT ON COLUMN execution_logs.trace IS 'Step-by-step execution trace as JSONB array';
COMMENT ON FUNCTION get_execution_logs IS 'Get paginated execution logs with filtering';
COMMENT ON FUNCTION get_agent_health_stats IS 'Get 24h health metrics for an agent';
COMMENT ON FUNCTION cleanup_old_execution_logs IS 'Remove logs older than retention period';
