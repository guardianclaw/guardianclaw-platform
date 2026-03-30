-- ============================================
-- API AUDIT LOGS MIGRATION
-- ============================================
-- Audit trail for API request tool executions.
-- Records all outbound HTTP requests made by agent flows.
--
-- Security model:
-- - Logs are wallet-scoped (each user sees only their logs)
-- - Sensitive data (auth tokens, API keys) are NOT logged
-- - URLs are logged with sensitive query params masked
-- - Retention: 30 days default (configurable)

-- ============================================
-- API AUDIT LOGS TABLE
-- ============================================
CREATE TABLE api_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Owner and correlation
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    execution_id UUID,  -- Flow execution ID (nullable for direct API calls)
    request_id TEXT NOT NULL,  -- Unique request ID for correlation
    -- Request details
    method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
    url TEXT NOT NULL,  -- URL with sensitive params masked
    host TEXT NOT NULL,
    has_body BOOLEAN DEFAULT false,
    body_size INTEGER,
    -- Response details
    status_code INTEGER,
    status_text TEXT,
    response_size INTEGER,
    -- Timing
    latency_ms INTEGER NOT NULL,
    retry_attempt INTEGER,  -- 0 = first attempt, 1+ = retries
    -- Result
    success BOOLEAN NOT NULL,
    error_code TEXT,
    error_message TEXT,
    -- Metadata
    credential_id UUID REFERENCES tool_credentials(id) ON DELETE SET NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by wallet (user's logs)
CREATE INDEX idx_api_audit_logs_wallet ON api_audit_logs(wallet_address, created_at DESC);

-- Fast lookup by execution (flow execution logs)
CREATE INDEX idx_api_audit_logs_execution ON api_audit_logs(execution_id)
    WHERE execution_id IS NOT NULL;

-- Fast lookup by request ID (for debugging)
CREATE INDEX idx_api_audit_logs_request ON api_audit_logs(request_id);

-- Fast lookup for failed requests (for monitoring)
CREATE INDEX idx_api_audit_logs_failed ON api_audit_logs(wallet_address, created_at DESC)
    WHERE success = false;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE api_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own logs
CREATE POLICY api_audit_logs_select ON api_audit_logs
    FOR SELECT USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can insert their own logs (via API)
CREATE POLICY api_audit_logs_insert ON api_audit_logs
    FOR INSERT WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- No updates allowed (audit logs are immutable)
-- No deletes allowed directly (use cleanup functions)

-- ============================================
-- SECURITY EVENTS TABLE
-- ============================================
CREATE TABLE api_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Context
    wallet_address TEXT REFERENCES profiles(wallet_address) ON DELETE SET NULL,
    request_id TEXT NOT NULL,
    execution_id UUID,
    credential_id UUID REFERENCES tool_credentials(id) ON DELETE SET NULL,
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'api_ssrf_blocked',
        'api_dns_rebinding_blocked',
        'api_rate_limit_host',
        'api_rate_limit_credential',
        'api_redirect_blocked',
        'api_invalid_url',
        'api_response_too_large'
    )),
    url TEXT,  -- Masked URL
    host TEXT,
    details JSONB,  -- Additional context (reason, resolved IP, etc.)
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECURITY EVENTS INDEXES
-- ============================================

-- Fast lookup by event type (for monitoring)
CREATE INDEX idx_api_security_events_type ON api_security_events(event_type, created_at DESC);

-- Fast lookup by wallet (user's security events)
CREATE INDEX idx_api_security_events_wallet ON api_security_events(wallet_address, created_at DESC)
    WHERE wallet_address IS NOT NULL;

-- ============================================
-- SECURITY EVENTS RLS
-- ============================================

ALTER TABLE api_security_events ENABLE ROW LEVEL SECURITY;

-- Users can see their own security events
CREATE POLICY api_security_events_select ON api_security_events
    FOR SELECT USING (
        wallet_address IS NULL  -- System events visible to admins
        OR wallet_address = current_setting('app.wallet_address', true)
    );

-- System can insert security events
CREATE POLICY api_security_events_insert ON api_security_events
    FOR INSERT WITH CHECK (true);  -- Allow all inserts (service-level)

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

/**
 * Delete audit logs older than specified days.
 * Run periodically via scheduled job.
 */
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_audit_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Delete security events older than specified days.
 */
CREATE OR REPLACE FUNCTION cleanup_old_security_events(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_security_events
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

/**
 * Get audit log statistics for a wallet.
 */
CREATE OR REPLACE FUNCTION get_audit_stats(p_wallet_address TEXT, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_requests BIGINT,
    successful_requests BIGINT,
    failed_requests BIGINT,
    avg_latency_ms NUMERIC,
    unique_hosts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_requests,
        COUNT(*) FILTER (WHERE success)::BIGINT AS successful_requests,
        COUNT(*) FILTER (WHERE NOT success)::BIGINT AS failed_requests,
        ROUND(AVG(latency_ms)::NUMERIC, 2) AS avg_latency_ms,
        COUNT(DISTINCT host)::BIGINT AS unique_hosts
    FROM api_audit_logs
    WHERE wallet_address = p_wallet_address
        AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE api_audit_logs IS 'Audit trail for outbound API requests made by agent flows';
COMMENT ON TABLE api_security_events IS 'Security events from API request tool (SSRF blocks, rate limits, etc.)';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Scheduled cleanup of old audit logs';
COMMENT ON FUNCTION get_audit_stats IS 'Get aggregated audit statistics for a wallet';
